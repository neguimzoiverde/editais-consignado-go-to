import { APP_CONFIG } from '../config.js';
import { upsertEdital, logSync } from '../db/database.js';

function formatBRDate(isoString: string | null | undefined): string {
  if (!isoString) return 'não informado na fonte consultada';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'não informado na fonte consultada';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return 'não informado na fonte consultada';
  }
}

function cleanCityName(rawOrgao: string): string {
  if (!rawOrgao) return 'Município não identificado';
  let name = rawOrgao
    .replace(/^MUNICIPIO DE\s+/i, '')
    .replace(/^PREFEITURA MUNICIPAL DE\s+/i, '')
    .replace(/^PREFEITURA DE\s+/i, '')
    .replace(/^CAMARA MUNICIPAL DE\s+/i, '')
    .replace(/^FUNDO MUNICIPAL DE SAUDE DE\s+/i, '')
    .replace(/^INSTITUTO DE PREVIDENCIA DOS SERVIDORES MUNICIPAIS DE\s+/i, '')
    .replace(/^IPRE[A-Z]*\s*-\s*/i, '')
    .trim();

  // Converte para Title Case
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function isConsignadoRelevant(objeto: string): boolean {
  if (!objeto) return false;
  const text = objeto.toLowerCase();

  // Verifica falsos positivos óbvios
  for (const fp of APP_CONFIG.falsePositiveKeywords) {
    if (text.includes(fp) && !text.includes('consignad') && !text.includes('desconto em folha')) {
      return false;
    }
  }

  // Verifica se contém qualquer termo central
  for (const term of APP_CONFIG.searchTerms) {
    if (text.includes(term.toLowerCase())) return true;
  }

  // Regras semânticas combinadas
  const hasConsignado = text.includes('consignad') || text.includes('consignaç') || text.includes('averbaç');
  const hasFolha = text.includes('folha de pagamento') || text.includes('folha dos servidores') || text.includes('desconto em folha');
  const hasBancoOuFinanceira = text.includes('instituiç') || text.includes('financeir') || text.includes('banco') || text.includes('bancári');
  const hasCartao = text.includes('cartão benefício') || text.includes('cartao beneficio') || text.includes('cartão consignado');

  if (hasConsignado) return true;
  if (hasCartao) return true;
  if (hasFolha && hasBancoOuFinanceira) return true;

  return false;
}

export function determineSituacao(objeto: string, dataFimStr?: string | null): 'aberto' | 'encerrado' | 'suspenso' | 'retificado' | 'não informada' {
  const text = (objeto || '').toLowerCase();
  if (text.includes('suspens') || text.includes('revoga')) return 'suspenso';
  if (text.includes('retifica') || text.includes('republica')) return 'retificado';

  if (!dataFimStr) return 'não informada';

  try {
    const end = new Date(dataFimStr);
    const now = new Date();
    if (isNaN(end.getTime())) return 'não informada';
    return end.getTime() >= now.getTime() ? 'aberto' : 'encerrado';
  } catch {
    return 'não informada';
  }
}

export async function runPncpSync(): Promise<{ totalFound: number; newItems: number; updatedItems: number }> {
  let totalFound = 0;
  let newItems = 0;
  let updatedItems = 0;

  // Busca propostas abertas e vigentes com data final até o fim de 2026
  const dataFinalQuery = '20261231';

  for (const uf of APP_CONFIG.states) {
    try {
      // Itera até 10 páginas por estado
      for (let page = 1; page <= 10; page++) {
        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=${dataFinalQuery}&uf=${uf}&pagina=${page}&tamanhoPagina=50`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConsignadoCollector/1.0' },
        });

        if (!res.ok) break;

        const bodyText = await res.text();
        if (!bodyText || !bodyText.trim().startsWith('{')) break;

        const data = JSON.parse(bodyText);
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) break;

        for (const item of data.data) {
          const objeto = item.objetoCompra || '';
          if (!isConsignadoRelevant(objeto)) continue;

          totalFound++;
          const cnpj = item.orgaoEntidade?.cnpj || '00000000000000';
          const ano = item.anoCompra || new Date().getFullYear();
          const seq = item.sequencialCompra || '0';
          const id = `pncp_${cnpj}_${ano}_${seq}`;

          const linkOficial = `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;
          const orgao = item.orgaoEntidade?.razaoSocial || `Órgão ${uf}`;
          const municipio = cleanCityName(orgao);
          const situacao = determineSituacao(objeto, item.dataEncerramentoProposta);

          const result = upsertEdital({
            id,
            numero_edital: item.numeroCompra || `${seq}/${ano}`,
            uf,
            municipio,
            orgao,
            objeto,
            modalidade: item.modalidadeNome || 'Credenciamento',
            data_publicacao: formatBRDate(item.dataAberturaProposta || item.dataInclusao),
            data_encerramento: formatBRDate(item.dataEncerramentoProposta),
            situacao,
            link_fonte: linkOficial,
            link_edital: linkOficial,
            origem: 'PNCP (Portal Nacional de Contratações Públicas)',
          });

          if (result.isNew) newItems++;
          if (result.isUpdated) updatedItems++;
        }

        // Se a página retornou menos que 50, é a última
        if (data.data.length < 50) break;
      }
    } catch (err) {
      console.error(`Erro ao sincronizar PNCP para UF ${uf}:`, err);
    }
  }

  logSync({
    timestamp: new Date().toISOString(),
    total_found: totalFound,
    new_count: newItems,
    updated_count: updatedItems,
    status: 'success',
    message: `Varredura concluída. ${totalFound} editais de consignado identificados (${newItems} novos, ${updatedItems} atualizados).`,
  });

  return { totalFound, newItems, updatedItems };
}

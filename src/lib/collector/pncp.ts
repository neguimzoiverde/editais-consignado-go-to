import { APP_CONFIG } from '../config.js';
import { upsertEdital, logSync, getDb } from '../db/database.js';

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

  // 1. Exclusões estritas (Falsos positivos de tributos, frotas, merenda e afins)
  const strictExclusions = [
    'arrecadação de tributos',
    'arrecadacao de tributos',
    'arrecadação municipal',
    'dívida ativa',
    'divida ativa',
    'receitas públicas',
    'receitas publicas',
    'combustível',
    'combustivel',
    'abastecimento',
    'merenda',
    'passagens rodoviárias',
    'passagens rodoviarias',
    'passagem aérea',
    'manutenção de veículos',
    'peças para veículos',
    'locação de veículos',
    'crédito de carbono',
  ];

  for (const exc of strictExclusions) {
    if (text.includes(exc)) return false;
  }

  // 2. Indicadores estritos de Consignado, Cartão Consignado e Cartão Benefício
  const hasConsignado = (
    text.includes('consignad') || // consignado, consignados, consignada, consignatária, consignatárias
    text.includes('consignaç') || // consignação, consignações
    text.includes('averbaç')      // averbação de consignados
  );

  const hasCartaoConsignadoOuBeneficio = (
    text.includes('cartão benefício') ||
    text.includes('cartao beneficio') ||
    text.includes('cartão consignado') ||
    text.includes('cartao consignado') ||
    text.includes('cartão de benefício') ||
    text.includes('cartao de beneficio')
  );

  const hasEmprestimoEmFolha = (
    (text.includes('empréstimo') || text.includes('emprestimo') || text.includes('crédito pessoal') || text.includes('credito pessoal') || text.includes('mútuo') || text.includes('mutuo')) &&
    (text.includes('desconto em folha') || text.includes('consigna') || (text.includes('folha') && text.includes('servidor')))
  );

  // O edital DEVE ter pelo menos um dos 3 pilares
  const isTargetTheme = hasConsignado || hasCartaoConsignadoOuBeneficio || hasEmprestimoEmFolha;
  if (!isTargetTheme) {
    return false;
  }

  // 3. Rejeita se for MERAMENTE processamento de folha de pagamento (pagamento de salários/contas-salário do município)
  // a menos que especifique expressamente empréstimo ou cartão consignado
  const isOnlyPayrollProcessing = (
    text.includes('processamento e gerenciamento da folha') ||
    text.includes('processamento e pagamento da folha') ||
    text.includes('valores líquidos da folha') ||
    text.includes('valores liquidos da folha') ||
    text.includes('serviços relativos à folha de pagamento') ||
    text.includes('servicos relativos a folha de pagamento') ||
    text.includes('gerenciamento de créditos provenientes da folha')
  );

  if (isOnlyPayrollProcessing && !hasConsignado && !hasCartaoConsignadoOuBeneficio && !hasEmprestimoEmFolha) {
    return false;
  }

  return true;
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

export function cleanFalsePositivesFromDb() {
  const db = getDb();
  const rows = db.prepare('SELECT id, objeto FROM editais').all() as { id: string; objeto: string }[];
  const deleteStmt = db.prepare('DELETE FROM editais WHERE id = ?');
  let removedCount = 0;

  for (const r of rows) {
    if (!isConsignadoRelevant(r.objeto)) {
      deleteStmt.run(r.id);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`[DB Cleanup] Removidos ${removedCount} editais que não correspondiam a consignado/empréstimo/cartão.`);
  }
}

export async function runPncpSync(): Promise<{ totalFound: number; newItems: number; updatedItems: number }> {
  // Limpa falsos positivos anteriores
  cleanFalsePositivesFromDb();

  let totalFound = 0;
  let newItems = 0;
  let updatedItems = 0;

  // Busca propostas abertas e vigentes até o fim de 2026
  const dataFinalQuery = '20261231';

  for (const uf of APP_CONFIG.states) {
    try {
      for (let page = 1; page <= 15; page++) {
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
    message: `Varredura concluída com filtro estrito de consignado/cartão. ${totalFound} processos legítimos encontrados.`,
  });

  return { totalFound, newItems, updatedItems };
}

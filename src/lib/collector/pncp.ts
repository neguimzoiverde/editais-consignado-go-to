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

export function cleanCityName(rawOrgao: string): string {
  if (!rawOrgao) return 'Município não identificado';
  let name = rawOrgao
    .replace(/^MUNIC[IÍ]PIO DE\s+/i, '')
    .replace(/^PREFEITURA MUNICIPAL DE\s+/i, '')
    .replace(/^PREFEITURA DE\s+/i, '')
    .replace(/^C[AÂ]MARA MUNICIPAL DE\s+/i, '')
    .replace(/^FUNDO MUNICIPAL DE SA[UÚ]DE DE\s+/i, '')
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

  // 1. Exclusões estritas (Falsos positivos de tributos, frotas, orçamentos, atas e saúde)
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
    'dotação orçamentária',
    'dotacao orcamentaria',
    'dotações orçamentárias',
    'dotacoes orcamentarias',
    'recursos consignados no orçamento',
    'recursos consignados no orcamento',
    'fica consignado em ata',
    'fica consignado que',
    'consignou, ainda, que',
    'consignou que',
    'termo de apostilamento',
    'papel cartão',
    'leitor de cartão',
    'exames de imagens',
    'clínicas especializadas',
    'clinicas especializadas',
  ];

  for (const exc of strictExclusions) {
    if (text.includes(exc)) return false;
  }

  // 2. Indicadores semânticos estritos do core business:
  // Empréstimo Consignado, Cartão Consignado, Cartão Benefício, Averbação de Margem ou BaaS para consignação
  const hasConsignadoTerm = (
    text.includes('crédito consignado') ||
    text.includes('credito consignado') ||
    text.includes('empréstimo consignado') ||
    text.includes('emprestimo consignado') ||
    text.includes('consignação em folha') ||
    text.includes('consignacao em folha') ||
    text.includes('consignações em folha') ||
    text.includes('consignacoes em folha') ||
    text.includes('consignatária') ||
    text.includes('consignataria') ||
    text.includes('consignatárias') ||
    text.includes('consignatarias') ||
    text.includes('averbação de consignado') ||
    text.includes('averbacao de consignado') ||
    text.includes('averbação de consignações') ||
    text.includes('consignado em folha') ||
    (text.includes('consigna') && text.includes('banco')) ||
    (text.includes('consigna') && text.includes('financeira')) ||
    (text.includes('consigna') && text.includes('baas'))
  );

  const hasCartaoConsignadoOuBeneficio = (
    text.includes('cartão benefício') ||
    text.includes('cartao beneficio') ||
    text.includes('cartão consignado') ||
    text.includes('cartao consignado') ||
    text.includes('cartão de benefício') ||
    text.includes('cartao de beneficio') ||
    text.includes('cartão de crédito consignado') ||
    text.includes('cartao de credito consignado')
  );

  const hasEmprestimoEmFolha = (
    (text.includes('empréstimo') || text.includes('emprestimo') || text.includes('crédito pessoal') || text.includes('credito pessoal')) &&
    (text.includes('desconto em folha') || (text.includes('folha') && text.includes('servidor')))
  );

  // O edital DEVE ter pelo menos um dos 3 pilares
  const isTargetTheme = hasConsignadoTerm || hasCartaoConsignadoOuBeneficio || hasEmprestimoEmFolha;
  if (!isTargetTheme) {
    return false;
  }

  // 3. Rejeita se for MERAMENTE processamento de folha de pagamento (conta-salário do município)
  // sem relação com empréstimos ou cartões
  const isOnlyPayrollProcessing = (
    text.includes('processamento e gerenciamento da folha') ||
    text.includes('processamento e pagamento da folha') ||
    text.includes('valores líquidos da folha') ||
    text.includes('valores liquidos da folha') ||
    text.includes('serviços relativos à folha de pagamento') ||
    text.includes('servicos relativos a folha de pagamento') ||
    text.includes('gerenciamento de créditos provenientes da folha')
  );

  if (isOnlyPayrollProcessing && !hasCartaoConsignadoOuBeneficio && !text.includes('consignad') && !text.includes('empréstimo') && !text.includes('emprestimo')) {
    return false;
  }

  return true;
}

export function determineSituacao(objeto: string, dataFimStr?: string | null): 'aberto' | 'encerrado' | 'suspenso' | 'retificado' | 'não informada' {
  const text = (objeto || '').toLowerCase();
  if (text.includes('suspens') || text.includes('revoga')) return 'suspenso';
  if (text.includes('retifica') || text.includes('republica')) return 'retificado';

  // Se não tiver data final (credenciamento contínuo / fluxo contínuo), considera aberto
  if (!dataFimStr || dataFimStr === 'não informado na fonte consultada') return 'aberto';

  try {
    const end = new Date(dataFimStr);
    const now = new Date();
    if (isNaN(end.getTime())) return 'aberto';
    return end.getTime() >= now.getTime() ? 'aberto' : 'encerrado';
  } catch {
    return 'aberto';
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
  cleanFalsePositivesFromDb();

  let totalFound = 0;
  let newItems = 0;
  let updatedItems = 0;

  const dataFinalQuery = '20261231';

  // Janelas de 365 dias para a rota de publicações (modalidade 12 - Credenciamento)
  const now = new Date();
  const formatYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const dToday = new Date(now);
  const dOneYearAgo = new Date(now.getTime() - 364 * 24 * 3600 * 1000);
  const dTwoYearsAgo = new Date(now.getTime() - 728 * 24 * 3600 * 1000);

  const publicationWindows = [
    { start: formatYmd(dOneYearAgo), end: formatYmd(dToday) },
    { start: formatYmd(dTwoYearsAgo), end: formatYmd(new Date(dOneYearAgo.getTime() - 24 * 3600 * 1000)) },
  ];

  for (const uf of APP_CONFIG.states) {
    // 1. Consulta propostas abertas com data de encerramento
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
          const municipio = item.unidadeOrgao?.municipioNome || cleanCityName(orgao);
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
            link_fonte: item.linkSistemaOrigem || linkOficial,
            link_edital: linkOficial,
            origem: 'PNCP (Portal Nacional de Contratações Públicas)',
          });

          if (result.isNew) newItems++;
          if (result.isUpdated) updatedItems++;
        }

        if (data.data.length < 50) break;
      }
    } catch (err) {
      console.error(`[PNCP Proposta] Erro para UF ${uf}:`, err);
    }

    // 2. Consulta publicações na Modalidade 12 (Credenciamento Contínuo / Chamamento Público)
    for (const w of publicationWindows) {
      try {
        const maxPages = uf === 'GO' ? 20 : 10;
        for (let page = 1; page <= maxPages; page++) {
          const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?codigoModalidadeContratacao=12&uf=${uf}&dataInicial=${w.start}&dataFinal=${w.end}&pagina=${page}&tamanhoPagina=50`;
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
            const municipio = item.unidadeOrgao?.municipioNome || cleanCityName(orgao);
            const situacao = determineSituacao(objeto, item.dataEncerramentoProposta);

            const result = upsertEdital({
              id,
              numero_edital: item.numeroCompra || `${seq}/${ano}`,
              uf,
              municipio,
              orgao,
              objeto,
              modalidade: item.modalidadeNome || 'Credenciamento',
              data_publicacao: formatBRDate(item.dataPublicacaoPncp || item.dataInclusao),
              data_encerramento: item.dataEncerramentoProposta
                ? formatBRDate(item.dataEncerramentoProposta)
                : 'fluxo contínuo (aberto)',
              situacao,
              link_fonte: item.linkSistemaOrigem || linkOficial,
              link_edital: linkOficial,
              origem: 'PNCP (Portal Nacional de Contratações Públicas)',
            });

            if (result.isNew) newItems++;
            if (result.isUpdated) updatedItems++;
          }

          if (data.data.length < 50) break;
        }
      } catch (err) {
        console.error(`[PNCP Publicacao Mod12] Erro para UF ${uf} janela ${w.start}-${w.end}:`, err);
      }
    }
  }

  logSync({
    timestamp: new Date().toISOString(),
    total_found: totalFound,
    new_count: newItems,
    updated_count: updatedItems,
    status: 'success',
    message: `Varredura PNCP concluída. ${totalFound} processos legítimos encontrados.`,
  });

  return { totalFound, newItems, updatedItems };
}

import { APP_CONFIG } from '../config.js';
import { upsertEdital, logSync, getDb } from '../db/database.js';
import { analyzeEdital } from './edital_analyzer.js';
import { getDefaultPrefeituraUrls } from './prefeituras_catalog.js';

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

export async function fetchPncpDirectDocumentUrl(
  cnpj: string,
  ano: number | string,
  seq: number | string
): Promise<{ docUrl: string | null; docTitle: string | null }> {
  try {
    const cleanCnpj = String(cnpj || '').replace(/[^0-9]/g, '');
    const cleanAno = String(ano || '').replace(/[^0-9]/g, '');
    const cleanSeq = String(seq || '').replace(/[^0-9]/g, '');
    if (!cleanCnpj || !cleanAno || !cleanSeq) {
      return { docUrl: null, docTitle: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://pncp.gov.br/api/pncp/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/arquivos`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConsignadoCollector/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return { docUrl: null, docTitle: null };
    const text = await res.text();
    if (!text || !text.trim().startsWith('[')) return { docUrl: null, docTitle: null };

    const files = JSON.parse(text) as Array<{
      url?: string;
      uri?: string;
      titulo?: string;
      tipoDocumentoNome?: string;
      statusAtivo?: boolean;
    }>;

    if (!Array.isArray(files) || files.length === 0) {
      return { docUrl: null, docTitle: null };
    }

    const activeFiles = files.filter(f => f.statusAtivo !== false);
    const candidateList = activeFiles.length > 0 ? activeFiles : files;

    // Prioridade 1: Arquivo cujo título ou tipo mencione chamamento, aviso ou credenciamento
    const chamamentoFile = candidateList.find(f => {
      const name = `${f.titulo || ''} ${f.tipoDocumentoNome || ''}`.toLowerCase();
      return name.includes('aviso') || name.includes('chamamento') || name.includes('credenciamento');
    });

    if (chamamentoFile && (chamamentoFile.url || chamamentoFile.uri)) {
      return {
        docUrl: chamamentoFile.url || chamamentoFile.uri || null,
        docTitle: chamamentoFile.titulo || chamamentoFile.tipoDocumentoNome || 'Documento do Chamamento',
      };
    }

    // Prioridade 2: Edital ou Termo de Referência
    const editalFile = candidateList.find(f => {
      const name = `${f.titulo || ''} ${f.tipoDocumentoNome || ''}`.toLowerCase();
      return name.includes('edital') || name.includes('termo de referencia') || name.includes('tr');
    });

    if (editalFile && (editalFile.url || editalFile.uri)) {
      return {
        docUrl: editalFile.url || editalFile.uri || null,
        docTitle: editalFile.titulo || editalFile.tipoDocumentoNome || 'Edital / Termo de Referência',
      };
    }

    // Fallback: primeiro arquivo válido
    const first = candidateList[0];
    return {
      docUrl: first.url || first.uri || null,
      docTitle: first.titulo || first.tipoDocumentoNome || 'Arquivo Oficial',
    };
  } catch {
    return { docUrl: null, docTitle: null };
  }
}

export async function runPncpSync(targetUfs?: string[]): Promise<{ totalFound: number; newItems: number; updatedItems: number }> {
  cleanFalsePositivesFromDb();

  let totalFound = 0;
  let newItems = 0;
  let updatedItems = 0;

  const dataFinalQuery = '20261231';
  const ufsToScan = (targetUfs && targetUfs.length > 0) ? targetUfs : (APP_CONFIG.priorityStates as unknown as string[]);

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

  for (const uf of ufsToScan) {
    // 1. Consulta propostas abertas com data de encerramento
    for (let page = 1; page <= 10; page++) {
      try {
        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=${dataFinalQuery}&uf=${uf}&pagina=${page}&tamanhoPagina=50`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConsignadoCollector/1.0' },
        });

        if (!res.ok) continue;
        const bodyText = await res.text();
        if (!bodyText || !bodyText.trim().startsWith('{')) continue;

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
          const dataPub = formatBRDate(item.dataAberturaProposta || item.dataInclusao);
          const dataEnc = formatBRDate(item.dataEncerramentoProposta);

          const analysis = analyzeEdital({
            objeto,
            numero_edital: item.numeroCompra || `${seq}/${ano}`,
            modalidade: item.modalidadeNome || 'Credenciamento',
            uf,
            orgao,
            data_publicacao: dataPub,
            data_encerramento: dataEnc,
          });

          const defaultPortal = getDefaultPrefeituraUrls(municipio, uf);

          // 1º Grau: Chamamento Público (Documento Direto)
          const docInfo = await fetchPncpDirectDocumentUrl(cnpj, ano, seq);

          // 2º Grau: Portal de Compras Públicas / Prefeitura
          const portalCompras = (item.linkSistemaOrigem && !item.linkSistemaOrigem.includes('pncp.gov.br/app/editais'))
            ? item.linkSistemaOrigem
            : (defaultPortal.licitacoes_url || defaultPortal.portal_url || null);

          // 3º Grau: Edital / PNCP
          const linkEditalPncp = linkOficial;

          const result = upsertEdital({
            id,
            numero_edital: item.numeroCompra || `${seq}/${ano}`,
            ano: analysis.ano,
            uf,
            regiao: analysis.regiao,
            municipio,
            orgao,
            objeto,
            modalidade: item.modalidadeNome || 'Credenciamento / Chamamento',
            is_chamamento: analysis.is_chamamento,
            tem_emprestimo: analysis.tem_emprestimo,
            tipo_cartao: analysis.tipo_cartao,
            data_publicacao: dataPub,
            data_encerramento: dataEnc,
            prazo_credenciamento: analysis.prazo_credenciamento,
            bancos_credenciados: 'A apurar / Em habilitação',
            sistema_averbacao: analysis.sistema_averbacao,
            margem_consignavel: analysis.margem_consignavel,
            prazo_maximo: analysis.prazo_maximo,
            taxa_limitacao: analysis.taxa_limitacao,
            documentacao_exigida: analysis.documentacao_exigida,
            contato_orgao: analysis.contato_orgao,
            situacao,
            link_fonte: item.linkSistemaOrigem || linkOficial,
            link_edital: linkEditalPncp,
            link_chamamento: docInfo.docUrl,
            link_portal_compras: portalCompras,
            portal_prefeitura_url: defaultPortal.portal_url,
            origem: 'PNCP (Portal Nacional de Contratações Públicas)',
          });

          if (result.isNew) newItems++;
          if (result.isUpdated) updatedItems++;
        }

        if (data.data.length < 50) break;
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        console.error(`[PNCP Proposta] Erro para UF ${uf} página ${page}:`, err);
      }
    }

    // 2. Consulta publicações na Modalidade 12 (Credenciamento Contínuo / Chamamento Público)
    for (const w of publicationWindows) {
      const maxPages = (uf === 'GO' || uf === 'SP' || uf === 'MG') ? 15 : 8;
      for (let page = 1; page <= maxPages; page++) {
        try {
          const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?codigoModalidadeContratacao=12&uf=${uf}&dataInicial=${w.start}&dataFinal=${w.end}&pagina=${page}&tamanhoPagina=50`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConsignadoCollector/1.0' },
          });

          if (!res.ok) continue;
          const bodyText = await res.text();
          if (!bodyText || !bodyText.trim().startsWith('{')) continue;

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
            const dataPub = formatBRDate(item.dataPublicacaoPncp || item.dataInclusao);
            const dataEnc = item.dataEncerramentoProposta
              ? formatBRDate(item.dataEncerramentoProposta)
              : 'fluxo contínuo (aberto)';

            const analysis = analyzeEdital({
              objeto,
              numero_edital: item.numeroCompra || `${seq}/${ano}`,
              modalidade: item.modalidadeNome || 'Credenciamento',
              uf,
              orgao,
              data_publicacao: dataPub,
              data_encerramento: dataEnc,
            });

            const defaultPortal = getDefaultPrefeituraUrls(municipio, uf);

            // 1º Grau: Chamamento Público (Documento Direto)
            const docInfo = await fetchPncpDirectDocumentUrl(cnpj, ano, seq);

            // 2º Grau: Portal de Compras Públicas / Prefeitura
            const portalCompras = (item.linkSistemaOrigem && !item.linkSistemaOrigem.includes('pncp.gov.br/app/editais'))
              ? item.linkSistemaOrigem
              : (defaultPortal.licitacoes_url || defaultPortal.portal_url || null);

            // 3º Grau: Edital / PNCP
            const linkEditalPncp = linkOficial;

            const result = upsertEdital({
              id,
              numero_edital: item.numeroCompra || `${seq}/${ano}`,
              ano: analysis.ano,
              uf,
              regiao: analysis.regiao,
              municipio,
              orgao,
              objeto,
              modalidade: item.modalidadeNome || 'Credenciamento / Chamamento',
              is_chamamento: analysis.is_chamamento,
              tem_emprestimo: analysis.tem_emprestimo,
              tipo_cartao: analysis.tipo_cartao,
              data_publicacao: dataPub,
              data_encerramento: dataEnc,
              prazo_credenciamento: analysis.prazo_credenciamento,
              bancos_credenciados: 'A apurar / Em habilitação',
              sistema_averbacao: analysis.sistema_averbacao,
              margem_consignavel: analysis.margem_consignavel,
              prazo_maximo: analysis.prazo_maximo,
              taxa_limitacao: analysis.taxa_limitacao,
              documentacao_exigida: analysis.documentacao_exigida,
              contato_orgao: analysis.contato_orgao,
              situacao,
              link_fonte: item.linkSistemaOrigem || linkOficial,
              link_edital: linkEditalPncp,
              link_chamamento: docInfo.docUrl,
              link_portal_compras: portalCompras,
              portal_prefeitura_url: defaultPortal.portal_url,
              origem: 'PNCP (Portal Nacional de Contratações Públicas)',
            });

            if (result.isNew) newItems++;
            if (result.isUpdated) updatedItems++;
          }

          if (data.data.length < 50) break;
          await new Promise(r => setTimeout(r, 150));
        } catch (err) {
          console.error(`[PNCP Publicacao Mod12] Erro para UF ${uf} janela ${w.start}-${w.end} página ${page}:`, err);
        }
      }
    }
  }

  logSync({
    timestamp: new Date().toISOString(),
    total_found: totalFound,
    new_count: newItems,
    updated_count: updatedItems,
    status: 'success',
    message: `Varredura PNCP concluída. ${totalFound} processos legítimos encontrados (${ufsToScan.length} estados).`,
  });

  return { totalFound, newItems, updatedItems };
}

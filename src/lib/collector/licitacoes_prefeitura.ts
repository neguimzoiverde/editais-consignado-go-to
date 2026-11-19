import { upsertEdital, getDb, type Edital } from '../db/database.js';
import { analyzeEdital } from './edital_analyzer.js';
import { fetchPncpDirectDocumentUrl } from './pncp.js';
import { APP_CONFIG } from '../config.js';

const BASE_URL = 'https://licitacoesprefeitura.com.br';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface LicitacaoPrefItem {
  url: string;
  objeto: string;
  orgao: string;
  municipio: string;
  uf: string;
  modalidade: string;
  prazoPropostas?: string;
}

export async function fetchLicitacoesPrefeituraSearch(termo: string, uf = '', pagina = 1): Promise<{ items: LicitacaoPrefItem[]; hasNext: boolean }> {
  const encTerm = encodeURIComponent(termo);
  const encUf = encodeURIComponent(uf);
  const targetUrl = `${BASE_URL}/busca/?q=${encTerm}&uf=${encUf}${pagina > 1 ? `&pagina=${pagina}` : ''}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!res.ok) {
      console.warn(`[LicitacoesPrefeitura] HTTP ${res.status} ao buscar ${targetUrl}`);
      return { items: [], hasNext: false };
    }

    const html = await res.text();
    const items: LicitacaoPrefItem[] = [];

    // Localiza artigos <article class="lic">
    const articleRegex = /<article class="lic">([\s\S]*?)<\/article>/g;
    let match: RegExpExecArray | null;

    while ((match = articleRegex.exec(html)) !== null) {
      const artHtml = match[1];

      // Link e Objeto
      const linkMatch = artHtml.match(/<h3 class="lic-obj">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
      if (!linkMatch) continue;

      const url = linkMatch[1].startsWith('http') ? linkMatch[1] : `${BASE_URL}${linkMatch[1]}`;
      const objeto = linkMatch[2].replace(/<[^>]+>/g, '').trim();

      // Modalidade
      const modMatch = artHtml.match(/<span class="lic-mod">([^<]+)<\/span>/);
      const modalidade = modMatch ? modMatch[1].trim() : 'Credenciamento';

      // Órgão e Cidade/UF: <p class="lic-org">\s*([^·<]+)\s*·\s*([^-\s<]+(?:\s+[^-\s<]+)*)\s*-\s*([A-Z]{2})
      const orgMatch = artHtml.match(/<p class="lic-org">([\s\S]*?)<\/p>/);
      let orgao = '';
      let municipio = '';
      let ufResult = uf.toUpperCase();

      if (orgMatch) {
        const cleanOrg = orgMatch[1].replace(/\s+/g, ' ').trim();
        const parts = cleanOrg.split('·');
        if (parts.length >= 2) {
          orgao = parts[0].trim();
          const cityUf = parts[1].trim();
          const cityUfMatch = cityUf.match(/(.*?)\s*-\s*([A-Z]{2})/i);
          if (cityUfMatch) {
            municipio = cityUfMatch[1].trim();
            ufResult = cityUfMatch[2].toUpperCase();
          } else {
            municipio = cityUf;
          }
        } else {
          orgao = cleanOrg;
        }
      }

      // Propostas até
      const prazoMatch = artHtml.match(/<dt>Propostas até<\/dt>\s*<dd>([^<]+)<\/dd>/);
      const prazoPropostas = prazoMatch ? prazoMatch[1].trim() : undefined;

      items.push({
        url,
        objeto,
        orgao,
        municipio,
        uf: ufResult,
        modalidade,
        prazoPropostas,
      });
    }

    const hasNext = html.includes('rel="next"') || html.includes('Próximas →');
    return { items, hasNext };
  } catch (err: any) {
    console.error(`[LicitacoesPrefeitura] Erro ao buscar: ${err.message}`);
    return { items: [], hasNext: false };
  }
}

export async function fetchLicitacaoPrefeituraDetail(url: string): Promise<{
  fullObjeto?: string;
  pncpId?: string;
  pncpUrl?: string;
  publicadaEm?: string;
  inicioPropostas?: string;
  propostasAte?: string;
  unidade?: string;
  esfera?: string;
} | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Objeto completo em <section class="bloco">\s*<h2>Objeto</h2>\s*<p>([\s\S]*?)</p>
    let fullObjeto: string | undefined;
    const objMatch = html.match(/<h2>Objeto<\/h2>\s*<p>([\s\S]*?)<\/p>/i);
    if (objMatch) {
      fullObjeto = objMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Informação complementar
    const compMatch = html.match(/<h3>Informação complementar<\/h3>\s*<p>([\s\S]*?)<\/p>/i);
    if (compMatch && fullObjeto) {
      fullObjeto += ` - ${compMatch[1].replace(/<[^>]+>/g, '').trim()}`;
    }

    // Nº no PNCP
    const pncpMatch = html.match(/<dt>Nº no PNCP<\/dt>\s*<dd class="mono">([^<]+)<\/dd>/i);
    const pncpId = pncpMatch ? pncpMatch[1].trim() : undefined;

    // Link no PNCP
    const linkMatch = html.match(/href="(https:\/\/pncp\.gov\.br\/app\/editais\/[^"]+)"/i);
    const pncpUrl = linkMatch ? linkMatch[1] : undefined;

    // Datas
    const pubMatch = html.match(/<dt>Publicada em<\/dt>\s*<dd>([^<]+)<\/dd>/i);
    const iniMatch = html.match(/<dt>Início das propostas<\/dt>\s*<dd>([^<]+)<\/dd>/i);
    const ateMatch = html.match(/<dt>Propostas até<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i);

    return {
      fullObjeto,
      pncpId,
      pncpUrl,
      publicadaEm: pubMatch ? pubMatch[1].trim() : undefined,
      inicioPropostas: iniMatch ? iniMatch[1].trim() : undefined,
      propostasAte: ateMatch ? ateMatch[1].trim() : undefined,
    };
  } catch (err: any) {
    console.error(`[LicitacoesPrefeitura] Erro ao carregar detalhe ${url}: ${err.message}`);
    return null;
  }
}

export async function runLicitacoesPrefeituraSync(options?: {
  queries?: string[];
  ufs?: string[];
  maxPagesPerQuery?: number;
}): Promise<{ totalFound: number; newItems: number; updatedItems: number }> {
  console.log('[LicitacoesPrefeitura] Iniciando coleta de chamamentos e editais...');
  const queries = options?.queries || [
    'Credenciamento Consignado',
    'Cartão Benefício',
    'Cartão Consignado',
    'Crédito Consignado Folha',
    'Averbação Consignado',
    'Cooperativa Crédito Consignado',
  ];
  const maxPages = options?.maxPagesPerQuery || 3;
  let totalFound = 0;
  let newItems = 0;
  let updatedItems = 0;

  for (const q of queries) {
    for (let p = 1; p <= maxPages; p++) {
      console.log(`[LicitacoesPrefeitura] Buscando "${q}" página ${p}...`);
      const { items, hasNext } = await fetchLicitacoesPrefeituraSearch(q, '', p);

      if (!items || items.length === 0) break;

      for (const item of items) {
        // Validação semântica de relevância e filtro de falsos positivos
        const textToCheck = `${item.objeto} ${item.orgao}`.toLowerCase();

        // Ignora falsos positivos óbvios (combustível, merenda, vale-refeição comum, peças)
        const isFp = APP_CONFIG.falsePositiveKeywords.some(kw => textToCheck.includes(kw.toLowerCase()));
        if (isFp) continue;

        // Verifica se tem termos de consignado / cartões / credenciamento
        const hasScope = APP_CONFIG.itensHaver.some(ih => textToCheck.includes(ih.toLowerCase())) ||
                         APP_CONFIG.termVariations.some(tv => textToCheck.includes(tv.toLowerCase()));
        if (!hasScope) continue;

        // Busca detalhes completos para obter edital no PNCP e texto na íntegra
        const detail = await fetchLicitacaoPrefeituraDetail(item.url);
        const finalObjeto = detail?.fullObjeto || item.objeto;
        const analysis = analyzeEdital({
          objeto: finalObjeto,
          modalidade: item.modalidade,
          uf: item.uf,
          orgao: item.orgao,
          data_encerramento: detail?.propostasAte || item.prazoPropostas,
        });

        // Se a análise classificou como não-consignado, descarta
        if (analysis.tem_emprestimo === 'Não' && analysis.tipo_cartao === 'Não') {
          continue;
        }

        const id = detail?.pncpId
          ? `pncp_${detail.pncpId.replace(/[^a-zA-Z0-9]/g, '_')}`
          : `lp_${item.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-40)}`;

        let directChamamentoUrl: string | null = null;
        if (detail?.pncpUrl) {
          const match = detail.pncpUrl.match(/\/app\/editais\/([0-9]+)\/([0-9]{4})\/([0-9]+)/);
          if (match) {
            const docInfo = await fetchPncpDirectDocumentUrl(match[1], match[2], match[3]);
            directChamamentoUrl = docInfo.docUrl;
          }
        }

        const editalData: Partial<Edital> & { id: string; objeto: string; orgao: string; uf: string; link_fonte: string } = {
          id,
          numero_edital: detail?.pncpId || item.modalidade,
          ano: analysis.ano || new Date().getFullYear(),
          uf: item.uf || 'GO',
          regiao: analysis.regiao || 'Centro-Oeste',
          municipio: item.municipio || 'Não informado',
          orgao: item.orgao || 'Prefeitura Municipal',
          objeto: finalObjeto,
          modalidade: item.modalidade || 'Credenciamento',
          is_chamamento: 1, // Prioridade máxima
          tem_emprestimo: analysis.tem_emprestimo,
          tipo_cartao: analysis.tipo_cartao,
          data_publicacao: detail?.publicadaEm || new Date().toLocaleDateString('pt-BR'),
          data_encerramento: detail?.propostasAte || item.prazoPropostas || 'Conforme edital',
          prazo_credenciamento: analysis.prazo_credenciamento || detail?.propostasAte || item.prazoPropostas || 'Conforme edital',
          bancos_credenciados: analysis.bancos_credenciados,
          sistema_averbacao: analysis.sistema_averbacao,
          margem_consignavel: analysis.margem_consignavel,
          prazo_maximo: analysis.prazo_maximo,
          taxa_limitacao: analysis.taxa_limitacao,
          documentacao_exigida: analysis.documentacao_exigida,
          contato_orgao: analysis.contato_orgao,
          situacao: 'aberto',
          link_chamamento: directChamamentoUrl,
          link_portal_compras: item.url,
          link_edital: detail?.pncpUrl || item.url,
          link_fonte: detail?.pncpUrl || item.url,
          portal_prefeitura_url: item.url,
          origem: detail?.pncpUrl ? 'LicitaçõesPrefeitura + PNCP' : 'LicitaçõesPrefeitura',
        };

        const res = upsertEdital(editalData);
        totalFound++;
        if (res.isNew) newItems++;
        if (res.isUpdated) updatedItems++;
      }

      if (!hasNext) break;
      // Pequeno delay para gentileza ao servidor
      await new Promise(r => setTimeout(r, 600));
    }
  }

  console.log(`[LicitacoesPrefeitura] Coleta finalizada: ${totalFound} encontrados, ${newItems} novos, ${updatedItems} atualizados.`);
  return { totalFound, newItems, updatedItems };
}

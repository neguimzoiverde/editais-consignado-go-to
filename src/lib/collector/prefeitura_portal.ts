import { isConsignadoRelevant } from './pncp.js';
import { analyzeEdital } from './edital_analyzer.js';
import { upsertEdital, type Edital } from '../db/database.js';

export interface ScrapedPortalNotice {
  titulo: string;
  orgao: string;
  municipio: string;
  uf: string;
  objeto: string;
  dataPublicacao: string;
  dataFechamento: string;
  situacao: string;
  url: string;
}

export function parseNucleoGovHtml(html: string, pageUrl: string): ScrapedPortalNotice | null {
  try {
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Extrai campos com labels estruturados
    const extractField = (id: string) => {
      const regex = new RegExp(`<div[^>]*class=\"input\"[^>]*id=\"${id}\"[^>]*>([\\s\\S]*?)<\\/div>`, 'i');
      const match = html.match(regex);
      return match ? match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    };

    const orgao = extractField('orgao') || 'Prefeitura Municipal';
    const situacaoRaw = extractField('situacao') || 'Em andamento';
    const dataPub = extractField('publicacao') || extractField('abertura') || 'não informado';
    const dataFim = extractField('fechamento') || 'fluxo contínuo (aberto)';
    const objeto = extractField('objeto') || '';

    // Extrai nome do município e UF
    let municipio = 'Município';
    let uf = 'GO';

    const clientNameMatch = html.match(/window\.NOME_CLIENTE\s*=\s*\"([^\"]+)\"/i);
    if (clientNameMatch) {
      municipio = clientNameMatch[1].trim();
    } else {
      const munMatch = title.match(/Prefeitura(?: Municipal)? de ([^-]+)-\s*([A-Z]{2})/i);
      if (munMatch) {
        municipio = munMatch[1].trim();
        uf = munMatch[2].trim();
      }
    }

    if (!objeto && !title) return null;

    return {
      titulo: title,
      orgao,
      municipio,
      uf,
      objeto,
      dataPublicacao: dataPub,
      dataFechamento: dataFim,
      situacao: situacaoRaw,
      url: pageUrl,
    };
  } catch (err) {
    console.error('[Prefeitura Portal Parser] Erro ao analisar HTML:', err);
    return null;
  }
}

export async function fetchAndScrapePortalNotice(url: string): Promise<Edital | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    const parsed = parseNucleoGovHtml(html, url);
    if (!parsed || !parsed.objeto) return null;

    // Valida relevância estrita com base nos termos
    if (!isConsignadoRelevant(parsed.objeto)) {
      console.log(`[Prefeitura Portal] Objeto em ${url} não relevante para consignado.`);
      return null;
    }

    const cleanTitle = parsed.titulo.replace(/\s*-\s*Prefeitura.*$/i, '').trim();
    const editalNum = cleanTitle || 'Chamamento Público';

    const analysis = analyzeEdital({
      objeto: parsed.objeto,
      numero_edital: editalNum,
      modalidade: 'Chamamento Público / Credenciamento',
      uf: parsed.uf,
      orgao: parsed.orgao,
      data_publicacao: parsed.dataPublicacao,
      data_encerramento: parsed.dataFechamento,
    });

    // Gera ID único determinístico
    const id = `portal_${parsed.uf.toLowerCase()}_${parsed.municipio.toLowerCase().replace(/[^a-z0-9]/g, '')}_${analysis.ano}_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

    const editalItem = {
      id,
      numero_edital: cleanTitle,
      ano: analysis.ano,
      uf: parsed.uf,
      regiao: analysis.regiao,
      municipio: parsed.municipio,
      orgao: parsed.orgao,
      objeto: parsed.objeto,
      modalidade: 'Chamamento Público / Credenciamento',
      is_chamamento: 1,
      tem_emprestimo: analysis.tem_emprestimo,
      tipo_cartao: analysis.tipo_cartao,
      prazo_credenciamento: parsed.dataFechamento,
      bancos_credenciados: 'A apurar / Em habilitação',
      sistema_averbacao: analysis.sistema_averbacao,
      margem_consignavel: analysis.margem_consignavel,
      prazo_maximo: analysis.prazo_maximo,
      taxa_limitacao: analysis.taxa_limitacao,
      documentacao_exigida: analysis.documentacao_exigida,
      contato_orgao: analysis.contato_orgao,
      situacao: 'aberto' as const,
      link_fonte: url,
      link_edital: url,
      portal_prefeitura_url: url,
      origem: 'Portal da Prefeitura (Acesso à Informação)',
      data_publicacao: parsed.dataPublicacao,
      data_encerramento: parsed.dataFechamento,
    };

    upsertEdital(editalItem);
    console.log(`[Prefeitura Portal] Sucesso! Chamamento extraído do portal de ${parsed.municipio}/${parsed.uf}: ${cleanTitle}`);
    return editalItem as unknown as Edital;
  } catch (err) {
    console.error(`[Prefeitura Portal] Falha ao raspar ${url}:`, err);
    return null;
  }
}

// Lista de portais modelo fornecidos pelo departamento
export const KNOWN_CHAMAMENTOS_URLS = [
  'https://acessoainformacao.valparaisodegoias.go.gov.br/informacao/licitacao/id=3671',
  'https://acessoainformacao.anapolis.go.gov.br/cidadao/informacao/sgdispensa/id=40557',
  'https://acessoainformacao.rioverde.go.gov.br/informacao/licitacao/id=14484',
];

export async function runKnownPortalsSync(): Promise<{ totalFound: number; newItems: number }> {
  console.log('[Prefeitura Portais] Sincronizando portais diretos de prefeituras...');
  let totalFound = 0;
  let newItems = 0;

  for (const url of KNOWN_CHAMAMENTOS_URLS) {
    const item = await fetchAndScrapePortalNotice(url);
    if (item) {
      totalFound++;
      newItems++;
    }
  }

  return { totalFound, newItems };
}

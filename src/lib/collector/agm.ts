import { isConsignadoRelevant } from './pncp.js';
import { upsertEdital } from '../db/database.js';

interface AgmMateriaCard {
  codigo: string;
  titulo: string;
  entidade: string;
  orgao: string;
  dataCirculacao: string;
  trecho: string;
  linkMateria: string;
  linkDownload: string;
}

function cleanCityName(rawEntidade: string): string {
  if (!rawEntidade) return 'Município não identificado';
  let name = rawEntidade
    .replace(/^MUNIC[IÍ]PIO DE\s+/i, '')
    .replace(/^PREFEITURA MUNICIPAL DE\s+/i, '')
    .replace(/^PREFEITURA DE\s+/i, '')
    .replace(/^C[AÂ]MARA MUNICIPAL DE\s+/i, '')
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

function parseMateriaCards(html: string): AgmMateriaCard[] {
  const cards: AgmMateriaCard[] = [];
  const rawCards = html.split('<li class="materia-card">');

  for (let i = 1; i < rawCards.length; i++) {
    const cardHtml = rawCards[i].split('</li>')[0];

    const titleMatch = cardHtml.match(/<h2 class="materia-card__titulo">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const entidadeMatch = cardHtml.match(/<span class="materia-card__entidade">([\s\S]*?)<\/span>/i);
    const orgaoMatch = cardHtml.match(/<span class="materia-card__orgao">([\s\S]*?)<\/span>/i);
    const trechoMatch = cardHtml.match(/<p class="materia-card__trecho">([\s\S]*?)<\/p>/i);
    const dataMatch = cardHtml.match(/<dt>Circulaç[aã]o<\/dt>[\s\S]*?<dd>([\s\S]*?)<\/dd>/i);
    const codMatch = cardHtml.match(/<code>([\s\S]*?)<\/code>/i);

    if (titleMatch && codMatch) {
      const codigo = codMatch[1].trim();
      const titulo = titleMatch[2].replace(/<[^>]+>/g, '').trim();
      const entidade = entidadeMatch ? entidadeMatch[1].replace(/<[^>]+>/g, '').trim() : 'Goiás';
      const orgao = orgaoMatch ? orgaoMatch[1].replace(/<[^>]+>/g, '').trim() : entidade;
      const dataCirculacao = dataMatch ? dataMatch[1].trim() : 'não informado';
      const trecho = trechoMatch ? trechoMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      cards.push({
        codigo,
        titulo,
        entidade,
        orgao,
        dataCirculacao,
        trecho,
        linkMateria: `https://www.diariomunicipal.com.br/agm/materia/${codigo}`,
        linkDownload: `https://www.diariomunicipal.com.br/agm/download/materia/${codigo}`,
      });
    }
  }

  return cards;
}

export async function runAgmSync(): Promise<{ totalFound: number; newItems: number; updatedItems: number }> {
  let totalFound = 0;
  let newItems = 0;
  let updatedItems = 0;

  // Consultas direcionadas no Diário Oficial dos Municípios de Goiás (AGM)
  const searchQueries = [
    'busca_avancada[texto]=consignado&busca_avancada[titulo]=credenciamento',
    'busca_avancada[texto]=consignado&busca_avancada[titulo]=chamamento',
    'busca_avancada[texto]=consignado&busca_avancada[titulo]=chamada',
    'busca_avancada[texto]=cartao+consignado',
    'busca_avancada[texto]=cartao+beneficio&busca_avancada[titulo]=credenciamento',
    'busca_avancada[texto]=consignataria',
  ];

  const processedCodes = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const dataInicio = '2024-01-01';

  for (const q of searchQueries) {
    try {
      const url = `https://www.diariomunicipal.com.br/agm/pesquisar?${q}&busca_avancada[dataInicio]=${dataInicio}&busca_avancada[dataFim]=${today}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConsignadoCollector/1.0',
        },
      });

      if (!res.ok) continue;

      const html = await res.text();
      const cards = parseMateriaCards(html);

      for (const card of cards) {
        if (processedCodes.has(card.codigo)) continue;
        processedCodes.add(card.codigo);

        const titleUpper = card.titulo.toUpperCase();

        // Rejeita atos que NÃO sejam avisos/editais de abertura ou chamamento
        const isBiddingNotice = (
          (titleUpper.includes('CREDENCIAMENTO') ||
           titleUpper.includes('CHAMAMENTO') ||
           titleUpper.includes('CHAMADA PÚBLICA') ||
           titleUpper.includes('CHAMADA PUBLICA') ||
           titleUpper.includes('EDITAL') ||
           titleUpper.includes('AVISO')) &&
          !titleUpper.includes('APOSTILAMENTO') &&
          !titleUpper.includes('ADITIVO') &&
          !titleUpper.includes('ATA DE SESSÃO') &&
          !titleUpper.includes('ATA DA SESSÃO') &&
          !titleUpper.includes('JULGAMENTO') &&
          !titleUpper.includes('REGISTRO DE PREÇO') &&
          !titleUpper.includes('HOMOLOGAÇÃO')
        );

        if (!isBiddingNotice) {
          continue;
        }

        const combinedText = `${card.titulo} - ${card.trecho}`;

        // Validação estrita de relevância para consignado e cartões
        if (!isConsignadoRelevant(combinedText)) {
          continue;
        }

        totalFound++;
        const id = `agm_${card.codigo}`;
        const municipio = cleanCityName(card.entidade);

        let numeroEdital = card.titulo;
        const editalMatch = card.titulo.match(/(?:EDITAL|CHAMAMENTO|CREDENCIAMENTO|CHAMADA PÚBLICA)\s*(?:N[º°\.]*\s*)?([0-9A-Z\/\.\-]+)/i);
        if (editalMatch) {
          numeroEdital = editalMatch[0].trim();
        }

        const result = upsertEdital({
          id,
          numero_edital: numeroEdital,
          uf: 'GO',
          municipio,
          orgao: card.orgao,
          objeto: card.trecho || card.titulo,
          modalidade: 'Credenciamento / Chamamento Público',
          data_publicacao: card.dataCirculacao,
          data_encerramento: 'fluxo contínuo (aberto)',
          situacao: 'aberto',
          link_fonte: card.linkMateria,
          link_edital: card.linkDownload,
          origem: 'Diário Oficial dos Municípios (AGM)',
        });

        if (result.isNew) newItems++;
        if (result.isUpdated) updatedItems++;
      }
    } catch (err) {
      console.error(`[AGM Collector] Erro na consulta "${q}":`, err);
    }
  }

  console.log(`[AGM Collector] Concluído: ${totalFound} editais legítimos identificados, ${newItems} novos, ${updatedItems} atualizados.`);
  return { totalFound, newItems, updatedItems };
}

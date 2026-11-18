import cron from 'node-cron';
import { runPncpSync } from './pncp.js';
import { runAgmSync } from './agm.js';
import { runKnownPortalsSync } from './prefeitura_portal.js';
import { runLicitacoesPrefeituraSync } from './licitacoes_prefeitura.js';
import { initPrefeiturasCatalog } from './prefeituras_catalog.js';
import { getStats, logSync, getDb, type Edital } from '../db/database.js';

let isSchedulerStarted = false;

function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areSameEdital(editalA: Edital, editalB: Edital): boolean {
  if (normalize(editalA.municipio) !== normalize(editalB.municipio)) return false;
  if (editalA.uf !== editalB.uf) return false;

  const objA = normalize(editalA.objeto);
  const objB = normalize(editalB.objeto);

  // Palavras de parada para cálculo de sobreposição de termos
  const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'ou', 'para', 'em', 'a', 'o', 'as', 'os', 'com', 'que', 'seus', 'suas', 'este', 'esta', 'conforme']);
  const wordsA = new Set(objA.split(' ').filter(w => w.length > 2 && !stopWords.has(w)));
  const wordsB = new Set(objB.split(' ').filter(w => w.length > 2 && !stopWords.has(w)));

  const intersection = [...wordsA].filter(x => wordsB.has(x));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccard = union.size > 0 ? intersection.length / union.size : 0;

  // Ambos envolvem consignação no mesmo município
  const bothHaveConsignado = (objA.includes('consignad') || objA.includes('consignac')) && (objB.includes('consignad') || objB.includes('consignac'));

  if (jaccard >= 0.30 && bothHaveConsignado) return true;

  // Verificação de número idêntico de edital (ex: 004/2026, 002/2026, 003/2025)
  const numA = (editalA.numero_edital || '').match(/[0-9]{1,4}\/[0-9]{4}/);
  const numB = (editalB.numero_edital || '').match(/[0-9]{1,4}\/[0-9]{4}/);
  if (numA && numB && numA[0] === numB[0]) return true;

  return false;
}

export function deduplicateAndGroupEditais(): { mergedCount: number } {
  const db = getDb();
  const allRows = db.prepare('SELECT * FROM editais').all() as unknown as Edital[];

  const groups = new Map<string, Edital[]>();
  for (const item of allRows) {
    const key = `${item.uf}_${normalize(item.municipio)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  let mergedCount = 0;
  const deleteStmt = db.prepare('DELETE FROM editais WHERE id = ?');
  const updateStmt = db.prepare(`
    UPDATE editais SET
      numero_edital = ?,
      origem = ?,
      link_edital = ?,
      portal_prefeitura_url = COALESCE(?, portal_prefeitura_url),
      prazo_credenciamento = COALESCE(?, prazo_credenciamento),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  for (const [key, items] of groups.entries()) {
    if (items.length < 2) continue;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        if (areSameEdital(a, b)) {
          // Identifica registros de diferentes fontes
          const pncpItem = a.origem.includes('PNCP') ? a : (b.origem.includes('PNCP') ? b : a);
          const portalItem = a.origem.includes('Portal da Prefeitura') ? a : (b.origem.includes('Portal da Prefeitura') ? b : null);
          const agmItem = a.origem.includes('AGM') ? a : (b.origem.includes('AGM') ? b : null);

          // 1. Agrupamento Portal da Prefeitura + PNCP
          if (portalItem && pncpItem.id !== portalItem.id) {
            let consolidatedNum = pncpItem.numero_edital;
            if (portalItem.numero_edital && !portalItem.numero_edital.toLowerCase().includes('chamamento')) {
              consolidatedNum = `${portalItem.numero_edital} (PNCP: ${pncpItem.numero_edital})`;
            }

            updateStmt.run(
              consolidatedNum || pncpItem.numero_edital || 'Edital Consolidado',
              'Portal da Prefeitura + PNCP',
              pncpItem.link_edital || pncpItem.link_fonte || '',
              portalItem.link_fonte || portalItem.portal_prefeitura_url || null,
              portalItem.prazo_credenciamento || pncpItem.prazo_credenciamento || null,
              pncpItem.id
            );

            deleteStmt.run(portalItem.id);
            mergedCount++;
            console.log(`[Deduplicação] Agrupado edital de ${pncpItem.municipio}: Portal da Prefeitura + PNCP`);
          }
          // 2. Agrupamento PNCP + Diário Oficial (AGM)
          else if (agmItem && pncpItem.id !== agmItem.id) {
            let consolidatedNum = pncpItem.numero_edital;
            if (agmItem.numero_edital && !agmItem.numero_edital.toLowerCase().includes('edital de') && !agmItem.numero_edital.toLowerCase().includes('credenciamento')) {
              consolidatedNum = `${agmItem.numero_edital} (PNCP: ${pncpItem.numero_edital})`;
            }

            updateStmt.run(
              consolidatedNum,
              'PNCP + Diário Oficial (AGM)',
              agmItem.link_fonte || agmItem.link_edital,
              null,
              null,
              pncpItem.id
            );

            deleteStmt.run(agmItem.id);
            mergedCount++;
            console.log(`[Deduplicação] Agrupado edital de ${pncpItem.municipio}: PNCP + Diário Oficial (AGM)`);
          }
        }
      }
    }
  }

  return { mergedCount };
}

export async function runAllCollectors(targetUfs?: string[]): Promise<{
  portais: { totalFound: number; newItems: number };
  pncp: { totalFound: number; newItems: number; updatedItems: number };
  agm: { totalFound: number; newItems: number; updatedItems: number };
  mergedCount: number;
  totalFound: number;
  newItems: number;
  updatedItems: number;
}> {
  console.log('[Collector Orchestrator] Iniciando varredura multi-fonte (Portais de Prefeituras + PNCP Nacional + Diários)...');

  // Garante catálogo de 5.571 municípios inicializado
  initPrefeiturasCatalog();

  // 1. Varre os portais diretos de prefeituras conhecidos
  // 1. Varre o agregador nacional de prefeituras (licitacoesprefeitura.com.br)
  let lpRes = { totalFound: 0, newItems: 0, updatedItems: 0 };
  try {
    lpRes = await runLicitacoesPrefeituraSync();
  } catch (err) {
    console.error('[Scheduler] Erro ao varrer LicitaçõesPrefeitura:', err);
  }

  // 2. Varre portais municipais diretos conhecidos (Valparaíso, Rio Verde, Anápolis, etc.)
  const portaisRes = await runKnownPortalsSync();

  // 3. Varre o PNCP Nacional
  const pncpRes = await runPncpSync(targetUfs);

  // 4. Varre Diário Oficial dos Municípios
  const agmRes = await runAgmSync();

  // 5. Executa o agrupamento e deduplicação inteligente entre todas as fontes
  const dedupRes = deduplicateAndGroupEditais();

  const totalFound = lpRes.totalFound + portaisRes.totalFound + pncpRes.totalFound + agmRes.totalFound;
  const newItems = lpRes.newItems + portaisRes.newItems + pncpRes.newItems + agmRes.newItems - dedupRes.mergedCount;
  const updatedItems = lpRes.updatedItems + pncpRes.updatedItems + agmRes.updatedItems + dedupRes.mergedCount;

  logSync({
    timestamp: new Date().toISOString(),
    total_found: totalFound,
    new_count: Math.max(0, newItems),
    updated_count: updatedItems,
    status: 'success',
    message: `Varredura multi-fonte concluída: LicitaçõesPrefeitura (${lpRes.totalFound}) + Portais Municipais (${portaisRes.totalFound}) + PNCP (${pncpRes.totalFound}) + Diário AGM (${agmRes.totalFound}). ${dedupRes.mergedCount} unificados.`,
  });

  return {
    licitacoesPrefeitura: lpRes,
    portais: portaisRes,
    pncp: pncpRes,
    agm: agmRes,
    mergedCount: dedupRes.mergedCount,
    totalFound,
    newItems: Math.max(0, newItems),
    updatedItems,
  };
}

export function initScheduler() {
  if (isSchedulerStarted) return;
  isSchedulerStarted = true;

  console.log('[Scheduler] Inicializando agendador diário para editais de consignado (America/Sao_Paulo)...');
  initPrefeiturasCatalog();

  cron.schedule(
    '0 7 * * *',
    async () => {
      console.log('[Scheduler] Iniciando rotina diária das 07:00 AM...');
      try {
        const result = await runAllCollectors();
        console.log(`[Scheduler] Varredura diária concluída: ${result.totalFound} encontrados (${result.mergedCount} agrupados).`);
      } catch (err) {
        console.error('[Scheduler] Falha na execução da varredura programada:', err);
      }
    },
    {
      timezone: 'America/Sao_Paulo',
    }
  );

  setTimeout(async () => {
    try {
      const stats = getStats();
      if (stats.total === 0) {
        console.log('[Scheduler] Banco de dados vazio. Executando primeira carga de sincronização multi-portal...');
        await runAllCollectors();
      }
    } catch (err) {
      console.error('[Scheduler] Erro na sincronização inicial:', err);
    }
  }, 2000);
}

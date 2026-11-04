import cron from 'node-cron';
import { runPncpSync } from './pncp.js';
import { runAgmSync } from './agm.js';
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

  // Ambos envolvem BaaS e consignação no mesmo município
  const bothHaveBaas = (objA.includes('baas') || objA.includes('banking as service')) && (objB.includes('baas') || objB.includes('banking as service'));
  const bothHaveConsignado = (objA.includes('consignad') || objA.includes('consignac')) && (objB.includes('consignad') || objB.includes('consignac'));

  if (bothHaveBaas && bothHaveConsignado) return true;
  if (jaccard >= 0.35 && bothHaveConsignado) return true;

  // Verificação de número idêntico de edital (ex: 003/2025)
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
          // Identifica qual registro é PNCP e qual é AGM
          const pncpItem = a.origem.includes('PNCP') ? a : (b.origem.includes('PNCP') ? b : a);
          const agmItem = a.origem.includes('AGM') ? a : (b.origem.includes('AGM') ? b : null);

          if (agmItem && pncpItem.id !== agmItem.id) {
            // Consolida a numeração do edital
            let consolidatedNum = pncpItem.numero_edital;
            if (agmItem.numero_edital && !agmItem.numero_edital.toLowerCase().includes('edital de') && !agmItem.numero_edital.toLowerCase().includes('credenciamento')) {
              consolidatedNum = `${agmItem.numero_edital} (PNCP: ${pncpItem.numero_edital})`;
            } else if (agmItem.numero_edital) {
              consolidatedNum = `${agmItem.numero_edital} / PNCP ${pncpItem.numero_edital}`;
            }

            // Atualiza registro canônico do PNCP com dupla origem e link do Diário Oficial
            updateStmt.run(
              consolidatedNum,
              'PNCP + Diário Oficial (AGM)',
              agmItem.link_fonte || agmItem.link_edital,
              pncpItem.id
            );

            // Remove o registro duplicado isolado do AGM
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

export async function runAllCollectors(): Promise<{
  pncp: { totalFound: number; newItems: number; updatedItems: number };
  agm: { totalFound: number; newItems: number; updatedItems: number };
  mergedCount: number;
  totalFound: number;
  newItems: number;
  updatedItems: number;
}> {
  console.log('[Collector Orchestrator] Iniciando varredura multi-fonte (PNCP + Diários Oficiais)...');

  const pncpRes = await runPncpSync();
  const agmRes = await runAgmSync();

  // Executa o agrupamento e deduplicação inteligente entre portais
  const dedupRes = deduplicateAndGroupEditais();

  const totalFound = pncpRes.totalFound + agmRes.totalFound;
  const newItems = pncpRes.newItems + agmRes.newItems - dedupRes.mergedCount;
  const updatedItems = pncpRes.updatedItems + agmRes.updatedItems + dedupRes.mergedCount;

  logSync({
    timestamp: new Date().toISOString(),
    total_found: totalFound,
    new_count: Math.max(0, newItems),
    updated_count: updatedItems,
    status: 'success',
    message: `Varredura multi-portal concluída: PNCP (${pncpRes.totalFound}) + Diário Oficial AGM (${agmRes.totalFound}). ${dedupRes.mergedCount} editais unificados e agrupados entre portais.`,
  });

  return {
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

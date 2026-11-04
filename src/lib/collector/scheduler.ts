import cron from 'node-cron';
import { runPncpSync } from './pncp.js';
import { runAgmSync } from './agm.js';
import { getStats, logSync } from '../db/database.js';

let isSchedulerStarted = false;

export async function runAllCollectors(): Promise<{
  pncp: { totalFound: number; newItems: number; updatedItems: number };
  agm: { totalFound: number; newItems: number; updatedItems: number };
  totalFound: number;
  newItems: number;
  updatedItems: number;
}> {
  console.log('[Collector Orchestrator] Iniciando varredura multi-fonte (PNCP + Diários Oficiais)...');

  const pncpRes = await runPncpSync();
  const agmRes = await runAgmSync();

  const totalFound = pncpRes.totalFound + agmRes.totalFound;
  const newItems = pncpRes.newItems + agmRes.newItems;
  const updatedItems = pncpRes.updatedItems + agmRes.updatedItems;

  logSync({
    timestamp: new Date().toISOString(),
    total_found: totalFound,
    new_count: newItems,
    updated_count: updatedItems,
    status: 'success',
    message: `Varredura multi-portal concluída: PNCP (${pncpRes.totalFound}) + Diário Oficial AGM (${agmRes.totalFound}). Total: ${totalFound} processos legítimos.`,
  });

  return {
    pncp: pncpRes,
    agm: agmRes,
    totalFound,
    newItems,
    updatedItems,
  };
}

export function initScheduler() {
  if (isSchedulerStarted) return;
  isSchedulerStarted = true;

  console.log('[Scheduler] Inicializando agendador diário para editais de consignado (America/Sao_Paulo)...');

  // Executa todo dia às 07:00 da manhã no fuso America/Sao_Paulo
  cron.schedule(
    '0 7 * * *',
    async () => {
      console.log('[Scheduler] Iniciando rotina diária das 07:00 AM...');
      try {
        const result = await runAllCollectors();
        console.log(`[Scheduler] Varredura diária concluída: ${result.totalFound} encontrados (${result.newItems} novos).`);
      } catch (err) {
        console.error('[Scheduler] Falha na execução da varredura programada:', err);
      }
    },
    {
      timezone: 'America/Sao_Paulo',
    }
  );

  // Se o banco estiver vazio na inicialização do container, dispara uma coleta de aquecimento
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

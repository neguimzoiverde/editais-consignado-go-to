import cron from 'node-cron';
import { runPncpSync } from './pncp.js';
import { getStats } from '../db/database.js';

let isSchedulerStarted = false;

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
        const result = await runPncpSync();
        console.log(`[Scheduler] Varredura diária concluída: ${result.totalFound} encontrados, ${result.newItems} novos.`);
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
        console.log('[Scheduler] Banco de dados vazio. Executando primeira carga de sincronização...');
        await runPncpSync();
      }
    } catch (err) {
      console.error('[Scheduler] Erro na sincronização inicial:', err);
    }
  }, 2000);
}

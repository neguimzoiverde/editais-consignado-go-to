import type { APIRoute } from 'astro';
import { runAllCollectors } from '../../lib/collector/scheduler.js';
import { getStats, getLastSync } from '../../lib/db/database.js';

let isSyncRunning = false;

export const POST: APIRoute = async ({ url }) => {
  try {
    const targetUf = url.searchParams.get('uf');
    const ufs = targetUf && targetUf !== 'ALL' ? [targetUf] : undefined;

    if (isSyncRunning) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'running',
          message: 'Uma varredura multi-fonte já está em andamento em segundo plano.',
          stats: getStats(),
          lastSync: getLastSync(),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    isSyncRunning = true;
    // Executa em segundo plano para não estourar os 100s do Cloudflare
    runAllCollectors(ufs)
      .catch((err) => console.error('[API Sync] Erro na varredura em background:', err))
      .finally(() => {
        isSyncRunning = false;
      });

    return new Response(
      JSON.stringify({
        success: true,
        status: 'started',
        message: 'Varredura multi-fonte iniciada com sucesso em segundo plano!',
        stats: getStats(),
        lastSync: getLastSync(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    isSyncRunning = false;
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Erro durante sincronização',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

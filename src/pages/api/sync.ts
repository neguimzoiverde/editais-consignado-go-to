import type { APIRoute } from 'astro';
import { runAllCollectors } from '../../lib/collector/scheduler.js';
import { getStats, getLastSync } from '../../lib/db/database.js';

export const POST: APIRoute = async () => {
  try {
    const result = await runAllCollectors();
    const stats = getStats();
    const lastSync = getLastSync();

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        stats,
        lastSync,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
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

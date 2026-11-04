import type { APIRoute } from 'astro';
import { runPncpSync } from '../../lib/collector/pncp.js';
import { getStats, getLastSync } from '../../lib/db/database.js';

export const POST: APIRoute = async () => {
  try {
    const result = await runPncpSync();
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

import type { APIRoute } from 'astro';
import { getStats, getLastSync } from '../../lib/db/database.js';

export const GET: APIRoute = async () => {
  try {
    const stats = getStats();
    const lastSync = getLastSync();
    return new Response(
      JSON.stringify({
        status: 'ok',
        app: 'editais-consignado-astro',
        timestamp: new Date().toISOString(),
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
      JSON.stringify({ status: 'error', message: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

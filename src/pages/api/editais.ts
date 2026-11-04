import type { APIRoute } from 'astro';
import { listEditais } from '../../lib/db/database.js';

export const GET: APIRoute = async ({ url }) => {
  const uf = url.searchParams.get('uf') || 'ALL';
  const situacao = url.searchParams.get('situacao') || 'ALL';
  const search = url.searchParams.get('search') || '';

  const editais = listEditais({ uf, situacao, search });

  return new Response(JSON.stringify(editais), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

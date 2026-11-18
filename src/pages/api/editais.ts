import type { APIRoute } from 'astro';
import { listEditais } from '../../lib/db/database.js';

export const GET: APIRoute = async ({ url }) => {
  const uf = url.searchParams.get('uf') || 'ALL';
  const regiao = url.searchParams.get('regiao') || 'ALL';
  const situacao = url.searchParams.get('situacao') || 'ALL';
  const somente_chamamento = url.searchParams.get('somente_chamamento') === 'true';
  const search = url.searchParams.get('search') || '';

  const editais = listEditais({ uf, regiao, situacao, somente_chamamento, search });

  return new Response(JSON.stringify(editais), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

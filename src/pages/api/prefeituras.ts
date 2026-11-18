import type { APIRoute } from 'astro';
import { listPrefeituras, upsertPrefeitura } from '../../lib/db/database.js';
import { fetchAndScrapePortalNotice } from '../../lib/collector/prefeitura_portal.js';

export const GET: APIRoute = async ({ url }) => {
  const uf = url.searchParams.get('uf') || 'ALL';
  const regiao = url.searchParams.get('regiao') || 'ALL';
  const status = url.searchParams.get('status') || 'ALL';
  const search = url.searchParams.get('search') || '';

  const prefeituras = listPrefeituras({ uf, regiao, status, search });

  return new Response(JSON.stringify(prefeituras), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL do portal é obrigatória' }), { status: 400 });
    }

    const scraped = await fetchAndScrapePortalNotice(url);
    return new Response(JSON.stringify({ success: true, edital: scraped }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

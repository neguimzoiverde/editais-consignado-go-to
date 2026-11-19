import type { APIRoute } from 'astro';
import { searchServidores } from '../../../lib/db/database.js';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const municipio = url.searchParams.get('municipio') || undefined;
  const uf = url.searchParams.get('uf') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const vinculo = url.searchParams.get('vinculo') || undefined;
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 25;
  const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : 0;

  const result = searchServidores({
    municipio,
    uf,
    q,
    vinculo,
    limit,
    offset,
  });

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

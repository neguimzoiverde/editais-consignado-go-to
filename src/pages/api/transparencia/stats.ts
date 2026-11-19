import type { APIRoute } from 'astro';
import { getFolhaStatsByMunicipio, listFolhaStats } from '../../../lib/db/database.js';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const municipio = url.searchParams.get('municipio');
  const uf = url.searchParams.get('uf');
  const regiao = url.searchParams.get('regiao') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const minServidores = url.searchParams.get('minServidores') ? Number(url.searchParams.get('minServidores')) : undefined;

  // Se passou município específico, retorna objeto único detalhado
  if (municipio) {
    const stats = getFolhaStatsByMunicipio(municipio, uf || undefined);
    if (!stats) {
      return new Response(
        JSON.stringify({ found: false, message: `Estatísticas não localizadas para ${municipio}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ found: true, stats }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Caso contrário, lista com filtros
  const list = listFolhaStats({
    uf: uf || undefined,
    regiao,
    search,
    minServidores,
  });

  return new Response(
    JSON.stringify(list),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

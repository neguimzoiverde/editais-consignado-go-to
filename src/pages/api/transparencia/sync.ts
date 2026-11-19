import type { APIRoute } from 'astro';
import { syncMunicipioFolha, syncAllActiveEditaisFolha } from '../../../lib/transparencia/transparenciaCollector.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body vazio
    }

    if (body.all) {
      const res = await syncAllActiveEditaisFolha();
      return new Response(
        JSON.stringify({
          success: true,
          message: `Varredura de folha concluída para ${res.totalProcessed} municípios. ${res.updated} atualizados.`,
          totalProcessed: res.totalProcessed,
          updated: res.updated,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const municipio = (body.municipio || '').trim();
    const uf = (body.uf || '').trim();

    if (!municipio) {
      return new Response(
        JSON.stringify({ error: 'Informe o município a ser sincronizado.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await syncMunicipioFolha(municipio, uf || undefined);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API SYNC FOLHA ERROR]', err);
    return new Response(
      JSON.stringify({ error: 'Falha ao sincronizar folha do município: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

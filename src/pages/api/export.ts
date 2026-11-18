import type { APIRoute } from 'astro';
import { generateDailyMarkdownReport } from '../../lib/reporter/markdown.js';
import { generateCsvReport } from '../../lib/reporter/csv.js';
import { listEditais } from '../../lib/db/database.js';

export const GET: APIRoute = async ({ url }) => {
  const format = url.searchParams.get('format') || 'markdown';
  const uf = url.searchParams.get('uf') || 'ALL';
  const regiao = url.searchParams.get('regiao') || 'ALL';
  const somente_chamamento = url.searchParams.get('somente_chamamento') === 'true';
  const dateStr = new Date().toISOString().slice(0, 10);

  const filters = {
    uf: uf !== 'ALL' ? uf : undefined,
    regiao: regiao !== 'ALL' ? regiao : undefined,
    somente_chamamento: somente_chamamento || undefined,
  };

  if (format === 'csv') {
    const csv = generateCsvReport(filters);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="editais-chamamento-consignado-brasil-${dateStr}.csv"`,
      },
    });
  }

  if (format === 'json') {
    const editais = listEditais(filters);
    return new Response(JSON.stringify(editais, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="editais-chamamento-consignado-brasil-${dateStr}.json"`,
      },
    });
  }

  // Padrão: Markdown da especificação
  const md = generateDailyMarkdownReport(filters);
  return new Response(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="editais-chamamento-consignado-brasil-${dateStr}.md"`,
    },
  });
};

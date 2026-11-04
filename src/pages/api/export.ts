import type { APIRoute } from 'astro';
import { generateDailyMarkdownReport } from '../../lib/reporter/markdown.js';
import { generateCsvReport } from '../../lib/reporter/csv.js';
import { listEditais } from '../../lib/db/database.js';

export const GET: APIRoute = async ({ url }) => {
  const format = url.searchParams.get('format') || 'markdown';
  const dateStr = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const csv = generateCsvReport();
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="editais-consignado-go-to-${dateStr}.csv"`,
      },
    });
  }

  if (format === 'json') {
    const editais = listEditais();
    return new Response(JSON.stringify(editais, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="editais-consignado-go-to-${dateStr}.json"`,
      },
    });
  }

  // Padrão: Markdown da especificação
  const md = generateDailyMarkdownReport();
  return new Response(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="editais-consignado-go-to-${dateStr}.md"`,
    },
  });
};

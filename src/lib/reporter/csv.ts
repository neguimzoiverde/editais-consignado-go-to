import { listEditais } from '../db/database.js';

export function generateCsvReport(): string {
  const editais = listEditais();

  const headers = [
    'Municipio',
    'UF',
    'Orgao',
    'Numero_Edital',
    'Modalidade',
    'Objeto',
    'Data_Publicacao',
    'Data_Encerramento',
    'Situacao',
    'Fonte_Oficial',
    'Origem'
  ];

  const escapeCsv = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = editais.map(e => [
    escapeCsv(e.municipio),
    escapeCsv(e.uf),
    escapeCsv(e.orgao),
    escapeCsv(e.numero_edital),
    escapeCsv(e.modalidade),
    escapeCsv(e.objeto),
    escapeCsv(e.data_publicacao),
    escapeCsv(e.data_encerramento),
    escapeCsv(e.situacao),
    escapeCsv(e.link_fonte),
    escapeCsv(e.origem),
  ].join(';'));

  // UTF-8 BOM para abrir perfeitamente no Excel
  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

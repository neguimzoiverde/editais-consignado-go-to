import { listEditais } from '../db/database.js';

export function generateCsvReport(filters?: { uf?: string; regiao?: string; somente_chamamento?: boolean }): string {
  const editais = listEditais(filters);

  // 16 Colunas de Negócio Oficiais do Departamento
  const headers = [
    'MUNICIPIO',
    'EDITAL',
    'ANO',
    'OBJETO',
    'EMPRESTIMO',
    'CARTAO',
    'STATUS',
    'PRAZO_PARA_NOVO_CREDENCIAMENTO',
    'BANCOS_JA_CREDENCIADOS',
    'SISTEMA_DE_AVERBACAO',
    'MARGEM',
    'PRAZO_MAXIMO',
    'TAXA_LIMITACAO',
    'DOCUMENTACAO',
    'CONTATO',
    'LINK_DO_EDITAL',
    'PORTAL_PREFEITURA'
  ];

  const escapeCsv = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
    return `"${str}"`;
  };

  const rows = editais.map(e => [
    escapeCsv(`${e.municipio}/${e.uf}`),
    escapeCsv(e.numero_edital),
    escapeCsv(e.ano),
    escapeCsv(e.objeto),
    escapeCsv(e.tem_emprestimo),
    escapeCsv(e.tipo_cartao),
    escapeCsv(e.situacao),
    escapeCsv(e.prazo_credenciamento || e.data_encerramento),
    escapeCsv(e.bancos_credenciados),
    escapeCsv(e.sistema_averbacao),
    escapeCsv(e.margem_consignavel),
    escapeCsv(e.prazo_maximo),
    escapeCsv(e.taxa_limitacao),
    escapeCsv(e.documentacao_exigida),
    escapeCsv(e.contato_orgao || e.orgao),
    escapeCsv(e.link_fonte || e.link_edital),
    escapeCsv(e.portal_prefeitura_url || ''),
  ].join(';'));

  // UTF-8 BOM para abrir perfeitamente no Excel
  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

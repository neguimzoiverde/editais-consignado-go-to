import { listEditais, type Edital } from '../db/database.js';

export function generateDailyMarkdownReport(): string {
  const editais = listEditais();

  const now = new Date();
  const todayBR = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const lines: string[] = [];

  // Cabeçalho da especificação
  lines.push(`**Assunto:** Editais de consignado — GO e TO — ${todayBR}\n`);

  // Tabela
  lines.push('| Município/UF | Órgão | Edital ou chamamento | Objeto identificado | Publicação | Prazo/situação | Fonte oficial |');
  lines.push('|---|---|---|---|---|---|---|');

  const novidades: string[] = [];
  const prazosProximos: string[] = [];
  const observacoes: string[] = [];

  if (editais.length === 0) {
    lines.push('| - | - | - | Nenhum edital de consignado identificado nas fontes oficiais até o momento | - | - | - |');
    novidades.push('Não foram identificadas publicações novas na data de hoje.');
  } else {
    for (const item of editais) {
      const muniUf = `${item.municipio}/${item.uf}`;
      const orgao = item.orgao || 'não informado na fonte consultada';
      const edital = item.numero_edital || 'não informado';
      const objeto = (item.objeto || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '-');
      const pub = item.data_publicacao || 'não informado na fonte consultada';
      const prazoSituacao = `${item.data_encerramento} (${item.situacao})`;
      const link = item.link_fonte ? `[PNCP / Oficial](${item.link_fonte})` : 'não informado';

      lines.push(`| ${muniUf} | ${orgao} | ${edital} | ${objeto} | ${pub} | ${prazoSituacao} | ${link} |`);

      // Classifica para seções complementares
      if (item.is_new === 1) {
        novidades.push(`- **${muniUf} - ${orgao}:** Edital ${edital} (${item.situacao}). Objeto: ${objeto.slice(0, 150)}... [Ver edital](${item.link_fonte})`);
      }

      if (item.situacao === 'aberto' && item.data_encerramento && item.data_encerramento !== 'não informado na fonte consultada') {
        prazosProximos.push(`- **${muniUf} - ${edital}:** Prazo de envio/encerramento em ${item.data_encerramento}.`);
      }

      if (item.data_encerramento === 'não informado na fonte consultada' || item.situacao === 'não informada') {
        observacoes.push(`- **${muniUf} (${edital}):** Prazo ou situação exata dependente de conferência manual no arquivo do edital.`);
      }
    }
  }

  lines.push('');
  lines.push('### Novidades do dia');
  if (novidades.length > 0) {
    lines.push(novidades.join('\n'));
  } else {
    lines.push('Nenhuma publicação nova registrada na data de hoje. Processos anteriores continuam monitorados e vigentes.');
  }

  lines.push('');
  lines.push('### Prazos próximos');
  if (prazosProximos.length > 0) {
    lines.push(prazosProximos.slice(0, 5).join('\n'));
  } else {
    lines.push('Não há encerramentos com prazos iminentes confirmados para os próximos dias.');
  }

  lines.push('');
  lines.push('### Observações');
  if (observacoes.length > 0) {
    lines.push(observacoes.slice(0, 5).join('\n'));
  } else {
    lines.push('Todos os editais possuem links oficiais de acesso validados no PNCP.');
  }

  return lines.join('\n');
}

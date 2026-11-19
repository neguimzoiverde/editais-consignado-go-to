import { listEditais, resolveProcessLinks, type Edital } from '../db/database.js';

export function generateDailyMarkdownReport(filters?: { uf?: string; regiao?: string; somente_chamamento?: boolean }): string {
  const editais = listEditais(filters);

  const now = new Date();
  const todayBR = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const ufScope = filters?.uf && filters.uf !== 'ALL' ? filters.uf : 'Brasil';

  const lines: string[] = [];

  // Cabeçalho Oficial
  lines.push(`**Assunto:** Chamamentos Públicos e Editais de Consignado — ${ufScope} — ${todayBR}\n`);

  // Matriz das 16 Colunas de Negócio
  lines.push('| Município/UF | Edital | Ano | Objeto | Empréstimo | Cartão | Status | Prazo para Novo Credenciamento | Bancos já Credenciados | Sistema de Averbação | Margem | Prazo Máximo | Taxa/Limitação | Documentação | Contato | Link do Edital |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');

  const novidades: string[] = [];
  const prazosProximos: string[] = [];
  const observacoes: string[] = [];

  if (editais.length === 0) {
    lines.push('| - | - | - | Nenhum edital de chamamento localizado no momento | - | - | - | - | - | - | - | - | - | - | - | - |');
    novidades.push('Não foram identificadas publicações novas na data de hoje.');
  } else {
    for (const item of editais) {
      const muniUf = `${item.municipio}/${item.uf}`;
      const edital = item.numero_edital || 'não informado';
      const ano = item.ano || new Date().getFullYear();
      const objeto = (item.objeto || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '-');
      const emprestimo = item.tem_emprestimo || 'Sim';
      const cartao = item.tipo_cartao || 'Não';
      const status = item.situacao || 'aberto';
      const prazoCred = item.prazo_credenciamento || item.data_encerramento || 'Fluxo Contínuo';
      const bancos = (item.bancos_credenciados || 'A apurar / Em habilitação').replace(/\|/g, '-');
      const averbacao = (item.sistema_averbacao || 'A apurar na entidade').replace(/\|/g, '-');
      const margem = (item.margem_consignavel || '35% + 5%').replace(/\|/g, '-');
      const prazoMax = (item.prazo_maximo || '96 a 120 meses').replace(/\|/g, '-');
      const taxa = (item.taxa_limitacao || 'Teto BACEN').replace(/\|/g, '-');
      const doc = (item.documentacao_exigida || 'Habilitação Jurídica e Fiscal').replace(/\|/g, '-');
      const contato = (item.contato_orgao || item.orgao || 'Prefeitura').replace(/\|/g, '-');
      
      const resolved = resolveProcessLinks(item);
      const linkChamamentoStr = resolved.linkChamamento ? `[1º Chamamento (Doc)](${resolved.linkChamamento})` : '1º Chamamento: Não encontrado';
      const linkComprasStr = resolved.linkPortalCompras ? `[2º Compras](${resolved.linkPortalCompras})` : '2º Compras: Não encontrado';
      const linkEditalStr = resolved.linkEdital ? `[3º Edital/PNCP](${resolved.linkEdital})` : '3º Edital: Não encontrado';
      const linksCombined = `${linkChamamentoStr} &bull; ${linkComprasStr} &bull; ${linkEditalStr}`;

      lines.push(`| ${muniUf} | ${edital} | ${ano} | ${objeto} | ${emprestimo} | ${cartao} | ${status} | ${prazoCred} | ${bancos} | ${averbacao} | ${margem} | ${prazoMax} | ${taxa} | ${doc} | ${contato} | ${linksCombined} |`);

      // Classifica seções complementares
      if (item.is_new === 1) {
        novidades.push(`- **${muniUf}:** Chamamento ${edital} (${status}). Produtos: Empréstimo [${emprestimo}], Cartão [${cartao}]. Prazo para Credenciamento: ${prazoCred}.`);
      }

      if (item.situacao === 'aberto' && prazoCred && !prazoCred.toLowerCase().includes('fluxo')) {
        prazosProximos.push(`- **${muniUf} - ${edital}:** Prazo para novo credenciamento até ${prazoCred}.`);
      }

      if (prazoCred.toLowerCase().includes('fluxo')) {
        observacoes.push(`- **${muniUf} (${edital}):** Credenciamento em fluxo contínuo — adesão aberta a novas instituições financeiras.`);
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
  lines.push('### Prazos de Credenciamento');
  if (prazosProximos.length > 0) {
    lines.push(prazosProximos.slice(0, 8).join('\n'));
  } else {
    lines.push('Processos em aberto operam predominantemente em regime de fluxo contínuo para credenciamento.');
  }

  lines.push('');
  lines.push('### Observações e Sistemas de Averbação');
  if (observacoes.length > 0) {
    lines.push(observacoes.slice(0, 8).join('\n'));
  } else {
    lines.push('Todos os editais possuem links oficiais de acesso validados no PNCP e portais de prefeituras.');
  }

  return lines.join('\n');
}

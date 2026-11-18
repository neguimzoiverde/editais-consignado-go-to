import { REGIONS, type BrazilUF } from '../config.js';

export interface EditalAnalysis {
  ano: number;
  regiao: string;
  is_chamamento: number;
  tem_emprestimo: 'Sim' | 'Não';
  tipo_cartao: 'Cartão Consignado' | 'Cartão Benefício' | 'Ambos' | 'Não';
  prazo_credenciamento: string;
  sistema_averbacao: string;
  margem_consignavel: string;
  prazo_maximo: string;
  taxa_limitacao: string;
  documentacao_exigida: string;
  contato_orgao: string;
}

export function getRegionFromUf(uf: string): string {
  const ufUpper = (uf || '').toUpperCase() as BrazilUF;
  for (const [_, reg] of Object.entries(REGIONS)) {
    if (reg.ufs.includes(ufUpper)) {
      return reg.nome;
    }
  }
  return 'Brasil';
}

export function analyzeEdital(params: {
  objeto: string;
  numero_edital?: string;
  modalidade?: string;
  uf?: string;
  orgao?: string;
  data_publicacao?: string;
  data_encerramento?: string;
}): EditalAnalysis {
  const text = (params.objeto || '').toLowerCase();
  const numText = (params.numero_edital || '').toLowerCase();
  const modText = (params.modalidade || '').toLowerCase();

  // 1. Extração do Ano
  let ano = new Date().getFullYear();
  const yearMatch = (params.numero_edital || '').match(/\b(202[0-9])\b/) || (params.data_publicacao || '').match(/\b(202[0-9])\b/);
  if (yearMatch) {
    ano = parseInt(yearMatch[1], 10);
  }

  // 2. Região
  const regiao = getRegionFromUf(params.uf || '');

  // 3. É Chamamento Público ou Credenciamento?
  const isChamamento = (
    modText.includes('chamamento') ||
    modText.includes('credenciamento') ||
    modText.includes('inexigibilidade') ||
    numText.includes('chamamento') ||
    numText.includes('credenciamento') ||
    numText.includes('chamada') ||
    text.includes('chamamento') ||
    text.includes('credenciamento') ||
    text.includes('chamada pública') ||
    text.includes('chamada publica')
  ) ? 1 : 0;

  // 4. Empréstimo Consignado
  const temEmprestimo: 'Sim' | 'Não' = (
    text.includes('empréstimo') ||
    text.includes('emprestimo') ||
    text.includes('crédito consignado') ||
    text.includes('credito consignado') ||
    text.includes('crédito pessoal') ||
    text.includes('credito pessoal') ||
    text.includes('consignação em folha') ||
    text.includes('consignacao em folha') ||
    text.includes('desconto em folha')
  ) ? 'Sim' : 'Não';

  // 5. Cartão Consignado / Benefício
  const hasCartaoBeneficio = (
    text.includes('cartão benefício') ||
    text.includes('cartao beneficio') ||
    text.includes('cartão de benefício') ||
    text.includes('cartao de beneficio')
  );

  const hasCartaoConsignado = (
    text.includes('cartão consignado') ||
    text.includes('cartao consignado') ||
    text.includes('cartão de crédito consignado') ||
    text.includes('cartao de credito consignado')
  );

  let tipoCartao: 'Cartão Consignado' | 'Cartão Benefício' | 'Ambos' | 'Não' = 'Não';
  if (hasCartaoBeneficio && hasCartaoConsignado) {
    tipoCartao = 'Ambos';
  } else if (hasCartaoBeneficio) {
    tipoCartao = 'Cartão Benefício';
  } else if (hasCartaoConsignado) {
    tipoCartao = 'Cartão Consignado';
  }

  // 6. Prazo para Novo Credenciamento
  let prazoCred = 'Fluxo Contínuo (Vigente)';
  if (params.data_encerramento && params.data_encerramento !== 'não informado na fonte consultada' && !params.data_encerramento.toLowerCase().includes('fluxo')) {
    prazoCred = params.data_encerramento;
  }

  // 7. Sistema de Averbação
  let sistemaAverbacao = 'A apurar na entidade';
  if (text.includes('zetra') || text.includes('econsig') || text.includes('e-consig')) {
    sistemaAverbacao = 'Zetra / e-Consig';
  } else if (text.includes('consignet')) {
    sistemaAverbacao = 'Consignet';
  } else if (text.includes('neoconsig')) {
    sistemaAverbacao = 'Neoconsig';
  } else if (text.includes('infoconsig')) {
    sistemaAverbacao = 'Infoconsig';
  } else if (text.includes('facilconsig') || text.includes('fácil consig')) {
    sistemaAverbacao = 'Fácil Consig';
  } else if (text.includes('sistema próprio') || text.includes('folha de pagamento municipal')) {
    sistemaAverbacao = 'Sistema Próprio / RH';
  }

  // 8. Margem Consignável
  let margem = '35% empréstimo + 5% cartão (Padrão Legal)';
  if (text.includes('45%') || (text.includes('35%') && text.includes('5%'))) {
    margem = '35% empréstimo + 5% cartão + 5% benefício (45%)';
  } else if (text.includes('40%')) {
    margem = '35% empréstimo + 5% cartão (40%)';
  } else if (text.includes('30%')) {
    margem = '30% margem consignável';
  }

  // 9. Prazo Máximo
  let prazoMax = 'Até 96 a 120 meses';
  const matchMeses = text.match(/([0-9]{2,3})\s*(?:meses|parcelas)/);
  if (matchMeses) {
    prazoMax = `Até ${matchMeses[1]} meses`;
  }

  // 10. Taxa / Limitação
  let taxaLimitacao = 'Teto BACEN / Fixado em Decreto Municipal';
  if (text.includes('menor taxa') || text.includes('redução de juros')) {
    taxaLimitacao = 'Livre concorrência / Redução de juros praticados';
  } else if (text.includes('teto bacen') || text.includes('banco central')) {
    taxaLimitacao = 'Teto estipulado pelo BACEN';
  }

  // 11. Documentação
  const docExigida = 'Habilitação Jurídica, Regularidade Fiscal/Trabalhista (CNDs) e Autorização BACEN';

  // 12. Contato do Órgão
  const contato = params.orgao ? `Setor de Licitações / RH - ${params.orgao}` : 'Setor de Contratações da Prefeitura';

  return {
    ano,
    regiao,
    is_chamamento: isChamamento,
    tem_emprestimo: temEmprestimo,
    tipo_cartao: tipoCartao,
    prazo_credenciamento: prazoCred,
    sistema_averbacao: sistemaAverbacao,
    margem_consignavel: margem,
    prazo_maximo: prazoMax,
    taxa_limitacao: taxaLimitacao,
    documentacao_exigida: docExigida,
    contato_orgao: contato,
  };
}

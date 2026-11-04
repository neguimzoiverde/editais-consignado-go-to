export const APP_CONFIG = {
  timezone: 'America/Sao_Paulo',
  states: ['GO', 'TO'] as const,
  // 10 Expressões centrais obrigatórias da especificação
  searchTerms: [
    'credenciamento de instituições financeiras',
    'chamamento público de bancos',
    'credenciamento de consignatárias',
    'crédito consignado',
    'consignação em folha',
    'empréstimo com desconto em folha',
    'instituições financeiras',
    'averbação de consignados',
    'cartão consignado',
    'cartão benefício',
  ],
  // Variações e termos complementares para enriquecimento
  termVariations: [
    'credenciamento consignado',
    'chamamento consignado',
    'desconto em folha de pagamento',
    'instituição consignatária',
    'consignações em folha',
    'cartão benefício consignado',
    'cartão de crédito consignado',
    'averbação em folha',
  ],
  // Filtro de exclusão de falsos positivos (termos que contêm palavras como "cartão" ou "crédito" mas não são consignados)
  falsePositiveKeywords: [
    'combustível',
    'abastecimento',
    'vale refeição',
    'vale alimentação',
    'cesta básica',
    'passagem aérea',
    'merenda',
    'peças para veículos',
    'pneus',
    'locação de veículos',
    'crédito de carbono',
  ],
};

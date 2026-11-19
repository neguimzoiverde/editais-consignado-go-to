/**
 * Classificador Nativo de Vínculos Funcionais para Análise de Crédito Consignado
 *
 * Mapeia e normaliza qualquer descrição textual de vínculo funcional para os
 * grupos oficiais do mercado bancário e de consignação em folha.
 */

export type StandardBondGroup =
  | 'EFETIVO'
  | 'APOSENTADO'
  | 'PENSIONISTA'
  | 'COMISSIONADO'
  | 'TEMPORARIO'
  | 'MILITAR'
  | 'POLITICO'
  | 'CLT'
  | 'ESTAGIARIO'
  | 'OUTROS';

export interface BondTypeInfo {
  code: StandardBondGroup;
  label: string;
  isEligibleConsignado: boolean; // Elegibilidade segura para consignado (prazos longos 96-120 meses)
  isEligibleCartao: boolean;     // Elegibilidade para Cartão Benefício / Cartão Consignado
  riskLevel: 'baixo' | 'medio' | 'alto';
  badgeClass: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  raw: string;
}

export interface CalculatedMargins {
  baseAmount: number;
  margemEmprestimo35: number;
  margemCartao5: number;
  margemTotal40: number;
}

export function classifyBond(rawInput: string | null | undefined): BondTypeInfo {
  const raw = (rawInput || '').trim();
  if (!raw) {
    return {
      code: 'OUTROS',
      label: 'Não informado',
      isEligibleConsignado: false,
      isEligibleCartao: false,
      riskLevel: 'alto',
      badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
      textColor: 'text-zinc-400',
      bgColor: 'bg-zinc-800',
      borderColor: 'border-zinc-700',
      raw: '—',
    };
  }

  const s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  // 1. Aposentado / Inativo (RPPS) — Alto valor comercial, vitalício
  if (s.includes('APOSENT') || s.includes('INATIVO') || s.includes('JUBILAD')) {
    return {
      code: 'APOSENTADO',
      label: 'Aposentado (RPPS)',
      isEligibleConsignado: true,
      isEligibleCartao: true,
      riskLevel: 'baixo',
      badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/15',
      borderColor: 'border-blue-500/30',
      raw,
    };
  }

  // 2. Pensionista — Benefício previdenciário estável
  if (s.includes('PENSION') || s.includes('PENSAO')) {
    return {
      code: 'PENSIONISTA',
      label: 'Pensionista',
      isEligibleConsignado: true,
      isEligibleCartao: true,
      riskLevel: 'baixo',
      badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/15',
      borderColor: 'border-cyan-500/30',
      raw,
    };
  }

  // 3. Militar / Reformado / Bombeiro
  if (s.includes('REFORM') || s.includes('MILITAR') || s.includes('RESERVA') || s.includes('BOMBEIRO')) {
    return {
      code: 'MILITAR',
      label: 'Militar / Reformado',
      isEligibleConsignado: true,
      isEligibleCartao: true,
      riskLevel: 'baixo',
      badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      textColor: 'text-indigo-400',
      bgColor: 'bg-indigo-500/15',
      borderColor: 'border-indigo-500/30',
      raw,
    };
  }

  // 4. Político / Agente Eletivo
  if (
    s.includes('PREFEIT') ||
    s.includes('VEREAD') ||
    s.includes('SECRETAR') ||
    s.includes('SECRET') ||
    s.includes('CONSELHO TUTELAR') ||
    s.includes('CONSELHEIR') ||
    s.includes('POLITICO') ||
    s.includes('MEMBRO CONS')
  ) {
    return {
      code: 'POLITICO',
      label: 'Agente Político',
      isEligibleConsignado: false,
      isEligibleCartao: true,
      riskLevel: 'alto',
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-500/15',
      borderColor: 'border-rose-500/30',
      raw,
    };
  }

  // 5. Estagiário / Aprendiz / Residente
  if (s.includes('ESTAGI') || s.includes('APREND') || s.includes('BOLSISTA') || s.includes('RESIDENT')) {
    return {
      code: 'ESTAGIARIO',
      label: 'Estagiário / Bolsista',
      isEligibleConsignado: false,
      isEligibleCartao: false,
      riskLevel: 'alto',
      badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
      textColor: 'text-zinc-400',
      bgColor: 'bg-zinc-800',
      borderColor: 'border-zinc-700',
      raw,
    };
  }

  // 6. Temporário / PSS / Contrato por Prazo Determinado
  if (
    s.includes('TEMP') ||
    s.includes('CONTRAT') ||
    s.includes('SELETIV') ||
    s.includes('PSS') ||
    s.includes('DETERM') ||
    s.includes('PRAZO') ||
    s.includes('DESIGNAD')
  ) {
    return {
      code: 'TEMPORARIO',
      label: 'Temporário / PSS',
      isEligibleConsignado: false,
      isEligibleCartao: false,
      riskLevel: 'alto',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/30',
      raw,
    };
  }

  // 7. Cargo Comissionado / Confiança / Ad Nutum
  if (
    s.includes('COMIS') ||
    s.includes('NAO-EFETIV') ||
    s.includes('NAO EFETIV') ||
    s.includes('AD NUTUM') ||
    s.includes('CONFIDEN') ||
    s.includes('CONFIANCA') ||
    s.includes('LIVRE PROVIMENTO')
  ) {
    return {
      code: 'COMISSIONADO',
      label: 'Comissionado',
      isEligibleConsignado: false, // Risco de exoneração, mas comumente elegível para cartão
      isEligibleCartao: true,
      riskLevel: 'medio',
      badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-500/15',
      borderColor: 'border-purple-500/30',
      raw,
    };
  }

  // 8. CLT / Empregado Público
  if (s.includes('CLT') || s.includes('CELET') || s.includes('EMPREG')) {
    return {
      code: 'CLT',
      label: 'CLT / Empregado Público',
      isEligibleConsignado: false,
      isEligibleCartao: true,
      riskLevel: 'medio',
      badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
      textColor: 'text-teal-400',
      bgColor: 'bg-teal-500/15',
      borderColor: 'border-teal-500/30',
      raw,
    };
  }

  // 9. Efetivo / Concursado / Estatutário / Estável — O principal filão de consignado!
  if (
    s.includes('EFETIV') ||
    s.includes('CONCURS') ||
    s.includes('ESTATUT') ||
    s.includes('ESTAVEL') ||
    s.includes('REGIME JURIDICO UNICO') ||
    s.includes('PROBATORIO') ||
    s.includes('CARREIRA') ||
    s.includes('PERMANENTE')
  ) {
    return {
      code: 'EFETIVO',
      label: 'Efetivo / Concursado',
      isEligibleConsignado: true,
      isEligibleCartao: true,
      riskLevel: 'baixo',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-500/30',
      raw,
    };
  }

  // 10. Fallback padrão
  return {
    code: 'OUTROS',
    label: raw || 'Outros',
    isEligibleConsignado: false,
    isEligibleCartao: false,
    riskLevel: 'medio',
    badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    textColor: 'text-zinc-300',
    bgColor: 'bg-zinc-800',
    borderColor: 'border-zinc-700',
    raw,
  };
}

/**
 * Calcula as margens legais de crédito consignado para a remuneração informada
 * Padrão Federal / Municipal:
 *  - 35% para Empréstimo Consignado
 *  - 5% para Cartão de Crédito Consignado / Benefício
 *  - 40% Margem Total
 */
export function calculateMargins(remuneracaoBruta: number, remuneracaoLiquida?: number): CalculatedMargins {
  const base = remuneracaoBruta > 0 ? remuneracaoBruta : (remuneracaoLiquida && remuneracaoLiquida > 0 ? remuneracaoLiquida : 0);
  const m35 = Math.round(base * 0.35 * 100) / 100;
  const m5 = Math.round(base * 0.05 * 100) / 100;
  const m40 = Math.round(base * 0.40 * 100) / 100;

  return {
    baseAmount: base,
    margemEmprestimo35: m35,
    margemCartao5: m5,
    margemTotal40: m40,
  };
}

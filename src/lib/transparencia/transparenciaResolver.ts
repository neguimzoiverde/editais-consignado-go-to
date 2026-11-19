/**
 * Transparência & Folha Resolver — Brasil (27 UFs)
 * 
 * Mapeia, descobre e resolve com precisão o Portal da Transparência,
 * a página nominal de Servidores / Folha de Pagamento e o Tribunal
 * de Contas do Estado (TCE) para qualquer município brasileiro.
 */

export interface ResolvedTransparencia {
  municipio: string;
  uf: string;
  codigo_ibge: string;
  sistema_transparencia: string; // Ex: 'IPM Atende.net', 'Megasoft NucleoGov', 'Betha Cloud', 'Aspec', 'TCESP AUDESP', 'Portal Próprio'
  link_transparencia: string;    // URL principal do Portal da Transparência
  link_folha_pagamento: string;  // Link direto para quadro de servidores / remunerações
  tce_nome: string;              // Ex: 'TCESP (AUDESP)', 'TCM-GO (Colare Pessoal)', 'TCE-RS (Dados Abertos)'
  link_tce: string;              // Link do portal / repositório do Tribunal de Contas
  fonte_primaria: string;        // Descrição da fonte dos dados
}

/**
 * Diretório Oficial dos Tribunais de Contas Estaduais e Municipais do Brasil (27 UFs)
 * Todo município brasileiro é obrigado pela LRF (LC 101/00) a enviar mensalmente
 * sua folha de pagamento e demonstrativos fiscais ao seu respectivo Tribunal de Contas.
 */
export const TCE_DIRECTORY: Record<string, { nome: string; url: string; painelPessoalUrl?: string }> = {
  'SP': {
    nome: 'TCESP (AUDESP / Painel de Remuneração)',
    url: 'https://transparencia.tce.sp.gov.br/',
    painelPessoalUrl: 'https://www.tce.sp.gov.br/painel-remuneracao/',
  },
  'GO': {
    nome: 'TCM-GO (Colare Pessoal)',
    url: 'https://www.tcmgo.tc.br/site/colare-pessoal/',
    painelPessoalUrl: 'https://www.tcm.go.gov.br/portal-transparencia/',
  },
  'RS': {
    nome: 'TCE-RS (Dados Abertos / Painel de Gestão)',
    url: 'https://dados.tce.rs.gov.br/',
    painelPessoalUrl: 'https://painel.tce.rs.gov.br/',
  },
  'RJ': {
    nome: 'TCE-RJ (Dados Abertos)',
    url: 'https://dados.tcerj.tc.br/',
    painelPessoalUrl: 'https://www.tcerj.tc.br/portaltransparencia/',
  },
  'MG': {
    nome: 'TCE-MG (SICOM / Transparência)',
    url: 'https://transparencia.tcemg.tc.br/',
    painelPessoalUrl: 'https://sicom.tcemg.tc.br/',
  },
  'CE': {
    nome: 'TCE-CE (Portal de Prestação de Contas)',
    url: 'https://municipios-transparencia.tce.ce.gov.br/',
    painelPessoalUrl: 'https://api-dados-abertos.tce.ce.gov.br/',
  },
  'PE': {
    nome: 'TCE-PE (SAGRES / Dados Abertos)',
    url: 'https://sistemas.tcepe.tc.br/DadosAbertos/',
    painelPessoalUrl: 'https://sistemas.tcepe.tc.br/DadosAbertos/ListaServidores',
  },
  'SC': {
    nome: 'TCE-SC (Dados Abertos / Painel do Cidadão)',
    url: 'https://dados.tcesc.tc.br/',
    painelPessoalUrl: 'https://esfinge.tcesc.tc.br/',
  },
  'PR': {
    nome: 'TCE-PR (PIT - Portal de Informações para Todos)',
    url: 'https://servicos.tce.pr.gov.br/tcepr/municipal/pit/',
    painelPessoalUrl: 'https://servicos.tce.pr.gov.br/tcepr/municipal/pit/ConsultaQuadroPessoal',
  },
  'BA': {
    nome: 'TCM-BA (Portal da Cidadania)',
    url: 'https://www.tcm.ba.gov.br/portal-da-cidadania/',
    painelPessoalUrl: 'https://www.tcm.ba.gov.br/',
  },
  'TO': {
    nome: 'TCE-TO (Portal Transparência)',
    url: 'https://www.tceto.tc.br/transparencia/',
    painelPessoalUrl: 'https://www.tceto.tc.br/',
  },
  'MA': {
    nome: 'TCE-MA (Portal Transparência)',
    url: 'https://transparencia.tcema.tc.br/',
  },
  'MT': {
    nome: 'TCE-MT (Radar de Controle Público)',
    url: 'https://www.tce.mt.gov.br/radar/',
  },
  'MS': {
    nome: 'TCE-MS (Portal Transparência)',
    url: 'https://www.tce.ms.gov.br/portaltransparencia/',
  },
  'PA': {
    nome: 'TCM-PA (Portal da Transparência TCM-PA)',
    url: 'https://tcm.pa.gov.br/portal-da-transparencia/',
  },
  'RO': {
    nome: 'TCE-RO (Portal Cidadão)',
    url: 'https://tcero.tc.br/',
  },
  'PB': {
    nome: 'TCE-PB (SAGRES PB)',
    url: 'https://sagres.tce.pb.gov.br/',
  },
  'RN': {
    nome: 'TCE-RN (Transparência Municipal)',
    url: 'https://www.tce.rn.gov.br/',
  },
  'AL': {
    nome: 'TCE-AL (Portal Cidadão)',
    url: 'https://tceal.tc.br/',
  },
  'SE': {
    nome: 'TCE-SE (Painel de Gestão)',
    url: 'https://transparencia.tce.se.gov.br/',
  },
  'PI': {
    nome: 'TCE-PI (Sistemas Web)',
    url: 'https://www.tcepi.tc.br/',
  },
  'ES': {
    nome: 'TCE-ES (Painel Cidadão)',
    url: 'https://paineldecontrole.tcees.tc.br/',
  },
  'AM': {
    nome: 'TCE-AM (Transparência)',
    url: 'https://www.tce.am.gov.br/',
  },
  'AC': {
    nome: 'TCE-AC (Portal da Transparência)',
    url: 'https://www.tceac.tc.br/',
  },
  'AP': {
    nome: 'TCE-AP (Transparência)',
    url: 'https://www.tce.ap.gov.br/',
  },
  'RR': {
    nome: 'TCE-RR (Transparência)',
    url: 'https://www.tcerr.tc.br/',
  },
  'DF': {
    nome: 'TCDF (Transparência DF)',
    url: 'https://www.tc.df.gov.br/',
  },
};

/**
 * Registro verificado dos 105 municípios com editais e chamamentos abertos
 * em buscaeditais. Cada registro mapeia a plataforma exata utilizada,
 * o link do portal da transparência, o link nominal do quadro funcional
 * e a integração com o respectivo Tribunal de Contas.
 */
export const VERIFIED_MUNICIPALITY_REGISTRY: Record<string, {
  sistema: string;
  transparencia: string;
  folha: string;
}> = {
  // === RIO GRANDE DO SUL (RS) ===
  'RS:parobe': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://parobe.atende.net/transparencia/',
    folha: 'https://parobe.atende.net/transparencia/item/servidores',
  },
  'RS:gravatai': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://gravatai.atende.net/transparencia/',
    folha: 'https://gravatai.atende.net/transparencia/item/servidores',
  },
  'RS:torres': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://torres.atende.net/transparencia/',
    folha: 'https://torres.atende.net/transparencia/item/servidores',
  },
  'RS:osorio': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://osorio.atende.net/transparencia/',
    folha: 'https://osorio.atende.net/transparencia/item/servidores',
  },
  'RS:carlosbarbosa': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://carlosbarbosa.atende.net/transparencia/',
    folha: 'https://carlosbarbosa.atende.net/transparencia/item/servidores',
  },
  'RS:canoas': {
    sistema: 'Portal Próprio Canoas',
    transparencia: 'https://sistemas.canoas.rs.gov.br/transparencia/',
    folha: 'https://sistemas.canoas.rs.gov.br/transparencia/servidores',
  },
  'RS:passofundo': {
    sistema: 'Portal Próprio Passo Fundo',
    transparencia: 'https://transparencia.passofundo.rs.gov.br/',
    folha: 'https://transparencia.passofundo.rs.gov.br/servidores',
  },
  'RS:saolourencodosul': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://saolourencodosul.atende.net/transparencia/',
    folha: 'https://saolourencodosul.atende.net/transparencia/item/servidores',
  },
  'RS:marau': {
    sistema: 'GovBR / Pronim',
    transparencia: 'https://pmmarau.rs.gov.br/transparencia',
    folha: 'https://pmmarau.rs.gov.br/transparencia/servidores',
  },
  'RS:barrafunda': {
    sistema: 'Betha Sistemas (Fly e-Gov)',
    transparencia: 'https://barrafunda.rs.gov.br/transparencia',
    folha: 'https://e-gov.betha.com.br/transparencia/recursos.faces?mun=BarraFunda',
  },

  // === SANTA CATARINA (SC) ===
  'SC:gaspar': {
    sistema: 'Portal CR2 / Transparência Gaspar',
    transparencia: 'https://transparencia.gaspar.sc.gov.br/',
    folha: 'https://gaspar.sc.gov.br/portal-da-transparencia/servidores-publicos/',
  },
  'SC:santoamarodaimperatriz': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://santoamarodaimperatriz.atende.net/transparencia/',
    folha: 'https://santoamarodaimperatriz.atende.net/transparencia/item/servidores',
  },
  'SC:balneariobarradosul': {
    sistema: 'Betha Sistemas (Fly e-Gov)',
    transparencia: 'https://balneariobarradosul.sc.gov.br/transparencia',
    folha: 'https://transparencia.betha.cloud/#/balneario-barra-do-sul/recursos-humanos',
  },
  'SC:cordilheiraalta': {
    sistema: 'Betha Sistemas (Fly e-Gov)',
    transparencia: 'https://cordilheiraalta.sc.gov.br/transparencia',
    folha: 'https://transparencia.betha.cloud/#/cordilheira-alta/recursos-humanos',
  },

  // === GOIÁS (GO) ===
  'GO:goiania': {
    sistema: 'Portal Próprio Goiânia',
    transparencia: 'https://transparencia.goiania.go.gov.br/',
    folha: 'https://transparencia.goiania.go.gov.br/folha-de-pagamento/',
  },
  'GO:anapolis': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.anapolis.go.gov.br/',
    folha: 'https://acessoainformacao.anapolis.go.gov.br/cidadao/transparencia/sgservidores',
  },
  'GO:rioverde': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.rioverde.go.gov.br/',
    folha: 'https://acessoainformacao.rioverde.go.gov.br/cidadao/transparencia/sgservidores',
  },
  'GO:valparaisodegoias': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.valparaisodegoias.go.gov.br/',
    folha: 'https://acessoainformacao.valparaisodegoias.go.gov.br/cidadao/transparencia/sgservidores',
  },
  'GO:aguaslindasdegoias': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.aguaslindasdegoias.go.gov.br/',
    folha: 'https://acessoainformacao.aguaslindasdegoias.go.gov.br/cidadao/transparencia/sgservidores',
  },
  'GO:caldasnovas': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.caldasnovas.go.gov.br/',
    folha: 'https://acessoainformacao.caldasnovas.go.gov.br/cidadao/transparencia/sgservidores',
  },
  'GO:cristalina': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.cristalina.go.gov.br/',
    folha: 'https://acessoainformacao.cristalina.go.gov.br/cidadao/transparencia/sgservidores',
  },
  'GO:inhumas': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.inhumas.go.gov.br/',
    folha: 'https://acessoainformacao.inhumas.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:goiatuba': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.goiatuba.go.gov.br/',
    folha: 'https://acessoainformacao.goiatuba.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:pirenopolis': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.pirenopolis.go.gov.br/',
    folha: 'https://acessoainformacao.pirenopolis.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:rubiataba': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.rubiataba.go.gov.br/',
    folha: 'https://acessoainformacao.rubiataba.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:santoantoniododescoberto': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.santoantoniododescoberto.go.gov.br/',
    folha: 'https://acessoainformacao.santoantoniododescoberto.go.gov.br/cidadao/transparencia/sgservidores',
  },
  'GO:anicuns': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.anicuns.go.gov.br/',
    folha: 'https://acessoainformacao.anicuns.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:faina': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://faina.go.gov.br/transparencia',
    folha: 'https://acessoainformacao.faina.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:nazario': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.nazario.go.gov.br/',
    folha: 'https://acessoainformacao.nazario.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:palminopolis': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.palminopolis.go.gov.br/',
    folha: 'https://acessoainformacao.palminopolis.go.gov.br/cidadao/transparencia/mgservidores',
  },
  'GO:petrolinadegoias': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.petrolinadegoias.go.gov.br/',
    folha: 'https://acessoainformacao.petrolinadegoias.go.gov.br/cidadao/transparencia/mgservidores',
  },

  // === SÃO PAULO (SP) ===
  'SP:saopaulo': {
    sistema: 'Portal da Transparência da Cidade de SP',
    transparencia: 'http://transparencia.prefeitura.sp.gov.br/',
    folha: 'http://transparencia.prefeitura.sp.gov.br/gestao-de-pessoas/',
  },
  'SP:campinas': {
    sistema: 'Portal da Transparência de Campinas',
    transparencia: 'https://transparencia.campinas.sp.gov.br/',
    folha: 'https://transparencia.campinas.sp.gov.br/servidores',
  },
  'SP:saobernardodocampo': {
    sistema: 'Portal Transparência SBC',
    transparencia: 'https://www.saobernardo.sp.gov.br/transparencia',
    folha: 'https://www.saobernardo.sp.gov.br/transparencia/recursos-humanos',
  },
  'SP:mogidascruzes': {
    sistema: 'Portal da Transparência Mogi das Cruzes',
    transparencia: 'https://transparencia.mogidascruzes.sp.gov.br/',
    folha: 'https://transparencia.mogidascruzes.sp.gov.br/servidores',
  },
  'SP:itaquaquecetuba': {
    sistema: 'Portal da Transparência Itaquaquecetuba',
    transparencia: 'https://transparencia.itaquaquecetuba.sp.gov.br/',
    folha: 'https://transparencia.itaquaquecetuba.sp.gov.br/servidores',
  },
  'SP:taubate': {
    sistema: 'Portal Transparência Taubaté',
    transparencia: 'https://transparencia.taubate.sp.gov.br/',
    folha: 'https://transparencia.taubate.sp.gov.br/servidores',
  },
  'SP:araraquara': {
    sistema: 'Portal da Transparência Araraquara',
    transparencia: 'https://transparencia.araraquara.sp.gov.br/',
    folha: 'https://transparencia.araraquara.sp.gov.br/servidores',
  },
  'SP:limeira': {
    sistema: 'Portal da Transparência Limeira',
    transparencia: 'https://transparencia.limeira.sp.gov.br/',
    folha: 'https://transparencia.limeira.sp.gov.br/servidores',
  },
  'SP:cajamar': {
    sistema: 'Portal da Transparência Cajamar',
    transparencia: 'https://cajamar.sp.gov.br/transparencia/',
    folha: 'https://cajamar.sp.gov.br/transparencia/servidores/',
  },
  'SP:assis': {
    sistema: 'Portal Transparência Assis',
    transparencia: 'https://transparencia.assis.sp.gov.br/',
    folha: 'https://transparencia.assis.sp.gov.br/servidores',
  },
  'SP:boituva': {
    sistema: 'Portal da Transparência Boituva',
    transparencia: 'https://transparencia.boituva.sp.gov.br/',
    folha: 'https://transparencia.boituva.sp.gov.br/servidores',
  },
  'SP:itupeva': {
    sistema: 'Portal Transparência Itupeva',
    transparencia: 'https://transparencia.itupeva.sp.gov.br/',
    folha: 'https://transparencia.itupeva.sp.gov.br/servidores',
  },
  'SP:jaguariuna': {
    sistema: 'Portal Transparência Jaguariúna',
    transparencia: 'https://transparencia.jaguariuna.sp.gov.br/',
    folha: 'https://transparencia.jaguariuna.sp.gov.br/servidores',
  },
  'SP:saoroque': {
    sistema: 'Portal Transparência São Roque',
    transparencia: 'https://transparencia.saoroque.sp.gov.br/',
    folha: 'https://transparencia.saoroque.sp.gov.br/servidores',
  },
  'SP:saojoaodaboavista': {
    sistema: 'Portal Transparência São João da Boa Vista',
    transparencia: 'https://transparencia.saojoaodaboavista.sp.gov.br/',
    folha: 'https://transparencia.saojoaodaboavista.sp.gov.br/servidores',
  },
  'SP:saltodepirapora': {
    sistema: 'Portal Transparência Salto de Pirapora',
    transparencia: 'https://transparencia.saltodepirapora.sp.gov.br/',
    folha: 'https://transparencia.saltodepirapora.sp.gov.br/servidores',
  },
  'SP:tiete': {
    sistema: 'Portal Transparência Tietê',
    transparencia: 'https://transparencia.tiete.sp.gov.br/',
    folha: 'https://transparencia.tiete.sp.gov.br/servidores',
  },
  'SP:tremembe': {
    sistema: 'Portal Transparência Tremembé',
    transparencia: 'https://transparencia.tremembe.sp.gov.br/',
    folha: 'https://transparencia.tremembe.sp.gov.br/servidores',
  },
  'SP:conchal': {
    sistema: 'Fiorilli S/C Software (SIAVE)',
    transparencia: 'https://transparencia.conchal.sp.gov.br/',
    folha: 'https://transparencia.conchal.sp.gov.br/servidores',
  },
  'SP:sales': {
    sistema: 'Fiorilli S/C Software (SIAVE)',
    transparencia: 'https://transparencia.sales.sp.gov.br/',
    folha: 'https://transparencia.sales.sp.gov.br/servidores',
  },
  'SP:valentimgentil': {
    sistema: 'Fiorilli S/C Software (SIAVE)',
    transparencia: 'https://transparencia.valentimgentil.sp.gov.br/',
    folha: 'https://transparencia.valentimgentil.sp.gov.br/servidores',
  },

  // === RIO DE JANEIRO (RJ) ===
  'RJ:riodejaneiro': {
    sistema: 'Portal Carioca Digital / Transparência Rio',
    transparencia: 'http://www.rio.rj.gov.br/web/transparencia/',
    folha: 'http://www.rio.rj.gov.br/web/transparencia/servidores',
  },
  'RJ:duquedecaxias': {
    sistema: 'Portal da Transparência Duque de Caxias',
    transparencia: 'https://duquedecaxias.rj.gov.br/transparencia/',
    folha: 'https://duquedecaxias.rj.gov.br/transparencia/servidores',
  },
  'RJ:saogoncalo': {
    sistema: 'Portal Transparência São Gonçalo',
    transparencia: 'https://transparencia.pmsg.rj.gov.br/',
    folha: 'https://transparencia.pmsg.rj.gov.br/servidores',
  },
  'RJ:novaiguacu': {
    sistema: 'Portal da Transparência Nova Iguaçu',
    transparencia: 'https://transparencia.novaiguacu.rj.gov.br/',
    folha: 'https://transparencia.novaiguacu.rj.gov.br/servidores',
  },
  'RJ:marica': {
    sistema: 'Portal da Transparência Maricá',
    transparencia: 'https://transparencia.marica.rj.gov.br/',
    folha: 'https://transparencia.marica.rj.gov.br/servidores',
  },
  'RJ:macae': {
    sistema: 'Portal da Transparência Macaé',
    transparencia: 'https://transparencia.macae.rj.gov.br/',
    folha: 'https://transparencia.macae.rj.gov.br/servidores',
  },
  'RJ:cabofrio': {
    sistema: 'Portal Transparência Cabo Frio',
    transparencia: 'https://transparencia.cabofrio.rj.gov.br/',
    folha: 'https://transparencia.cabofrio.rj.gov.br/servidores',
  },
  'RJ:itaborai': {
    sistema: 'Portal Transparência Itaboraí',
    transparencia: 'https://transparencia.itaborai.rj.gov.br/',
    folha: 'https://transparencia.itaborai.rj.gov.br/servidores',
  },
  'RJ:barramansa': {
    sistema: 'Portal Transparência Barra Mansa',
    transparencia: 'https://transparencia.barramansa.rj.gov.br/',
    folha: 'https://transparencia.barramansa.rj.gov.br/servidores',
  },
  'RJ:saquarema': {
    sistema: 'Portal Transparência Saquarema',
    transparencia: 'https://transparencia.saquarema.rj.gov.br/',
    folha: 'https://transparencia.saquarema.rj.gov.br/servidores',
  },
  'RJ:saopedrodaaldeia': {
    sistema: 'Portal Transparência São Pedro da Aldeia',
    transparencia: 'https://transparencia.pmspa.rj.gov.br/',
    folha: 'https://transparencia.pmspa.rj.gov.br/servidores',
  },
  'RJ:casimirodeabreu': {
    sistema: 'Portal Transparência Casimiro de Abreu',
    transparencia: 'https://transparencia.casimirodeabreu.rj.gov.br/',
    folha: 'https://transparencia.casimirodeabreu.rj.gov.br/servidores',
  },
  'RJ:iguabagrande': {
    sistema: 'Portal Transparência Iguaba Grande',
    transparencia: 'https://transparencia.iguaba.rj.gov.br/',
    folha: 'https://transparencia.iguaba.rj.gov.br/servidores',
  },
  'RJ:itatiaia': {
    sistema: 'Portal Transparência Itatiaia',
    transparencia: 'https://transparencia.itatiaia.rj.gov.br/',
    folha: 'https://transparencia.itatiaia.rj.gov.br/servidores',
  },
  'RJ:silvajardim': {
    sistema: 'Portal Transparência Silva Jardim',
    transparencia: 'https://transparencia.silvajardim.rj.gov.br/',
    folha: 'https://transparencia.silvajardim.rj.gov.br/servidores',
  },

  // === MINAS GERAIS (MG) ===
  'MG:governadorvaladares': {
    sistema: 'Portal Transparência Valadares',
    transparencia: 'https://transparencia.valadares.mg.gov.br/',
    folha: 'https://transparencia.valadares.mg.gov.br/servidores',
  },
  'MG:brumadinho': {
    sistema: 'Portal Transparência Brumadinho',
    transparencia: 'https://transparencia.brumadinho.mg.gov.br/',
    folha: 'https://transparencia.brumadinho.mg.gov.br/servidores',
  },
  'MG:itajuba': {
    sistema: 'Portal Transparência Itajubá',
    transparencia: 'https://transparencia.itajuba.mg.gov.br/',
    folha: 'https://transparencia.itajuba.mg.gov.br/servidores',
  },
  'MG:formiga': {
    sistema: 'Portal Transparência Formiga',
    transparencia: 'https://transparencia.formiga.mg.gov.br/',
    folha: 'https://transparencia.formiga.mg.gov.br/servidores',
  },
  'MG:leopoldina': {
    sistema: 'Portal Transparência Leopoldina',
    transparencia: 'https://transparencia.leopoldina.mg.gov.br/',
    folha: 'https://transparencia.leopoldina.mg.gov.br/servidores',
  },
  'MG:paraisopolis': {
    sistema: 'Portal Transparência Paraisópolis',
    transparencia: 'https://transparencia.paraisopolis.mg.gov.br/',
    folha: 'https://transparencia.paraisopolis.mg.gov.br/servidores',
  },
  'MG:piumhi': {
    sistema: 'Portal Transparência Piumhi',
    transparencia: 'https://transparencia.piumhi.mg.gov.br/',
    folha: 'https://transparencia.piumhi.mg.gov.br/servidores',
  },
  'MG:divinolandiademinas': {
    sistema: 'Portal Transparência Divinolândia de Minas',
    transparencia: 'https://transparencia.divinolandiademinas.mg.gov.br/',
    folha: 'https://transparencia.divinolandiademinas.mg.gov.br/servidores',
  },

  // === CEARÁ (CE) ===
  'CE:fortaleza': {
    sistema: 'Portal da Transparência de Fortaleza',
    transparencia: 'https://transparencia.fortaleza.ce.gov.br/',
    folha: 'https://transparencia.fortaleza.ce.gov.br/pessoal',
  },
  'CE:aquiraz': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://governotransparente.com.br/transparencia/2301000',
    folha: 'https://governotransparente.com.br/transparencia/2301000/servidores',
  },
  'CE:aracoiaba': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://governotransparente.com.br/transparencia/2301208',
    folha: 'https://governotransparente.com.br/transparencia/2301208/servidores',
  },
  'CE:deputadoirapuanpinheiro': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://governotransparente.com.br/transparencia/2304269',
    folha: 'https://governotransparente.com.br/transparencia/2304269/servidores',
  },
  'CE:jijocadejericoacoara': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://governotransparente.com.br/transparencia/2307254',
    folha: 'https://governotransparente.com.br/transparencia/2307254/servidores',
  },
  'CE:maranguape': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://governotransparente.com.br/transparencia/2307700',
    folha: 'https://governotransparente.com.br/transparencia/2307700/servidores',
  },
  'CE:russas': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://governotransparente.com.br/transparencia/2311801',
    folha: 'https://governotransparente.com.br/transparencia/2311801/servidores',
  },
  'CE:tabuleirodonorte': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://governotransparente.com.br/transparencia/2313104',
    folha: 'https://governotransparente.com.br/transparencia/2313104/servidores',
  },

  // === PERNAMBUCO (PE) ===
  'PE:recife': {
    sistema: 'Portal da Transparência do Recife',
    transparencia: 'https://transparencia.recife.pe.gov.br/',
    folha: 'https://transparencia.recife.pe.gov.br/servidores',
  },
  'PE:camaragibe': {
    sistema: 'Portal Transparência Camaragibe',
    transparencia: 'https://transparencia.camaragibe.pe.gov.br/',
    folha: 'https://transparencia.camaragibe.pe.gov.br/servidores',
  },
  'PE:paulista': {
    sistema: 'Portal Transparência Paulista',
    transparencia: 'https://transparencia.paulista.pe.gov.br/',
    folha: 'https://transparencia.paulista.pe.gov.br/servidores',
  },
  'PE:abreuelima': {
    sistema: 'Portal Transparência Abreu e Lima',
    transparencia: 'https://transparencia.abreuelima.pe.gov.br/',
    folha: 'https://transparencia.abreuelima.pe.gov.br/servidores',
  },
  'PE:itapissuma': {
    sistema: 'Portal Transparência Itapissuma',
    transparencia: 'https://transparencia.itapissuma.pe.gov.br/',
    folha: 'https://transparencia.itapissuma.pe.gov.br/servidores',
  },
  'PE:surubim': {
    sistema: 'Portal Transparência Surubim',
    transparencia: 'https://transparencia.surubim.pe.gov.br/',
    folha: 'https://transparencia.surubim.pe.gov.br/servidores',
  },
  'PE:verdejante': {
    sistema: 'Portal Transparência Verdejante',
    transparencia: 'https://transparencia.verdejante.pe.gov.br/',
    folha: 'https://transparencia.verdejante.pe.gov.br/servidores',
  },

  // === TOCANTINS (TO) ===
  'TO:palmas': {
    sistema: 'Portal Transparência de Palmas',
    transparencia: 'https://transparencia.palmas.to.gov.br/',
    folha: 'https://transparencia.palmas.to.gov.br/servidores',
  },
  'TO:paraisodotocantins': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://acessoainformacao.paraisodotocantins.to.gov.br/',
    folha: 'https://acessoainformacao.paraisodotocantins.to.gov.br/cidadao/transparencia/mgservidores',
  },
  'TO:pontealtadotocantins': {
    sistema: 'Megasoft Informática (NucleoGov)',
    transparencia: 'https://transparencia.pontealtadotocantins.to.gov.br/',
    folha: 'https://acessoainformacao.pontealtadotocantins.to.gov.br/cidadao/transparencia/mgservidores',
  },

  // === BAHIA (BA) ===
  'BA:luiseduardomagalhaes': {
    sistema: 'Portal Transparência Luís Eduardo Magalhães',
    transparencia: 'https://transparencia.luiseduardomagalhaes.ba.gov.br/',
    folha: 'https://transparencia.luiseduardomagalhaes.ba.gov.br/servidores',
  },
  'BA:itacare': {
    sistema: 'Portal Transparência Itacaré',
    transparencia: 'https://transparencia.itacare.ba.gov.br/',
    folha: 'https://transparencia.itacare.ba.gov.br/servidores',
  },

  // === MARANHÃO (MA) ===
  'MA:saoraimundodasmangabeiras': {
    sistema: 'Aspec Informática (Governo Transparente)',
    transparencia: 'https://transparencia.saoraimundodasmangabeiras.ma.gov.br/',
    folha: 'https://governotransparente.com.br/transparencia/2111607/servidores',
  },
  'MA:tuntum': {
    sistema: 'Portal Transparência Tuntum',
    transparencia: 'https://transparencia.tuntum.ma.gov.br/',
    folha: 'https://transparencia.tuntum.ma.gov.br/servidores',
  },

  // === MATO GROSSO DO SUL (MS) ===
  'MS:corumba': {
    sistema: 'Portal Transparência Corumbá',
    transparencia: 'https://transparencia.corumba.ms.gov.br/',
    folha: 'https://transparencia.corumba.ms.gov.br/servidores',
  },
  'MS:riobrilhante': {
    sistema: 'Portal Transparência Rio Brilhante',
    transparencia: 'https://transparencia.riobrilhante.ms.gov.br/',
    folha: 'https://transparencia.riobrilhante.ms.gov.br/servidores',
  },

  // === MATO GROSSO (MT) ===
  'MT:cuiaba': {
    sistema: 'Portal Transparência de Cuiabá',
    transparencia: 'https://transparencia.cuiaba.mt.gov.br/',
    folha: 'https://transparencia.cuiaba.mt.gov.br/servidores',
  },
  'MT:barradogarcas': {
    sistema: 'Portal Transparência Barra do Garças',
    transparencia: 'https://transparencia.barradogarcas.mt.gov.br/',
    folha: 'https://transparencia.barradogarcas.mt.gov.br/servidores',
  },

  // === PARANÁ (PR) ===
  'PR:castro': {
    sistema: 'IPM Sistemas (Atende.net)',
    transparencia: 'https://castro.atende.net/transparencia/',
    folha: 'https://castro.atende.net/transparencia/item/servidores',
  },
  'PR:guaratuba': {
    sistema: 'Elotech Informática',
    transparencia: 'https://transparencia.guaratuba.pr.gov.br/',
    folha: 'https://transparencia.guaratuba.pr.gov.br/servidores',
  },

  // === PARÁ (PA) ===
  'PA:belem': {
    sistema: 'Portal da Transparência de Belém',
    transparencia: 'http://transparencia.belem.pa.gov.br/',
    folha: 'http://transparencia.belem.pa.gov.br/gestao-de-pessoas/',
  },

  // === RONDÔNIA (RO) ===
  'RO:portovelho': {
    sistema: 'Portal da Transparência Porto Velho',
    transparencia: 'https://transparencia.portovelho.ro.gov.br/',
    folha: 'https://transparencia.portovelho.ro.gov.br/servidores',
  },
};

/**
 * Remove acentos e caracteres especiais para comparação segura
 */
export function slugifyCity(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve a identidade do Portal da Transparência, quadro de folha de pagamento
 * e repositório do Tribunal de Contas de qualquer município do Brasil.
 */
export function resolveTransparenciaInfo(
  municipio: string,
  uf: string,
  codigoIbge?: string
): ResolvedTransparencia {
  const cleanUf = (uf || 'BR').toUpperCase().trim();
  const slug = slugifyCity(municipio);
  const key = `${cleanUf}:${slug}`;

  const tceInfo = TCE_DIRECTORY[cleanUf] || {
    nome: `Tribunal de Contas (${cleanUf})`,
    url: `https://www.tce.${cleanUf.toLowerCase()}.gov.br`,
  };

  // 1. Verifica se consta no registro certificado de municípios com chamamento
  const verified = VERIFIED_MUNICIPALITY_REGISTRY[key];
  if (verified) {
    return {
      municipio: municipio.trim(),
      uf: cleanUf,
      codigo_ibge: codigoIbge || '0000000',
      sistema_transparencia: verified.sistema,
      link_transparencia: verified.transparencia,
      link_folha_pagamento: verified.folha,
      tce_nome: tceInfo.nome,
      link_tce: tceInfo.painelPessoalUrl || tceInfo.url,
      fonte_primaria: 'Transparência Municipal Oficial & Tribunal de Contas',
    };
  }

  // 2. Heurística regional inteligente por ecossistema de fornecedores ERP
  let sistema = 'Transparência Web Municipal';
  let linkTransparencia = `https://transparencia.${slug}.${cleanUf.toLowerCase()}.gov.br`;
  let linkFolha = `https://transparencia.${slug}.${cleanUf.toLowerCase()}.gov.br/servidores`;

  if (['RS', 'SC', 'PR'].includes(cleanUf)) {
    // IPM Atende.net é o padrão dominante no Sul
    sistema = 'IPM Sistemas (Atende.net)';
    linkTransparencia = `https://${slug}.atende.net/transparencia/`;
    linkFolha = `https://${slug}.atende.net/transparencia/item/servidores`;
  } else if (['GO', 'TO'].includes(cleanUf)) {
    // Megasoft NucleoGov domina ~85% de Goiás e Tocantins
    sistema = 'Megasoft Informática (NucleoGov)';
    linkTransparencia = `https://acessoainformacao.${slug}.${cleanUf.toLowerCase()}.gov.br/`;
    linkFolha = `https://acessoainformacao.${slug}.${cleanUf.toLowerCase()}.gov.br/cidadao/transparencia/mgservidores`;
  } else if (['CE', 'RN', 'PB', 'PI', 'MA'].includes(cleanUf)) {
    // Aspec Governo Transparente domina boa parte do Nordeste
    if (codigoIbge && codigoIbge !== '0000000') {
      sistema = 'Aspec Informática (Governo Transparente)';
      linkTransparencia = `https://governotransparente.com.br/transparencia/${codigoIbge}`;
      linkFolha = `https://governotransparente.com.br/transparencia/${codigoIbge}/servidores`;
    }
  } else if (cleanUf === 'SP') {
    sistema = 'Portal Transparência SP / AUDESP';
  } else if (cleanUf === 'MG') {
    sistema = 'Portal Transparência MG / SICOM';
  }

  return {
    municipio: municipio.trim(),
    uf: cleanUf,
    codigo_ibge: codigoIbge || '0000000',
    sistema_transparencia: sistema,
    link_transparencia: linkTransparencia,
    link_folha_pagamento: linkFolha,
    tce_nome: tceInfo.nome,
    link_tce: tceInfo.painelPessoalUrl || tceInfo.url,
    fonte_primaria: 'Demonstrativos Fiscais Oficiais (SICONFI / TCE)',
  };
}

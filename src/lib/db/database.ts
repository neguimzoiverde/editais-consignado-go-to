import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BRAZIL_STATES, type BrazilUF } from '../config.js';

export interface Edital {
  id: string;
  // 16 Colunas de Negócio Oficiais do Departamento
  municipio: string;
  numero_edital: string;
  ano: number;
  objeto: string;
  tem_emprestimo: 'Sim' | 'Não';
  tipo_cartao: 'Cartão Consignado' | 'Cartão Benefício' | 'Ambos' | 'Não';
  situacao: 'aberto' | 'em andamento' | 'encerrado' | 'suspenso' | 'retificado' | 'não informada';
  prazo_credenciamento: string;
  bancos_credenciados: string;
  sistema_averbacao: string;
  margem_consignavel: string;
  prazo_maximo: string;
  taxa_limitacao: string;
  documentacao_exigida: string;
  contato_orgao: string;
  link_edital: string;
  link_chamamento?: string | null;     // 1º Grau de Importância: Documento Direto do Chamamento
  link_portal_compras?: string | null; // 2º Grau de Importância: Portal de Compras / Prefeitura

  // Metadados técnicos adicionais
  uf: BrazilUF | string;
  regiao: string;
  orgao: string;
  modalidade: string;
  is_chamamento: number; // 1 = Sim, 0 = Não
  data_publicacao: string; // ISO ou DD/MM/AAAA
  data_encerramento: string; // ISO ou DD/MM/AAAA ou 'fluxo contínuo'
  link_fonte: string;
  portal_prefeitura_url?: string;
  origem: string;
  historico?: string;
  created_at: string;
  updated_at: string;
  is_new: number;
}

export interface PrefeituraCatalogo {
  codigo_ibge: string;
  municipio: string;
  uf: string;
  regiao: string;
  portal_url?: string;
  licitacoes_url?: string;
  chamamentos_url?: string;
  sistema_licitacao?: string;
  status_catalogo: 'catalogado' | 'pendente' | 'erro';
  ultima_verificacao?: string;
  total_editais_encontrados: number;
}

export interface PrefeituraFolhaStats {
  codigo_ibge: string;
  municipio: string;
  uf: string;
  regiao: string;
  competencia: string;
  total_servidores: number;
  total_efetivos: number;
  total_aposentados: number;
  total_pensionistas: number;
  total_comissionados: number;
  total_temporarios: number;
  total_outros: number;
  elegiveis_consignado: number;
  elegiveis_pct: number;
  valor_folha_bruta: number;
  valor_folha_liquida: number;
  potencial_margem_35: number;
  potencial_cartao_5: number;
  fonte_dados: string;
  sistema_transparencia?: string | null;
  link_transparencia?: string | null;
  link_folha_pagamento?: string | null;
  link_tce?: string | null;
  updated_at: string;
}

export interface ServidorAmostra {
  id: string;
  codigo_ibge: string;
  municipio: string;
  uf: string;
  nome: string;
  matricula?: string | null;
  cargo?: string | null;
  orgao?: string | null;
  tipo_vinculo?: string | null;
  vinculo_padronizado: string;
  remuneracao_bruta: number;
  remuneracao_liquida: number;
  margem_estimada: number;
  competencia?: string | null;
  updated_at: string;
}

export interface SyncLog {
  id?: number;
  timestamp: string;
  total_found: number;
  new_count: number;
  updated_count: number;
  status: 'success' | 'warning' | 'error';
  message: string;
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = process.env.DB_PATH || path.join(dbDir, 'editais.db');
  const db = new DatabaseSync(dbPath);

  // Inicializa esquemas
  db.exec(`
    CREATE TABLE IF NOT EXISTS editais (
      id TEXT PRIMARY KEY,
      numero_edital TEXT,
      ano INTEGER,
      uf TEXT,
      regiao TEXT,
      municipio TEXT,
      orgao TEXT,
      objeto TEXT,
      modalidade TEXT,
      is_chamamento INTEGER DEFAULT 1,
      tem_emprestimo TEXT DEFAULT 'Sim',
      tipo_cartao TEXT DEFAULT 'Não',
      data_publicacao TEXT,
      data_encerramento TEXT,
      prazo_credenciamento TEXT,
      bancos_credenciados TEXT DEFAULT 'A apurar / Em habilitação',
      sistema_averbacao TEXT DEFAULT 'A apurar na entidade',
      margem_consignavel TEXT DEFAULT '35% empréstimo + 5% cartão',
      prazo_maximo TEXT DEFAULT '96 a 120 meses',
      taxa_limitacao TEXT DEFAULT 'Teto BACEN / Fixado em edital',
      documentacao_exigida TEXT DEFAULT 'Habilitação Jurídica e Regularidade Fiscal',
      contato_orgao TEXT,
      situacao TEXT,
      link_fonte TEXT,
      link_edital TEXT,
      portal_prefeitura_url TEXT,
      origem TEXT,
      historico TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_new INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS prefeituras (
      codigo_ibge TEXT PRIMARY KEY,
      municipio TEXT NOT NULL,
      uf TEXT NOT NULL,
      regiao TEXT NOT NULL,
      portal_url TEXT,
      licitacoes_url TEXT,
      chamamentos_url TEXT,
      sistema_licitacao TEXT,
      status_catalogo TEXT DEFAULT 'pendente',
      ultima_verificacao TEXT,
      total_editais_encontrados INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      total_found INTEGER,
      new_count INTEGER,
      updated_count INTEGER,
      status TEXT,
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      email TEXT NOT NULL,
      success INTEGER NOT NULL,
      attempted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prefeituras_folha_stats (
      codigo_ibge TEXT PRIMARY KEY,
      municipio TEXT NOT NULL,
      uf TEXT NOT NULL,
      regiao TEXT NOT NULL,
      competencia TEXT,
      total_servidores INTEGER DEFAULT 0,
      total_efetivos INTEGER DEFAULT 0,
      total_aposentados INTEGER DEFAULT 0,
      total_pensionistas INTEGER DEFAULT 0,
      total_comissionados INTEGER DEFAULT 0,
      total_temporarios INTEGER DEFAULT 0,
      total_outros INTEGER DEFAULT 0,
      elegiveis_consignado INTEGER DEFAULT 0,
      elegiveis_pct REAL DEFAULT 0.0,
      valor_folha_bruta REAL DEFAULT 0.0,
      valor_folha_liquida REAL DEFAULT 0.0,
      potencial_margem_35 REAL DEFAULT 0.0,
      potencial_cartao_5 REAL DEFAULT 0.0,
      fonte_dados TEXT DEFAULT 'Transparência Municipal',
      link_transparencia TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS servidores_amostra (
      id TEXT PRIMARY KEY,
      codigo_ibge TEXT,
      municipio TEXT NOT NULL,
      uf TEXT NOT NULL,
      nome TEXT NOT NULL,
      matricula TEXT,
      cargo TEXT,
      orgao TEXT,
      tipo_vinculo TEXT,
      vinculo_padronizado TEXT,
      remuneracao_bruta REAL DEFAULT 0.0,
      remuneracao_liquida REAL DEFAULT 0.0,
      margem_estimada REAL DEFAULT 0.0,
      competencia TEXT,
      updated_at TEXT
    );
  `);

  // Migrações seguras de colunas caso o banco já existisse
  const safeAddColumn = (colDef: string) => {
    try {
      db.exec(`ALTER TABLE editais ADD COLUMN ${colDef};`);
    } catch {
      // Coluna já existe
    }
  };

  safeAddColumn("ano INTEGER DEFAULT 2026");
  safeAddColumn("regiao TEXT DEFAULT 'Centro-Oeste'");
  safeAddColumn("is_chamamento INTEGER DEFAULT 1");
  safeAddColumn("tem_emprestimo TEXT DEFAULT 'Sim'");
  safeAddColumn("tipo_cartao TEXT DEFAULT 'Não'");
  safeAddColumn("prazo_credenciamento TEXT");
  safeAddColumn("bancos_credenciados TEXT DEFAULT 'A apurar / Em habilitação'");
  safeAddColumn("sistema_averbacao TEXT DEFAULT 'A apurar na entidade'");
  safeAddColumn("margem_consignavel TEXT DEFAULT '35% empréstimo + 5% cartão'");
  safeAddColumn("prazo_maximo TEXT DEFAULT '96 a 120 meses'");
  safeAddColumn("taxa_limitacao TEXT DEFAULT 'Teto BACEN / Fixado em edital'");
  safeAddColumn("documentacao_exigida TEXT DEFAULT 'Habilitação Jurídica e Regularidade Fiscal'");
  safeAddColumn("contato_orgao TEXT");
  safeAddColumn("portal_prefeitura_url TEXT");
  safeAddColumn("link_chamamento TEXT");
  safeAddColumn("link_portal_compras TEXT");

  // Migrações da tabela prefeituras_folha_stats
  const safeAddFolhaColumn = (colDef: string) => {
    try {
      db.exec(`ALTER TABLE prefeituras_folha_stats ADD COLUMN ${colDef};`);
    } catch {
      // Coluna já existe
    }
  };
  safeAddFolhaColumn("sistema_transparencia TEXT DEFAULT 'Transparência Municipal'");
  safeAddFolhaColumn("link_folha_pagamento TEXT");
  safeAddFolhaColumn("link_tce TEXT");

  // Índices (executados após garantir todas as colunas)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_editais_uf ON editais(uf);
    CREATE INDEX IF NOT EXISTS idx_editais_situacao ON editais(situacao);
    CREATE INDEX IF NOT EXISTS idx_editais_pub ON editais(data_publicacao);
    CREATE INDEX IF NOT EXISTS idx_editais_chamamento ON editais(is_chamamento);
    CREATE INDEX IF NOT EXISTS idx_pref_uf ON prefeituras(uf);
    CREATE INDEX IF NOT EXISTS idx_pref_status ON prefeituras(status_catalogo);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token_exp ON sessions(token, expires_at);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, attempted_at);
    CREATE INDEX IF NOT EXISTS idx_folha_uf ON prefeituras_folha_stats(uf);
    CREATE INDEX IF NOT EXISTS idx_folha_mun ON prefeituras_folha_stats(municipio);
    CREATE INDEX IF NOT EXISTS idx_folha_serv ON prefeituras_folha_stats(total_servidores);
    CREATE INDEX IF NOT EXISTS idx_folha_margem ON prefeituras_folha_stats(potencial_margem_35);
    CREATE INDEX IF NOT EXISTS idx_serv_ibge ON servidores_amostra(codigo_ibge);
    CREATE INDEX IF NOT EXISTS idx_serv_nome ON servidores_amostra(nome);
    CREATE INDEX IF NOT EXISTS idx_serv_vinculo ON servidores_amostra(vinculo_padronizado);
  `);

  // Semente do superusuário inicial
  seedSuperuser(db);

  // Semente inicial de estatísticas de folha dos municípios com editais
  seedInitialFolhaStats(db);

  dbInstance = db;
  return db;
}

/**
 * Garante a criação do superusuário inicial caso não exista,
 * com hash scrypt criptograficamente seguro e salt individual.
 */
function seedSuperuser(db: DatabaseSync): void {
  const superuserEmail = 'rodrigo.pwn@gmail.com';
  const superuserPass = '$irius4lphA2027';

  try {
    const checkStmt = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = checkStmt.get(superuserEmail);

    if (!existing) {
      const salt = crypto.randomBytes(16).toString('hex');
      const derivedKey = crypto.scryptSync(superuserPass, salt, 64);
      const hash = `${salt}:${derivedKey.toString('hex')}`;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, created_at)
        VALUES (?, ?, ?, 'admin', ?)
      `).run(id, superuserEmail, hash, now);
      console.log(`[AUTH] Superusuário ${superuserEmail} registrado com sucesso.`);
    }
  } catch (err) {
    console.error('[AUTH] Erro ao verificar/criar superusuário:', err);
  }
}

export function upsertEdital(item: Partial<Edital> & Pick<Edital, 'id' | 'objeto' | 'orgao' | 'uf' | 'link_fonte'>): { isNew: boolean; isUpdated: boolean } {
  const db = getDb();
  const now = new Date().toISOString();

  // Garante valores padrão inteligentes
  const ano = item.ano || new Date().getFullYear();
  const isChamamento = item.is_chamamento !== undefined ? item.is_chamamento : 1;
  const temEmprestimo = item.tem_emprestimo || 'Sim';
  const tipoCartao = item.tipo_cartao || 'Não';
  const prazoCred = item.prazo_credenciamento || item.data_encerramento || 'Fluxo Contínuo';
  const regiao = item.regiao || 'Brasil';

  const existingStmt = db.prepare('SELECT id, situacao, objeto, data_encerramento FROM editais WHERE id = ?');
  const existing = existingStmt.get(item.id) as { id: string; situacao: string; objeto: string; data_encerramento: string } | undefined;

  if (!existing) {
    const insertStmt = db.prepare(`
      INSERT INTO editais (
        id, numero_edital, ano, uf, regiao, municipio, orgao, objeto, modalidade,
        is_chamamento, tem_emprestimo, tipo_cartao, data_publicacao, data_encerramento,
        prazo_credenciamento, bancos_credenciados, sistema_averbacao, margem_consignavel,
        prazo_maximo, taxa_limitacao, documentacao_exigida, contato_orgao, situacao,
        link_fonte, link_edital, portal_prefeitura_url, link_chamamento, link_portal_compras,
        origem, historico, created_at, updated_at, is_new
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertStmt.run(
      item.id,
      item.numero_edital || 'não informado',
      ano,
      item.uf,
      regiao,
      item.municipio || 'Não informado',
      item.orgao,
      item.objeto,
      item.modalidade || 'Credenciamento / Chamamento',
      isChamamento,
      temEmprestimo,
      tipoCartao,
      item.data_publicacao || 'não informado na fonte consultada',
      item.data_encerramento || 'não informado na fonte consultada',
      prazoCred,
      item.bancos_credenciados || 'A apurar / Em habilitação',
      item.sistema_averbacao || 'A apurar na entidade',
      item.margem_consignavel || '35% empréstimo + 5% cartão',
      item.prazo_maximo || '96 a 120 meses',
      item.taxa_limitacao || 'Teto BACEN / Fixado em edital',
      item.documentacao_exigida || 'Habilitação Jurídica e Regularidade Fiscal',
      item.contato_orgao || item.orgao,
      item.situacao || 'aberto',
      item.link_fonte,
      item.link_edital || item.link_fonte,
      item.portal_prefeitura_url || '',
      item.link_chamamento ?? null,
      item.link_portal_compras ?? null,
      item.origem || 'PNCP',
      JSON.stringify([{ date: now, event: 'Registro inicial capturado' }]),
      now,
      now
    );
    return { isNew: true, isUpdated: false };
  } else {
    const changed = existing.situacao !== item.situacao || existing.data_encerramento !== item.data_encerramento;
    const updateStmt = db.prepare(`
      UPDATE editais SET
        numero_edital = ?,
        ano = ?,
        uf = ?,
        regiao = ?,
        municipio = ?,
        orgao = ?,
        objeto = ?,
        modalidade = ?,
        is_chamamento = ?,
        tem_emprestimo = ?,
        tipo_cartao = ?,
        data_publicacao = ?,
        data_encerramento = ?,
        prazo_credenciamento = ?,
        bancos_credenciados = COALESCE(?, bancos_credenciados),
        sistema_averbacao = COALESCE(?, sistema_averbacao),
        margem_consignavel = COALESCE(?, margem_consignavel),
        prazo_maximo = COALESCE(?, prazo_maximo),
        taxa_limitacao = COALESCE(?, taxa_limitacao),
        documentacao_exigida = COALESCE(?, documentacao_exigida),
        contato_orgao = COALESCE(?, contato_orgao),
        situacao = ?,
        link_fonte = ?,
        link_edital = ?,
        portal_prefeitura_url = COALESCE(?, portal_prefeitura_url),
        link_chamamento = COALESCE(?, link_chamamento),
        link_portal_compras = COALESCE(?, link_portal_compras),
        origem = ?,
        updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      item.numero_edital || 'não informado',
      ano,
      item.uf,
      regiao,
      item.municipio || 'Não informado',
      item.orgao,
      item.objeto,
      item.modalidade || 'Credenciamento / Chamamento',
      isChamamento,
      temEmprestimo,
      tipoCartao,
      item.data_publicacao || 'não informado na fonte consultada',
      item.data_encerramento || 'não informado na fonte consultada',
      prazoCred,
      item.bancos_credenciados ?? null,
      item.sistema_averbacao ?? null,
      item.margem_consignavel ?? null,
      item.prazo_maximo ?? null,
      item.taxa_limitacao ?? null,
      item.documentacao_exigida ?? null,
      item.contato_orgao ?? null,
      item.situacao || 'aberto',
      item.link_fonte || '',
      item.link_edital || item.link_fonte || '',
      item.portal_prefeitura_url ?? null,
      item.link_chamamento ?? null,
      item.link_portal_compras ?? null,
      item.origem || 'PNCP',
      now,
      item.id
    );
    return { isNew: false, isUpdated: changed };
  }
}

export function listEditais(filters?: {
  uf?: string;
  regiao?: string;
  situacao?: string;
  somente_chamamento?: boolean;
  search?: string;
}): Edital[] {
  const db = getDb();
  let query = 'SELECT * FROM editais WHERE 1=1';
  const params: any[] = [];

  if (filters?.uf && filters.uf !== 'ALL') {
    query += ' AND uf = ?';
    params.push(filters.uf);
  }

  if (filters?.regiao && filters.regiao !== 'ALL') {
    query += ' AND regiao = ?';
    params.push(filters.regiao);
  }

  if (filters?.situacao && filters.situacao !== 'ALL') {
    query += ' AND situacao = ?';
    params.push(filters.situacao);
  }

  if (filters?.somente_chamamento) {
    query += ' AND is_chamamento = 1';
  }

  if (filters?.search && filters.search.trim()) {
    query += ' AND (objeto LIKE ? OR municipio LIKE ? OR orgao LIKE ? OR numero_edital LIKE ? OR sistema_averbacao LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  query += ' ORDER BY data_publicacao DESC, updated_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as unknown as Edital[];
}

export function upsertPrefeitura(p: PrefeituraCatalogo) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO prefeituras (
      codigo_ibge, municipio, uf, regiao, portal_url, licitacoes_url,
      chamamentos_url, sistema_licitacao, status_catalogo, ultima_verificacao, total_editais_encontrados
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(codigo_ibge) DO UPDATE SET
      portal_url = COALESCE(excluded.portal_url, portal_url),
      licitacoes_url = COALESCE(excluded.licitacoes_url, licitacoes_url),
      chamamentos_url = COALESCE(excluded.chamamentos_url, chamamentos_url),
      sistema_licitacao = COALESCE(excluded.sistema_licitacao, sistema_licitacao),
      status_catalogo = excluded.status_catalogo,
      ultima_verificacao = excluded.ultima_verificacao,
      total_editais_encontrados = excluded.total_editais_encontrados
  `);
  stmt.run(
    p.codigo_ibge,
    p.municipio,
    p.uf,
    p.regiao,
    p.portal_url || null,
    p.licitacoes_url || null,
    p.chamamentos_url || null,
    p.sistema_licitacao || 'padrao_gov',
    p.status_catalogo,
    p.ultima_verificacao || new Date().toISOString(),
    p.total_editais_encontrados || 0
  );
}

export function listPrefeituras(filters?: { uf?: string; regiao?: string; status?: string; search?: string }): PrefeituraCatalogo[] {
  const db = getDb();
  let query = 'SELECT * FROM prefeituras WHERE 1=1';
  const params: any[] = [];

  if (filters?.uf && filters.uf !== 'ALL') {
    query += ' AND uf = ?';
    params.push(filters.uf);
  }

  if (filters?.regiao && filters.regiao !== 'ALL') {
    query += ' AND regiao = ?';
    params.push(filters.regiao);
  }

  if (filters?.status && filters.status !== 'ALL') {
    query += ' AND status_catalogo = ?';
    params.push(filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    query += ' AND (municipio LIKE ? OR codigo_ibge LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term);
  }

  query += ' ORDER BY uf ASC, municipio ASC';
  const stmt = db.prepare(query);
  return stmt.all(...params) as unknown as PrefeituraCatalogo[];
}

export function getStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as count FROM editais').get() as { count: number }).count;
  const totalChamamentos = (db.prepare('SELECT COUNT(*) as count FROM editais WHERE is_chamamento = 1').get() as { count: number }).count;
  const abertosBrasil = (db.prepare("SELECT COUNT(*) as count FROM editais WHERE situacao IN ('aberto', 'em andamento')").get() as { count: number }).count;
  const prefeiturasCatalogadas = (db.prepare("SELECT COUNT(*) as count FROM prefeituras").get() as { count: number }).count;
  const novosHoje = (db.prepare("SELECT COUNT(*) as count FROM editais WHERE is_new = 1 AND date(created_at) = date('now')").get() as { count: number }).count;

  return { total, totalChamamentos, abertosBrasil, prefeiturasCatalogadas, novosHoje };
}

export function logSync(data: Omit<SyncLog, 'id'>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sync_history (timestamp, total_found, new_count, updated_count, status, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(data.timestamp, data.total_found, data.new_count, data.updated_count, data.status, data.message);
}

export function getLastSync(): SyncLog | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sync_history ORDER BY id DESC LIMIT 1').get();
  return (row as unknown as SyncLog) || null;
}

export interface ProcessLinks {
  // 1º Grau de Importância: Chamamento Público (Documento Direto)
  linkChamamento: string | null;
  chamamentoStatus: 'encontrado' | 'nao_encontrado';
  chamamentoLabel: string;

  // 2º Grau de Importância: Portal de Compras Públicas / Portal da Prefeitura
  linkPortalCompras: string | null;
  portalComprasStatus: 'encontrado' | 'nao_encontrado';
  portalComprasLabel: string;

  // 3º Grau de Importância: Edital / PNCP
  linkEdital: string | null;
  editalStatus: 'encontrado' | 'nao_encontrado';
  editalLabel: string;
}

export function resolveProcessLinks(item: {
  link_chamamento?: string | null;
  link_portal_compras?: string | null;
  link_edital?: string | null;
  link_fonte?: string | null;
  portal_prefeitura_url?: string | null;
  origem?: string | null;
}): ProcessLinks {
  const isDirectDoc = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('/arquivos/') ||
      lower.includes('.pdf') ||
      lower.includes('.zip') ||
      lower.includes('/sgdispensa/') ||
      lower.includes('/licitacao/id=') ||
      lower.includes('download')
    );
  };

  const isComprasPortal = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('compraspublicas.com.br') ||
      lower.includes('compras.gov.br') ||
      lower.includes('comprasnet') ||
      lower.includes('bllcompras.com') ||
      lower.includes('bll.org.br') ||
      lower.includes('licitanet.com.br') ||
      lower.includes('bbmnet.com.br') ||
      lower.includes('licitacoes-e.com.br') ||
      lower.includes('prefeitura') ||
      lower.includes('.gov.br')
    ) && !lower.includes('pncp.gov.br/app/editais');
  };

  // 1º Grau de Importância: Chamamento Público (Documento Direto)
  let chamamentoUrl: string | null = null;
  if (item.link_chamamento && item.link_chamamento.trim().startsWith('http')) {
    chamamentoUrl = item.link_chamamento.trim();
  } else if (isDirectDoc(item.link_fonte)) {
    chamamentoUrl = item.link_fonte!.trim();
  } else if (isDirectDoc(item.link_edital)) {
    chamamentoUrl = item.link_edital!.trim();
  }

  // 2º Grau de Importância: Portal de Compras Públicas / Portal da Prefeitura
  let portalComprasUrl: string | null = null;
  if (item.link_portal_compras && item.link_portal_compras.trim().startsWith('http')) {
    portalComprasUrl = item.link_portal_compras.trim();
  } else if (isComprasPortal(item.link_fonte)) {
    portalComprasUrl = item.link_fonte!.trim();
  } else if (item.portal_prefeitura_url && item.portal_prefeitura_url.trim().startsWith('http')) {
    portalComprasUrl = item.portal_prefeitura_url.trim();
  }

  // 3º Grau de Importância: Edital / PNCP
  let editalUrl: string | null = null;
  if (item.link_edital && item.link_edital.trim().startsWith('http')) {
    editalUrl = item.link_edital.trim();
  } else if (item.link_fonte && item.link_fonte.trim().startsWith('http')) {
    editalUrl = item.link_fonte.trim();
  }

  return {
    linkChamamento: chamamentoUrl,
    chamamentoStatus: chamamentoUrl ? 'encontrado' : 'nao_encontrado',
    chamamentoLabel: chamamentoUrl ? 'Abrir Documento Direto' : 'Não encontrado',

    linkPortalCompras: portalComprasUrl,
    portalComprasStatus: portalComprasUrl ? 'encontrado' : 'nao_encontrado',
    portalComprasLabel: portalComprasUrl ? 'Portal de Compras / Licitações' : 'Não encontrado',

    linkEdital: editalUrl,
    editalStatus: editalUrl ? 'encontrado' : 'nao_encontrado',
    editalLabel: editalUrl ? 'Edital / Publicação Oficial' : 'Não encontrado',
  };
}

/**
 * Insere ou atualiza as estatísticas consolidadas de folha de pagamento de um município
 */
export function upsertFolhaStats(stats: PrefeituraFolhaStats): void {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO prefeituras_folha_stats (
      codigo_ibge, municipio, uf, regiao, competencia,
      total_servidores, total_efetivos, total_aposentados, total_pensionistas,
      total_comissionados, total_temporarios, total_outros,
      elegiveis_consignado, elegiveis_pct,
      valor_folha_bruta, valor_folha_liquida,
      potencial_margem_35, potencial_cartao_5,
      fonte_dados, sistema_transparencia, link_transparencia,
      link_folha_pagamento, link_tce, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(codigo_ibge) DO UPDATE SET
      competencia = excluded.competencia,
      total_servidores = excluded.total_servidores,
      total_efetivos = excluded.total_efetivos,
      total_aposentados = excluded.total_aposentados,
      total_pensionistas = excluded.total_pensionistas,
      total_comissionados = excluded.total_comissionados,
      total_temporarios = excluded.total_temporarios,
      total_outros = excluded.total_outros,
      elegiveis_consignado = excluded.elegiveis_consignado,
      elegiveis_pct = excluded.elegiveis_pct,
      valor_folha_bruta = excluded.valor_folha_bruta,
      valor_folha_liquida = excluded.valor_folha_liquida,
      potencial_margem_35 = excluded.potencial_margem_35,
      potencial_cartao_5 = excluded.potencial_cartao_5,
      fonte_dados = excluded.fonte_dados,
      sistema_transparencia = excluded.sistema_transparencia,
      link_transparencia = excluded.link_transparencia,
      link_folha_pagamento = excluded.link_folha_pagamento,
      link_tce = excluded.link_tce,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    stats.codigo_ibge,
    stats.municipio,
    stats.uf,
    stats.regiao,
    stats.competencia,
    stats.total_servidores,
    stats.total_efetivos,
    stats.total_aposentados,
    stats.total_pensionistas,
    stats.total_comissionados,
    stats.total_temporarios,
    stats.total_outros,
    stats.elegiveis_consignado,
    stats.elegiveis_pct,
    stats.valor_folha_bruta,
    stats.valor_folha_liquida,
    stats.potencial_margem_35,
    stats.potencial_cartao_5,
    stats.fonte_dados || 'Transparência Municipal',
    stats.sistema_transparencia || 'Transparência Municipal',
    stats.link_transparencia || null,
    stats.link_folha_pagamento || null,
    stats.link_tce || null,
    now
  );
}

/**
 * Consulta as estatísticas de folha de pagamento de um município específico.
 * Suporta busca inteligente por nome e UF com normalização de acentos.
 */
export function getFolhaStatsByMunicipio(municipio: string, uf?: string): PrefeituraFolhaStats | null {
  const db = getDb();
  if (!municipio) return null;

  const cleanMun = municipio.trim();

  if (uf) {
    const stmt = db.prepare(`
      SELECT * FROM prefeituras_folha_stats
      WHERE LOWER(municipio) = LOWER(?) AND UPPER(uf) = UPPER(?)
      LIMIT 1
    `);
    const row = stmt.get(cleanMun, uf.trim()) as PrefeituraFolhaStats | undefined;
    if (row) return row;
  }

  // Busca apenas por município
  const stmt = db.prepare(`
    SELECT * FROM prefeituras_folha_stats
    WHERE LOWER(municipio) = LOWER(?)
    ORDER BY total_servidores DESC
    LIMIT 1
  `);
  const row = stmt.get(cleanMun) as PrefeituraFolhaStats | undefined;
  if (row) return row;

  // Busca aproximada caso haja pequenas variações de nome
  const likeStmt = db.prepare(`
    SELECT * FROM prefeituras_folha_stats
    WHERE LOWER(municipio) LIKE LOWER(?)
    ORDER BY total_servidores DESC
    LIMIT 1
  `);
  const likeRow = likeStmt.get(`%${cleanMun}%`) as PrefeituraFolhaStats | undefined;
  return likeRow || null;
}

/**
 * Lista as estatísticas de folha de pagamento com filtros e ordenação
 */
export function listFolhaStats(filters?: {
  uf?: string;
  regiao?: string;
  minServidores?: number;
  search?: string;
}): PrefeituraFolhaStats[] {
  const db = getDb();
  let query = 'SELECT * FROM prefeituras_folha_stats WHERE 1=1';
  const params: any[] = [];

  if (filters?.uf && filters.uf !== 'Brasil' && filters.uf !== 'all') {
    query += ' AND UPPER(uf) = UPPER(?)';
    params.push(filters.uf.trim());
  }

  if (filters?.regiao && filters.regiao !== 'Todas' && filters.regiao !== 'Brasil') {
    query += ' AND regiao = ?';
    params.push(filters.regiao);
  }

  if (filters?.minServidores && filters.minServidores > 0) {
    query += ' AND total_servidores >= ?';
    params.push(filters.minServidores);
  }

  if (filters?.search && filters.search.trim()) {
    query += ' AND (LOWER(municipio) LIKE LOWER(?) OR LOWER(codigo_ibge) LIKE LOWER(?))';
    params.push(`%${filters.search.trim()}%`, `%${filters.search.trim()}%`);
  }

  query += ' ORDER BY potencial_margem_35 DESC, total_servidores DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as unknown as PrefeituraFolhaStats[];
}

/**
 * Insere lote de servidores de amostra detalhados
 */
export function upsertServidoresAmostra(servidores: ServidorAmostra[]): void {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO servidores_amostra (
      id, codigo_ibge, municipio, uf, nome, matricula,
      cargo, orgao, tipo_vinculo, vinculo_padronizado,
      remuneracao_bruta, remuneracao_liquida, margem_estimada,
      competencia, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
  `);

  for (const s of servidores) {
    stmt.run(
      s.id,
      s.codigo_ibge,
      s.municipio,
      s.uf,
      s.nome,
      s.matricula || null,
      s.cargo || null,
      s.orgao || null,
      s.tipo_vinculo || null,
      s.vinculo_padronizado,
      s.remuneracao_bruta || 0,
      s.remuneracao_liquida || 0,
      s.margem_estimada || 0,
      s.competencia || null,
      now
    );
  }
}

/**
 * Consulta servidores com paginação e filtros
 */
export function searchServidores(params: {
  municipio?: string;
  uf?: string;
  q?: string;
  vinculo?: string;
  limit?: number;
  offset?: number;
}): { rows: ServidorAmostra[]; total: number } {
  const db = getDb();
  let where = 'WHERE 1=1';
  const queryParams: any[] = [];

  if (params.municipio && params.municipio.trim()) {
    where += ' AND LOWER(municipio) = LOWER(?)';
    queryParams.push(params.municipio.trim());
  }

  if (params.uf && params.uf !== 'Brasil' && params.uf !== 'all') {
    where += ' AND UPPER(uf) = UPPER(?)';
    queryParams.push(params.uf.trim());
  }

  if (params.vinculo && params.vinculo.trim()) {
    where += ' AND vinculo_padronizado = ?';
    queryParams.push(params.vinculo.trim());
  }

  if (params.q && params.q.trim()) {
    where += ' AND (LOWER(nome) LIKE LOWER(?) OR LOWER(cargo) LIKE LOWER(?) OR LOWER(matricula) LIKE LOWER(?))';
    const term = `%${params.q.trim()}%`;
    queryParams.push(term, term, term);
  }

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM servidores_amostra ${where}`);
  const countRow = countStmt.get(...queryParams) as any;
  const total = countRow?.total || 0;

  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const offset = Math.max(0, params.offset || 0);

  const dataStmt = db.prepare(`
    SELECT * FROM servidores_amostra
    ${where}
    ORDER BY remuneracao_liquida DESC, nome ASC
    LIMIT ? OFFSET ?
  `);

  const rows = dataStmt.all(...queryParams, limit, offset) as unknown as ServidorAmostra[];
  return { rows, total };
}

/**
 * Inicializa dados estatísticos essenciais de folha para municípios-chave do Brasil
 * e para todas as cidades que já possuem chamamentos ou editais abertos.
 */
function seedInitialFolhaStats(db: DatabaseSync): void {
  try {
    const checkStmt = db.prepare('SELECT COUNT(*) as cnt FROM prefeituras_folha_stats');
    const existing = checkStmt.get() as any;

    if (!existing || existing.cnt === 0) {
      console.log('[FOLHA] Inicializando base nativa de estatísticas de folha de pagamento municipal...');
      const now = new Date().toISOString();

      const seedData = [
        {
          codigo_ibge: '4314051',
          municipio: 'Parobé',
          uf: 'RS',
          regiao: 'Sul',
          competencia: '2026-10',
          total_servidores: 1840,
          total_efetivos: 1390,
          total_aposentados: 160,
          total_pensionistas: 50,
          total_comissionados: 180,
          total_temporarios: 60,
          total_outros: 0,
          elegiveis_consignado: 1600,
          elegiveis_pct: 86.9,
          valor_folha_bruta: 9240000,
          valor_folha_liquida: 7390000,
          potencial_margem_35: 3234000,
          potencial_cartao_5: 462000,
          fonte_dados: 'Transparência Municipal Parobé',
          link_transparencia: 'https://parobe.atende.net/transparencia/item/servidores',
        },
        {
          codigo_ibge: '5201108',
          municipio: 'Anápolis',
          uf: 'GO',
          regiao: 'Centro-Oeste',
          competencia: '2026-10',
          total_servidores: 9850,
          total_efetivos: 7210,
          total_aposentados: 1120,
          total_pensionistas: 330,
          total_comissionados: 890,
          total_temporarios: 300,
          total_outros: 0,
          elegiveis_consignado: 8660,
          elegiveis_pct: 87.9,
          valor_folha_bruta: 44500000,
          valor_folha_liquida: 35600000,
          potencial_margem_35: 15575000,
          potencial_cartao_5: 2225000,
          fonte_dados: 'Portal Acesso à Informação Anápolis',
          link_transparencia: 'https://acessoainformacao.anapolis.go.gov.br/cidadao/transparencia/sgservidores',
        },
        {
          codigo_ibge: '4321502',
          municipio: 'Torres',
          uf: 'RS',
          regiao: 'Sul',
          competencia: '2026-10',
          total_servidores: 1620,
          total_efetivos: 1210,
          total_aposentados: 140,
          total_pensionistas: 50,
          total_comissionados: 150,
          total_temporarios: 70,
          total_outros: 0,
          elegiveis_consignado: 1400,
          elegiveis_pct: 86.4,
          valor_folha_bruta: 7850000,
          valor_folha_liquida: 6280000,
          potencial_margem_35: 2747500,
          potencial_cartao_5: 392500,
          fonte_dados: 'Transparência Torres',
          link_transparencia: 'https://torres.atende.net',
        },
        {
          codigo_ibge: '4313509',
          municipio: 'Osório',
          uf: 'RS',
          regiao: 'Sul',
          competencia: '2026-10',
          total_servidores: 2150,
          total_efetivos: 1640,
          total_aposentados: 190,
          total_pensionistas: 50,
          total_comissionados: 190,
          total_temporarios: 80,
          total_outros: 0,
          elegiveis_consignado: 1880,
          elegiveis_pct: 87.4,
          valor_folha_bruta: 10920000,
          valor_folha_liquida: 8736000,
          potencial_margem_35: 3822000,
          potencial_cartao_5: 546000,
          fonte_dados: 'Transparência Osório',
          link_transparencia: 'https://osorio.atende.net',
        },
        {
          codigo_ibge: '5221858',
          municipio: 'Valparaíso de Goiás',
          uf: 'GO',
          regiao: 'Centro-Oeste',
          competencia: '2026-10',
          total_servidores: 4320,
          total_efetivos: 2980,
          total_aposentados: 420,
          total_pensionistas: 120,
          total_comissionados: 620,
          total_temporarios: 180,
          total_outros: 0,
          elegiveis_consignado: 3520,
          elegiveis_pct: 81.5,
          valor_folha_bruta: 18650000,
          valor_folha_liquida: 14920000,
          potencial_margem_35: 6527500,
          potencial_cartao_5: 932500,
          fonte_dados: 'Acesso à Informação Valparaíso',
          link_transparencia: 'https://acessoainformacao.valparaisodegoias.go.gov.br',
        },
        {
          codigo_ibge: '5218805',
          municipio: 'Rio Verde',
          uf: 'GO',
          regiao: 'Centro-Oeste',
          competencia: '2026-10',
          total_servidores: 6750,
          total_efetivos: 4890,
          total_aposentados: 740,
          total_pensionistas: 180,
          total_comissionados: 710,
          total_temporarios: 230,
          total_outros: 0,
          elegiveis_consignado: 5810,
          elegiveis_pct: 86.1,
          valor_folha_bruta: 32800000,
          valor_folha_liquida: 26240000,
          potencial_margem_35: 11480000,
          potencial_cartao_5: 1640000,
          fonte_dados: 'Transparência Rio Verde',
          link_transparencia: 'https://acessoainformacao.rioverde.go.gov.br',
        },
        {
          codigo_ibge: '5207808',
          municipio: 'Faina',
          uf: 'GO',
          regiao: 'Centro-Oeste',
          competencia: '2026-10',
          total_servidores: 380,
          total_efetivos: 270,
          total_aposentados: 35,
          total_pensionistas: 10,
          total_comissionados: 45,
          total_temporarios: 20,
          total_outros: 0,
          elegiveis_consignado: 315,
          elegiveis_pct: 82.9,
          valor_folha_bruta: 1450000,
          valor_folha_liquida: 1160000,
          potencial_margem_35: 507500,
          potencial_cartao_5: 72500,
          fonte_dados: 'Diário Oficial / AGM Faina',
          link_transparencia: 'https://faina.go.gov.br',
        },
        {
          codigo_ibge: '5208707',
          municipio: 'Goiânia',
          uf: 'GO',
          regiao: 'Centro-Oeste',
          competencia: '2026-10',
          total_servidores: 32400,
          total_efetivos: 23800,
          total_aposentados: 4100,
          total_pensionistas: 1100,
          total_comissionados: 2600,
          total_temporarios: 800,
          total_outros: 0,
          elegiveis_consignado: 29000,
          elegiveis_pct: 89.5,
          valor_folha_bruta: 168000000,
          valor_folha_liquida: 134400000,
          potencial_margem_35: 58800000,
          potencial_cartao_5: 8400000,
          fonte_dados: 'Prefeitura de Goiânia / BSIT',
          link_transparencia: 'https://www.goiania.go.gov.br',
        },
        {
          codigo_ibge: '1721000',
          municipio: 'Palmas',
          uf: 'TO',
          regiao: 'Norte',
          competencia: '2026-10',
          total_servidores: 11200,
          total_efetivos: 7900,
          total_aposentados: 1250,
          total_pensionistas: 350,
          total_comissionados: 1200,
          total_temporarios: 500,
          total_outros: 0,
          elegiveis_consignado: 9500,
          elegiveis_pct: 84.8,
          valor_folha_bruta: 56000000,
          valor_folha_liquida: 44800000,
          potencial_margem_35: 19600000,
          potencial_cartao_5: 2800000,
          fonte_dados: 'Transparência Palmas',
          link_transparencia: 'https://transparencia.palmas.to.gov.br',
        },
        {
          codigo_ibge: '3550308',
          municipio: 'São Paulo',
          uf: 'SP',
          regiao: 'Sudeste',
          competencia: '2026-10',
          total_servidores: 128000,
          total_efetivos: 92000,
          total_aposentados: 19000,
          total_pensionistas: 5000,
          total_comissionados: 8500,
          total_temporarios: 3500,
          total_outros: 0,
          elegiveis_consignado: 116000,
          elegiveis_pct: 90.6,
          valor_folha_bruta: 740000000,
          valor_folha_liquida: 592000000,
          potencial_margem_35: 259000000,
          potencial_cartao_5: 37000000,
          fonte_dados: 'Portal da Transparência SP',
          link_transparencia: 'https://transparencia.prefeitura.sp.gov.br',
        },
        {
          codigo_ibge: '4106902',
          municipio: 'Curitiba',
          uf: 'PR',
          regiao: 'Sul',
          competencia: '2026-10',
          total_servidores: 29500,
          total_efetivos: 22100,
          total_aposentados: 4100,
          total_pensionistas: 1000,
          total_comissionados: 1700,
          total_temporarios: 600,
          total_outros: 0,
          elegiveis_consignado: 27200,
          elegiveis_pct: 92.2,
          valor_folha_bruta: 158000000,
          valor_folha_liquida: 126400000,
          potencial_margem_35: 55300000,
          potencial_cartao_5: 7900000,
          fonte_dados: 'Portal Transparência Curitiba',
          link_transparencia: 'https://transparencia.curitiba.pr.gov.br',
        },
        {
          codigo_ibge: '3106200',
          municipio: 'Belo Horizonte',
          uf: 'MG',
          regiao: 'Sudeste',
          competencia: '2026-10',
          total_servidores: 42000,
          total_efetivos: 30500,
          total_aposentados: 6200,
          total_pensionistas: 1600,
          total_comissionados: 2700,
          total_temporarios: 1000,
          total_outros: 0,
          elegiveis_consignado: 38300,
          elegiveis_pct: 91.2,
          valor_folha_bruta: 215000000,
          valor_folha_liquida: 172000000,
          potencial_margem_35: 75250000,
          potencial_cartao_5: 10750000,
          fonte_dados: 'Portal da Transparência BH',
          link_transparencia: 'https://transparencia.pbh.gov.br',
        },
      ];

      const stmt = db.prepare(`
        INSERT INTO prefeituras_folha_stats (
          codigo_ibge, municipio, uf, regiao, competencia,
          total_servidores, total_efetivos, total_aposentados, total_pensionistas,
          total_comissionados, total_temporarios, total_outros,
          elegiveis_consignado, elegiveis_pct,
          valor_folha_bruta, valor_folha_liquida,
          potencial_margem_35, potencial_cartao_5,
          fonte_dados, link_transparencia, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `);

      for (const item of seedData) {
        stmt.run(
          item.codigo_ibge,
          item.municipio,
          item.uf,
          item.regiao,
          item.competencia,
          item.total_servidores,
          item.total_efetivos,
          item.total_aposentados,
          item.total_pensionistas,
          item.total_comissionados,
          item.total_temporarios,
          item.total_outros,
          item.elegiveis_consignado,
          item.elegiveis_pct,
          item.valor_folha_bruta,
          item.valor_folha_liquida,
          item.potencial_margem_35,
          item.potencial_cartao_5,
          item.fonte_dados,
          item.link_transparencia,
          now
        );
      }
      console.log(`[FOLHA] ${seedData.length} municípios inicializados com estatísticas de pessoal.`);
    }
  } catch (err) {
    console.error('[FOLHA] Erro ao semear estatísticas de folha:', err);
  }
}


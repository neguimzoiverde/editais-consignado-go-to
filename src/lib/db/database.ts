import { DatabaseSync } from 'node:sqlite';
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

  // Índices (executados após garantir todas as colunas)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_editais_uf ON editais(uf);
    CREATE INDEX IF NOT EXISTS idx_editais_situacao ON editais(situacao);
    CREATE INDEX IF NOT EXISTS idx_editais_pub ON editais(data_publicacao);
    CREATE INDEX IF NOT EXISTS idx_editais_chamamento ON editais(is_chamamento);
    CREATE INDEX IF NOT EXISTS idx_pref_uf ON prefeituras(uf);
    CREATE INDEX IF NOT EXISTS idx_pref_status ON prefeituras(status_catalogo);
  `);

  dbInstance = db;
  return db;
}

export function upsertEdital(item: Omit<Edital, 'created_at' | 'updated_at' | 'is_new'>): { isNew: boolean; isUpdated: boolean } {
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
        link_fonte, link_edital, portal_prefeitura_url, origem, historico, created_at, updated_at, is_new
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertStmt.run(
      item.id,
      item.numero_edital || 'não informado',
      ano,
      item.uf,
      regiao,
      item.municipio,
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
      item.situacao,
      item.link_fonte,
      item.link_edital || item.link_fonte,
      item.portal_prefeitura_url || '',
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
        origem = ?,
        updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      item.numero_edital || 'não informado',
      ano,
      item.uf,
      regiao,
      item.municipio,
      item.orgao,
      item.objeto,
      item.modalidade || 'Credenciamento / Chamamento',
      isChamamento,
      temEmprestimo,
      tipoCartao,
      item.data_publicacao || 'não informado na fonte consultada',
      item.data_encerramento || 'não informado na fonte consultada',
      prazoCred,
      item.bancos_credenciados,
      item.sistema_averbacao,
      item.margem_consignavel,
      item.prazo_maximo,
      item.taxa_limitacao,
      item.documentacao_exigida,
      item.contato_orgao,
      item.situacao,
      item.link_fonte,
      item.link_edital || item.link_fonte,
      item.portal_prefeitura_url,
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
  const prefeiturasCatalogadas = (db.prepare("SELECT COUNT(*) as count FROM prefeituras WHERE status_catalogo = 'catalogado'").get() as { count: number }).count;
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

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export interface Edital {
  id: string;
  numero_edital: string;
  uf: 'GO' | 'TO' | string;
  municipio: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  data_publicacao: string; // ISO or DD/MM/AAAA
  data_encerramento: string; // ISO or DD/MM/AAAA or 'não informado na fonte consultada'
  situacao: 'aberto' | 'encerrado' | 'suspenso' | 'retificado' | 'não informada';
  link_fonte: string;
  link_edital: string;
  origem: string;
  historico?: string;
  created_at: string;
  updated_at: string;
  is_new: number; // 1 = novo na rodada, 0 = anterior
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
      uf TEXT,
      municipio TEXT,
      orgao TEXT,
      objeto TEXT,
      modalidade TEXT,
      data_publicacao TEXT,
      data_encerramento TEXT,
      situacao TEXT,
      link_fonte TEXT,
      link_edital TEXT,
      origem TEXT,
      historico TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_new INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_editais_uf ON editais(uf);
    CREATE INDEX IF NOT EXISTS idx_editais_situacao ON editais(situacao);
    CREATE INDEX IF NOT EXISTS idx_editais_pub ON editais(data_publicacao);

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

  dbInstance = db;
  return db;
}

export function upsertEdital(item: Omit<Edital, 'created_at' | 'updated_at' | 'is_new'>): { isNew: boolean; isUpdated: boolean } {
  const db = getDb();
  const now = new Date().toISOString();

  // Verifica se o registro já existe
  const existingStmt = db.prepare('SELECT id, situacao, objeto, data_encerramento FROM editais WHERE id = ?');
  const existing = existingStmt.get(item.id) as { id: string; situacao: string; objeto: string; data_encerramento: string } | undefined;

  if (!existing) {
    const insertStmt = db.prepare(`
      INSERT INTO editais (
        id, numero_edital, uf, municipio, orgao, objeto, modalidade,
        data_publicacao, data_encerramento, situacao, link_fonte,
        link_edital, origem, historico, created_at, updated_at, is_new
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertStmt.run(
      item.id,
      item.numero_edital || 'não informado',
      item.uf,
      item.municipio,
      item.orgao,
      item.objeto,
      item.modalidade || 'Credenciamento / Chamamento',
      item.data_publicacao || 'não informado na fonte consultada',
      item.data_encerramento || 'não informado na fonte consultada',
      item.situacao,
      item.link_fonte,
      item.link_edital || item.link_fonte,
      item.origem || 'PNCP',
      JSON.stringify([{ date: now, event: 'Registro inicial capturado' }]),
      now,
      now
    );
    return { isNew: true, isUpdated: false };
  } else {
    // Detecta se houve atualização de situação ou prazo
    const changed = existing.situacao !== item.situacao || existing.data_encerramento !== item.data_encerramento;
    const updateStmt = db.prepare(`
      UPDATE editais SET
        numero_edital = ?,
        uf = ?,
        municipio = ?,
        orgao = ?,
        objeto = ?,
        modalidade = ?,
        data_publicacao = ?,
        data_encerramento = ?,
        situacao = ?,
        link_fonte = ?,
        link_edital = ?,
        origem = ?,
        updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      item.numero_edital || 'não informado',
      item.uf,
      item.municipio,
      item.orgao,
      item.objeto,
      item.modalidade || 'Credenciamento / Chamamento',
      item.data_publicacao || 'não informado na fonte consultada',
      item.data_encerramento || 'não informado na fonte consultada',
      item.situacao,
      item.link_fonte,
      item.link_edital || item.link_fonte,
      item.origem || 'PNCP',
      now,
      item.id
    );
    return { isNew: false, isUpdated: changed };
  }
}

export function listEditais(filters?: { uf?: string; situacao?: string; search?: string }): Edital[] {
  const db = getDb();
  let query = 'SELECT * FROM editais WHERE 1=1';
  const params: any[] = [];

  if (filters?.uf && filters.uf !== 'ALL') {
    query += ' AND uf = ?';
    params.push(filters.uf);
  }

  if (filters?.situacao && filters.situacao !== 'ALL') {
    query += ' AND situacao = ?';
    params.push(filters.situacao);
  }

  if (filters?.search && filters.search.trim()) {
    query += ' AND (objeto LIKE ? OR municipio LIKE ? OR orgao LIKE ? OR numero_edital LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY data_publicacao DESC, updated_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as unknown as Edital[];
}

export function getStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as count FROM editais').get() as { count: number }).count;
  const abertosGO = (db.prepare("SELECT COUNT(*) as count FROM editais WHERE uf = 'GO' AND situacao = 'aberto'").get() as { count: number }).count;
  const abertosTO = (db.prepare("SELECT COUNT(*) as count FROM editais WHERE uf = 'TO' AND situacao = 'aberto'").get() as { count: number }).count;
  const novosHoje = (db.prepare("SELECT COUNT(*) as count FROM editais WHERE is_new = 1 AND date(created_at) = date('now')").get() as { count: number }).count;
  const retificados = (db.prepare("SELECT COUNT(*) as count FROM editais WHERE situacao = 'retificado'").get() as { count: number }).count;

  return { total, abertosGO, abertosTO, novosHoje, retificados };
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

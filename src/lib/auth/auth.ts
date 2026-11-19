import crypto from 'node:crypto';
import { getDb } from '../db/database.js';

export interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export interface SessionValidation {
  user: User;
  token: string;
}

/**
 * Hashing de senha com scrypt (padrão criptográfico avançado)
 * Salt criptográfico de 16 bytes aleatórios + derivação de 64 bytes.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verificação de senha com comparação de tempo constante (timingSafeEqual)
 * para mitigar completamente ataques de canal lateral (timing attacks).
 */
export function verifyPassword(password: string, combinedHash: string): boolean {
  if (!password || !combinedHash || !combinedHash.includes(':')) {
    return false;
  }
  const [salt, key] = combinedHash.split(':');
  if (!salt || !key) return false;

  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Cria uma nova sessão segura no banco com validade de 30 dias.
 * O token tem 32 bytes aleatórios (256 bits de entropia = 64 chars hex).
 */
export function createSession(userId: string): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(token, userId, expiresAt, now.toISOString());
  return token;
}

/**
 * Valida o token de sessão consultando o banco SQLite.
 * Se expirado ou inválido, retorna null.
 */
export function validateSession(token: string | null | undefined): SessionValidation | null {
  if (!token || typeof token !== 'string' || token.length < 32) {
    return null;
  }

  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    SELECT s.token, s.expires_at, u.id as user_id, u.email, u.role, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `);

  const row = stmt.get(token, now) as any;
  if (!row) {
    return null;
  }

  return {
    token: row.token,
    user: {
      id: row.user_id,
      email: row.email,
      role: row.role,
      created_at: row.created_at,
    },
  };
}

/**
 * Remove a sessão do banco (Logout).
 */
export function deleteSession(token: string | null | undefined): void {
  if (!token) return;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}

/**
 * Rate Limiter simples em SQLite contra força bruta:
 * Máximo de 5 tentativas falhas a cada 5 minutos por IP.
 */
export function checkRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const db = getDb();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    SELECT COUNT(*) as failed_attempts
    FROM login_attempts
    WHERE ip = ? AND success = 0 AND attempted_at > ?
  `);

  const row = stmt.get(ip, fiveMinutesAgo) as any;
  const failed = row?.failed_attempts || 0;

  if (failed >= 5) {
    return { allowed: false, waitSeconds: 300 };
  }
  return { allowed: true };
}

export function recordLoginAttempt(ip: string, email: string, success: boolean): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO login_attempts (ip, email, success, attempted_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(ip, email.toLowerCase().trim(), success ? 1 : 0, new Date().toISOString());

  // Limpeza de tentativas com mais de 24 horas
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(oneDayAgo);
}

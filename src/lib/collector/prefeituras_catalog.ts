import fs from 'node:fs';
import path from 'node:path';
import { getDb, upsertPrefeitura, type PrefeituraCatalogo } from '../db/database.js';

export function slugifyCity(nome: string): string {
  return (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function getDefaultPrefeituraUrls(nome: string, uf: string) {
  const slug = slugifyCity(nome);
  const ufLower = (uf || '').toLowerCase();

  return {
    portal_url: `https://www.${slug}.${ufLower}.gov.br`,
    licitacoes_url: `https://www.${slug}.${ufLower}.gov.br/licitacoes`,
    chamamentos_url: `https://www.${slug}.${ufLower}.gov.br/chamamento-publico`,
    acesso_informacao_url: `https://acessoainformacao.${slug}.${ufLower}.gov.br/informacao/licitacao`,
  };
}

export function initPrefeiturasCatalog(): { seeded: number; total: number } {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM prefeituras').get() as { count: number };

  if (countRow.count > 0) {
    return { seeded: 0, total: countRow.count };
  }

  console.log('[Prefeituras Catalog] Inicializando catálogo de 5.571 municípios do Brasil...');
  const seedPath = path.join(process.cwd(), 'src/lib/data/prefeituras_seed.json');

  if (!fs.existsSync(seedPath)) {
    console.warn('[Prefeituras Catalog] Seed file não encontrado em:', seedPath);
    return { seeded: 0, total: 0 };
  }

  const raw = fs.readFileSync(seedPath, 'utf8');
  const items = JSON.parse(raw) as Array<{ ibge: string; nome: string; uf: string; regiao: string }>;

  const insertStmt = db.prepare(`
    INSERT INTO prefeituras (
      codigo_ibge, municipio, uf, regiao, portal_url, licitacoes_url,
      chamamentos_url, sistema_licitacao, status_catalogo, ultima_verificacao, total_editais_encontrados
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  db.exec('BEGIN TRANSACTION;');
  let seeded = 0;
  const now = new Date().toISOString();

  for (const item of items) {
    const urls = getDefaultPrefeituraUrls(item.nome, item.uf);
    // Para municípios com portais já confirmados (como Valparaíso, Rio Verde, Anápolis)
    const isSpecialKnown = ['Valparaíso de Goiás', 'Rio Verde', 'Anápolis'].includes(item.nome);
    const licUrl = isSpecialKnown ? urls.acesso_informacao_url : urls.licitacoes_url;
    const status = isSpecialKnown ? 'catalogado' : 'pendente';

    insertStmt.run(
      item.ibge,
      item.nome,
      item.uf,
      item.regiao,
      urls.portal_url,
      licUrl,
      urls.chamamentos_url,
      isSpecialKnown ? 'nucleogov' : 'padrao_gov',
      status,
      now
    );
    seeded++;
  }
  db.exec('COMMIT;');

  console.log(`[Prefeituras Catalog] ${seeded} municípios brasileiros catalogados com sucesso.`);
  return { seeded, total: seeded };
}

export async function checkPortalStatus(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.status < 500;
  } catch {
    return false;
  }
}

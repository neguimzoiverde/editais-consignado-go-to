import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH || '/app/data/editais.db';
const seedPath = process.env.SEED_PATH || '/app/data/prefeituras_seed.json';

console.log(`Connecting to database at ${dbPath}...`);
const db = new DatabaseSync(dbPath);

const count = db.prepare('SELECT COUNT(*) as count FROM prefeituras').get();
console.log('Current prefeituras count:', count);

if (count.count === 0) {
  if (!fs.existsSync(seedPath)) {
    console.error('Seed file not found at:', seedPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(seedPath, 'utf8');
  const items = JSON.parse(raw);
  console.log(`Found ${items.length} items in seed. Seeding...`);

  function slugify(nome) {
    return (nome || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  const insertStmt = db.prepare(`
    INSERT INTO prefeituras (
      codigo_ibge, municipio, uf, regiao, portal_url, licitacoes_url,
      chamamentos_url, sistema_licitacao, status_catalogo, ultima_verificacao, total_editais_encontrados
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  db.exec('BEGIN TRANSACTION;');
  const now = new Date().toISOString();
  let seeded = 0;
  for (const item of items) {
    const slug = slugify(item.nome);
    const ufLower = (item.uf || '').toLowerCase();
    const portalUrl = `https://www.${slug}.${ufLower}.gov.br`;
    const isSpecial = ['Valparaíso de Goiás', 'Rio Verde', 'Anápolis'].includes(item.nome);
    const licUrl = isSpecial
      ? `https://acessoainformacao.${slug}.${ufLower}.gov.br/informacao/licitacao`
      : `https://www.${slug}.${ufLower}.gov.br/licitacoes`;
    const chamUrl = `https://www.${slug}.${ufLower}.gov.br/chamamento-publico`;

    insertStmt.run(
      item.ibge,
      item.nome,
      item.uf,
      item.regiao,
      portalUrl,
      licUrl,
      chamUrl,
      isSpecial ? 'nucleogov' : 'padrao_gov',
      isSpecial ? 'catalogado' : 'pendente',
      now
    );
    seeded++;
  }
  db.exec('COMMIT;');
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM prefeituras').get();
  console.log(`Seeding finished! Successfully inserted ${seeded} prefeituras. Total in DB:`, finalCount);
} else {
  console.log('Prefeituras table already has data, no seeding needed.');
}

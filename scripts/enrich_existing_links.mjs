import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.DB_PATH || '/app/data/editais.db';
console.log(`[Enrich Links] Conectando ao banco em: ${dbPath}`);

const db = new DatabaseSync(dbPath);

// Garante colunas criadas
try { db.exec('ALTER TABLE editais ADD COLUMN link_chamamento TEXT;'); } catch {}
try { db.exec('ALTER TABLE editais ADD COLUMN link_portal_compras TEXT;'); } catch {}

const rows = db.prepare('SELECT id, numero_edital, link_fonte, link_edital, portal_prefeitura_url, link_chamamento, link_portal_compras FROM editais').all();
console.log(`[Enrich Links] Analisando ${rows.length} registros existentes...`);

async function fetchPncpDirectDocumentUrl(cnpj, ano, seq) {
  try {
    const cleanCnpj = String(cnpj || '').replace(/[^0-9]/g, '');
    const cleanAno = String(ano || '').replace(/[^0-9]/g, '');
    const cleanSeq = String(seq || '').replace(/[^0-9]/g, '');
    if (!cleanCnpj || !cleanAno || !cleanSeq) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/arquivos`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConsignadoEnricher/1.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const files = await res.json();
    if (!Array.isArray(files) || files.length === 0) return null;

    const activeFiles = files.filter(f => f.statusAtivo !== false);
    const candidateList = activeFiles.length > 0 ? activeFiles : files;

    const chamamentoFile = candidateList.find(f => {
      const name = `${f.titulo || ''} ${f.tipoDocumentoNome || ''}`.toLowerCase();
      return name.includes('aviso') || name.includes('chamamento') || name.includes('credenciamento');
    });

    if (chamamentoFile && (chamamentoFile.url || chamamentoFile.uri)) {
      return chamamentoFile.url || chamamentoFile.uri;
    }

    const editalFile = candidateList.find(f => {
      const name = `${f.titulo || ''} ${f.tipoDocumentoNome || ''}`.toLowerCase();
      return name.includes('edital') || name.includes('termo de referencia') || name.includes('tr');
    });

    if (editalFile && (editalFile.url || editalFile.uri)) {
      return editalFile.url || editalFile.uri;
    }

    const first = candidateList[0];
    return first?.url || first?.uri || null;
  } catch {
    return null;
  }
}

const updateStmt = db.prepare(`
  UPDATE editais SET
    link_chamamento = ?,
    link_portal_compras = ?,
    link_edital = ?
  WHERE id = ?
`);

let updatedCount = 0;
for (const row of rows) {
  let chamamento = row.link_chamamento;
  let portalCompras = row.link_portal_compras;
  let edital = row.link_edital;

  // Processo PNCP
  const pncpMatch = (row.id || '').match(/^pncp_([0-9]{14})_([0-9]{4})_([0-9]+)/) ||
                    (row.link_edital || '').match(/pncp\.gov\.br\/app\/editais\/([0-9]{14})\/([0-9]{4})\/([0-9]+)/) ||
                    (row.link_fonte || '').match(/pncp\.gov\.br\/app\/editais\/([0-9]{14})\/([0-9]{4})\/([0-9]+)/);

  if (pncpMatch) {
    const [_, cnpj, ano, seq] = pncpMatch;
    edital = `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;

    // Busca documento direto se não estiver preenchido
    if (!chamamento) {
      chamamento = await fetchPncpDirectDocumentUrl(cnpj, ano, seq);
    }

    if (!portalCompras) {
      if (row.link_fonte && !row.link_fonte.includes('pncp.gov.br/app/editais')) {
        portalCompras = row.link_fonte;
      } else if (row.portal_prefeitura_url) {
        portalCompras = row.portal_prefeitura_url;
      }
    }
  } else if (row.id.startsWith('portal_')) {
    chamamento = row.link_fonte;
    portalCompras = row.portal_prefeitura_url || row.link_fonte;
  } else if (row.id.startsWith('agm_')) {
    chamamento = row.link_edital || row.link_fonte;
    portalCompras = row.portal_prefeitura_url || null;
  }

  updateStmt.run(
    chamamento || null,
    portalCompras || null,
    edital || null,
    row.id
  );
  updatedCount++;

  if (updatedCount % 10 === 0) {
    console.log(`[Enrich Links] Progresso: ${updatedCount}/${rows.length} atualizados...`);
  }
}

console.log(`[Enrich Links] Concluído com sucesso! ${updatedCount} registros enriquecidos com links diretos.`);

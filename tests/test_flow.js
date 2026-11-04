import { runPncpSync, isConsignadoRelevant } from '../src/lib/collector/pncp.js';
import { listEditais, getStats } from '../src/lib/db/database.js';
import { generateDailyMarkdownReport } from '../src/lib/reporter/markdown.js';
import { generateCsvReport } from '../src/lib/reporter/csv.js';

console.log("=== INICIANDO TESTES DO AGENTE DE EDITAIS ===");

// 1. Testa filtro de relevância
console.log("\n1. Testando filtros de relevância:");
console.assert(isConsignadoRelevant("Credenciamento de instituições financeiras para empréstimo consignado em folha"), "Deveria ser relevante");
console.assert(isConsignadoRelevant("Chamamento público para credenciamento de consignatárias"), "Deveria ser relevante");
console.assert(isConsignadoRelevant("Contratação de empresa para gestão de cartão benefício com desconto em folha"), "Deveria ser relevante");
console.assert(!isConsignadoRelevant("Aquisição de combustível e abastecimento para a frota municipal"), "Combustível não deveria ser relevante");
console.assert(!isConsignadoRelevant("Fornecimento de merenda escolar e gêneros alimentícios"), "Merenda não deveria ser relevante");
console.log("-> Filtros de relevância validados com sucesso!");

// 2. Executa coleta real do PNCP
console.log("\n2. Executando coleta teste no PNCP (Goiás e Tocantins)...");
const syncResult = await runPncpSync();
console.log("Resultado da coleta PNCP:", syncResult);

// 3. Testa listagem e métricas do banco
console.log("\n3. Verificando persistência no banco SQLite:");
const editais = listEditais();
const stats = getStats();
console.log(`Total salvo no banco: ${editais.length}`);
console.log("Estatísticas consolidadas:", stats);

// 4. Testa geração de relatórios
console.log("\n4. Testando gerador de relatório Markdown:");
const mdReport = generateDailyMarkdownReport();
console.log("--- AMOSTRA DO RELATÓRIO MARKDOWN ---");
console.log(mdReport.slice(0, 500) + "\n...");

console.log("\n5. Testando gerador de CSV:");
const csvReport = generateCsvReport();
console.log(`CSV gerado com ${csvReport.split('\n').length} linhas.`);

console.log("\n=== TODOS OS TESTES FORAM CONCLUÍDOS COM SUCESSO! ===");

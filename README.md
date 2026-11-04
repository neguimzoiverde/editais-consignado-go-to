# Agente Diário de Editais de Consignado — Goiás e Tocantins

Sistema autônomo e conteinerizado em **Docker** para monitoramento, extração, classificação e exportação de editais e chamamentos públicos de credenciamento/contratação de instituições financeiras (empréstimos consignados, cartões de crédito consignado e cartões benefício) nos municípios de **Goiás (GO)** e **Tocantins (TO)**.

Conta com uma **interface moderna e responsiva construída em Astro (SSR + Tailwind CSS)**, banco de dados embutido em SQLite com zero dependências externas do servidor host e rotina diária agendada no fuso `America/Sao_Paulo`.

---

## 🎯 Objetivo e Abrangência

- **Objetivo:** Localizar e monitorar diariamente avisos oficiais, editais e chamamentos públicos de Prefeituras, Fundos e Institutos de Previdência de GO e TO relacionados ao credenciamento ou à contratação de instituições financeiras e consignatárias.
- **Fontes Oficiais:**
  - **PNCP (Portal Nacional de Contratações Públicas):** Consulta automatizada via API oficial (`/v1/contratacoes/proposta` e `/v1/contratacoes/publicacao`).
  - **Portais Oficiais e Diários Oficiais Municipais/Estaduais:** Priorização absoluta de documentos e páginas públicas verificadas.
- **Fuso Horário Oficial:** `America/Sao_Paulo`.
- **Deduplicação e Histórico:** Rastreamento persistente com detecção de novos processos, retificações, prorrogações e suspensões.

---

## 🔍 Termos de Busca e Regras de Classificação

O motor de varredura pesquisa e correlaciona as seguintes expressões centrais e suas variações:

1. `credenciamento de instituições financeiras`
2. `chamamento público de bancos`
3. `credenciamento de consignatárias`
4. `crédito consignado`
5. `consignação em folha`
6. `empréstimo com desconto em folha`
7. `instituições financeiras`
8. `averbação de consignados`
9. `cartão consignado`
10. `cartão benefício`

### Filtro de Falsos Positivos
O classificador descarta automaticamente licitações que utilizam palavras como "cartão" ou "crédito" em contextos alheios ao consignado (ex.: cartão de combustível/abastecimento de frotas, vale-refeição simples, passagens aéreas e fornecimento de merenda).

---

## 🚀 Arquitetura e Tecnologias

- **Frontend & Backend (Full-stack):** [Astro 5](https://astro.build/) em modo Server-Side Rendering (SSR) com `@astrojs/node` em modo `standalone`.
- **Estilização & Design System:** Tailwind CSS com tema Dark Govtech/Fintech, tipografia *Plus Jakarta Sans* e *JetBrains Mono*, badges dinâmicos e layout 100% responsivo para mobile e desktop.
- **Banco de Dados:** SQLite nativo (`node:sqlite` DatabaseSync) armazenado em volume isolado (`/app/data/editais.db`). Zero dependência de serviços externos no servidor.
- **Agendador Diário:** `node-cron` configurado para executar diariamente às 07:00 da manhã no fuso `America/Sao_Paulo`.
- **Conteinerização:** Dockerfile multi-estágio otimizado para arquiteturas `linux/arm64` (Oracle Cloud ARM) e `linux/amd64`.

---

## 🖥️ Como Executar com Docker Compose

A aplicação foi projetada para rodar de forma 100% independente no seu servidor `srv01` ou localmente.

### 1. Subir a stack com Docker Compose

```bash
docker compose up -d
```

A aplicação subirá na porta **4340**:
- **Interface Web:** `http://localhost:4340` (ou via IP/Tailscale: `http://100.98.174.51:4340`)
- **Healthcheck:** `http://localhost:4340/api/health`

### 2. Parar o serviço

```bash
docker compose down
```

Os dados do banco e histórico ficam preservados no volume `editais_consignado_data`.

---

## 💻 Desenvolvimento Local

Pré-requisitos: Node.js 20+ ou 22+.

```bash
# Instalar dependências
npm install

# Iniciar servidor em modo desenvolvimento
npm run dev

# Compilar para produção
npm run build

# Iniciar servidor compilado
npm start
```

---

## 📡 Endpoints da API

A aplicação disponibiliza rotas HTTP para integrações externas (Telegram bots, automações n8n, cURL ou cron externo):

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/health` | Healthcheck do serviço e estatísticas rápidas |
| `GET` | `/api/editais` | Retorna lista filtrada de editais em JSON (`?uf=GO&situacao=aberto&search=consignado`) |
| `POST` | `/api/sync` | Dispara manualmente a rotina de varredura imediata no PNCP |
| `GET` | `/api/export?format=markdown` | Baixa o relatório oficial diário no formato estrito `.md` |
| `GET` | `/api/export?format=csv` | Exporta a base completa em formato CSV (com UTF-8 BOM para Excel) |
| `GET` | `/api/export?format=json` | Exporta todos os dados em formato JSON estruturado |

---

## 📋 Formato do Relatório Oficial (Markdown)

O gerador de relatórios (`/api/export?format=markdown` e botão "Ver Relatório .md" na interface) emite o formato estritamente compatível com a especificação:

```markdown
**Assunto:** Editais de consignado — GO e TO — [DD/MM/AAAA]

| Município/UF | Órgão | Edital ou chamamento | Objeto identificado | Publicação | Prazo/situação | Fonte oficial |
|---|---|---|---|---|---|---|
| Valparaiso de Goias/GO | MUNICIPIO DE VALPARAISO DE GOIAS | 43787 | CREDENCIAMENTO DE ENTIDADES FINANCEIRAS PARA CONCESSÃO DE EMPRÉSTIMOS CONSIGNADOS... | 16/03/2026 | 18/12/2026 (aberto) | [PNCP / Oficial](...) |

### Novidades do dia
- Publicações novas e alterações encontradas na rodada.

### Prazos próximos
- Processos com prazo informado e encerramento iminente.

### Observações
- Situações pendentes ou notas de auditoria.
```

---

## 📦 Imagem Oficial no Docker Hub

A imagem oficial multi-arquitetura está publicada no Docker Hub:
```bash
docker pull neguimzoiverde/editais-consignado-go-to:latest
```

---

## 🛡️ Licença
Distribuído sob licença proprietária para uso no ecossistema Sirius / Homelab.

---

## 🚢 Deploy no Portainer (srv01 / Docker Swarm)

Para subir no Portainer do `srv01` integrado ao **Traefik** e ao **Cloudflare Tunnel Automático** (`tunnel-sync`):

1. Acesse o **Portainer** do `srv01`.
2. Vá em **Stacks** -> **Add stack**.
3. **Name:** `buscaeditais`
4. Selecione **Web editor** e cole o conteúdo de [`stacks/buscaeditais.yml`](stacks/buscaeditais.yml).
5. Clique em **Deploy the stack**.

O `tunnel-sync` criará automaticamente o CNAME `buscaeditais.siriusalpha.com.br` no Cloudflare e o Traefik cuidará do roteamento e dos certificados SSL!

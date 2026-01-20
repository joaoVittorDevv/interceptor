# 🎬 Vibe Logger v2.0

**Gravador de Contexto Semântico para Agentes de IA + Interface de Visualização Interativa**

Vibe Logger captura não apenas vídeo, mas uma **timeline estruturada de interações do usuário** (cliques, requisições de rede, snapshots do DOM) otimizada para treinamento de LLMs e construção de contexto para agentes de IA. Agora com **interface web Vue.js** para visualização e análise interativa dos dados capturados.

---

## 🎯 Funcionalidades

### Backend (Captura)
- ✅ **Filtro Inteligente de Rede** — Ignora ruído de tracking/analytics, captura apenas chamadas de API relevantes
- ✅ **Rastreamento de Cliques com Feedback Visual** — Efeito ripple vermelho para gravação de vídeo, seletores CSS registrados
- ✅ **Snapshots HTML Limpos** — DOM sanitizado sem scripts, estilos ou SVGs
- ✅ **Análise de Performance (ETL)** — Detecta gargalos de renderização, *Long Tasks* e scripts pesados, convertendo gigabytes de logs brutos em métricas de poucos KB
- ✅ **Bypass de CSP (Trusted Types)** — Funciona em sites de alta segurança como Google/YouTube
- ✅ **Persistência de Estado** — Gravação continua entre navegações de página
- ✅ **Logs Separados** — Timeline para consumo de IA, dump de console para debug

### Frontend (Visualização) 🆕
- ✅ **Visualização de Timeline Interativa** — Interface web para explorar sessões capturadas
- ✅ **Lista de Sessões** — Visualize todas as sessões com contagem de eventos e timestamps
- ✅ **Eventos Color-Coded** — Identificação visual por tipo (cliques, rede, snapshots, performance, erros)
- ✅ **Expand/Collapse** — Clique em eventos para ver detalhes completos
- ✅ **Virtual Scrolling** — Performance otimizada para 1000+ eventos
- ✅ **Timestamps Formatados** — Datas legíveis em formato "yyyy-MM-dd HH:mm:ss.SSS"
- ✅ **Loading States** — Indicadores visuais durante carregamento de dados
- ✅ **🆕 Controle de Gravação via Web** — Inicie e pare capturas diretamente na interface

---

## 🖥️ GUI Usage (Controle via Interface Web) 🆕

A interface web agora permite **controlar gravações diretamente**, sem precisar do CLI.

### Quick Start
```bash
# 1. Instalar dependências
make install

# 2. Iniciar backend + frontend
make dev

# 3. Acessar interface
# Abra: http://localhost:5173
```

### Workflow
1. Acesse `http://localhost:5173`
2. Clique no botão **"⏺️ Iniciar Gravação"**
3. O navegador Chromium abre automaticamente
4. Navegue e interaja normalmente
5. Volte à interface e clique **"⏹️ Parar Gravação"**
6. A sessão aparece na lista abaixo

### Estados do Controle

| Estado | Indicador | Ação Disponível |
|--------|-----------|-----------------|
| ✅ Pronto | Verde | Iniciar Gravação |
| 🔴 Gravando | Vermelho pulsante | Parar Gravação |
| ⚠️ Erro | Laranja | Tentar Novamente |

### API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/capture/start` | Inicia captura (abre Puppeteer) |
| `POST` | `/api/capture/stop` | Para captura (fecha Puppeteer) |
| `GET` | `/api/capture/status` | Retorna estado atual |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vue.js Frontend (Vite) 🆕                     │
│                      (interceptor/)                              │
│  • RecordingControl.vue - Controle de gravação via web           │
│  • Session list view (HomeView.vue)                              │
│  • Timeline visualization (TimelineView.vue)                     │
│  • Pinia stores for state management                             │
│  • Port: 5173 (dev)                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (HTTP/JSON)
┌─────────────────────────────────────────────────────────────────┐
│                      Express.js API Server                       │
│                       (api-server.js)                            │
│  • GET /api/sessions → List all sessions                         │
│  • GET /api/sessions/:id/timeline → Get timeline data            │
│  • POST /api/capture/start → Start Puppeteer 🆕                  │
│  • POST /api/capture/stop → Stop Puppeteer 🆕                    │
│  • GET /api/capture/status → Capture status 🆕                   │
│  • Port: 3001                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (spawn/kill)
┌─────────────────────────────────────────────────────────────────┐
│                     Puppeteer Orchestrator                       │
│                         (index.js)                               │
│  • Browser automation and session capture                        │
│  • Network interception + filtering                              │
│  • Delegates to trace_cleaner.js and logger.js                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │    logger.js     │
                    │  (Data Layer)    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────────────┐
                    │   captures/session_*/    │
                    │   • timeline.json        │
                    │   • console_dump.log     │
                    │   • snap_clean_*.html    │
                    └──────────────────────────┘
```


---

## 📦 Instalação

### Backend (Captura de Sessões)

```bash
# Clone o repositório
git clone <repo-url>
cd Interceptor

# Instale as dependências do backend
npm install
```

### Frontend (Interface de Visualização) 🆕

```bash
# Navegue para o diretório do frontend
cd interceptor

# Instale as dependências do frontend
npm install
```

---

## ⚡ Makefile (Recomendado)

Para facilitar o desenvolvimento, use os comandos do Makefile:

```bash
# Ver todos os comandos disponíveis
make help

# Instalar todas as dependências (backend + frontend)
make install

# Executar API server + Frontend em paralelo
make dev

# Executar apenas API server
make server

# Executar apenas frontend
make frontend

# Executar ferramenta de captura
make capture

# Limpar node_modules
make clean

# Matar processos nas portas 3001 e 5173
make kill-ports
```

**Uso Rápido**:
```bash
# Primeira vez
make install

# Desenvolvimento diário
make dev
```

---

## 🚀 Como Usar

### Opção 1: Usando Makefile (Mais Fácil) ⭐

```bash
# Executar tudo de uma vez
make dev
```

Isso irá:
- ✅ Iniciar API server na porta 3001
- ✅ Iniciar frontend na porta 5173
- ✅ Ambos rodando em paralelo

**Acessar**: http://localhost:5173

---

### Opção 2: Captura + Visualização (Manual)

#### 1. Iniciar o API Server (Terminal 1)
```bash
node api-server.js
```

**Saída esperada:**
```
✅ API Server running on http://localhost:3001
📊 Serving sessions from: /path/to/Interceptor/captures
```

#### 2. Iniciar o Frontend (Terminal 2)
```bash
cd interceptor
npm run dev
```

**Saída esperada:**
```
VITE v7.3.1  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

#### 3. Acessar a Interface
Abra seu navegador em: **http://localhost:5173**

#### 4. Capturar uma Sessão (Terminal 3)
```bash
node index.js
```

Use os controles na tela:
- **● REC** — Inicia a sessão de gravação
- **■ SAVE** — Para a gravação e salva os arquivos

#### 5. Visualizar a Sessão Capturada
Volte para **http://localhost:5173** e clique na sessão recém-criada para visualizar a timeline.

---

### Opção 2: Apenas Captura (Modo Tradicional)

```bash
node index.js
```

### Controles na Tela

| Botão | Ação |
|-------|------|
| **● REC** | Inicia a sessão de gravação |
| **■ SAVE** | Para a gravação e salva os arquivos |

O painel da UI é **arrastável** e **redimensionável**. Um timer mostra o tempo decorrido de gravação.

### Feedback Visual

- **Ripple Vermelho** — Aparece no local do clique (visível em gravações de tela)
- **Toasts de Rede** — Notificações no canto inferior esquerdo para chamadas de API (coloridas por status)

---

## 🛠️ Stack Tecnológica

### Backend
- **Node.js** 18+ — Runtime JavaScript
- **Puppeteer** 21+ — Automação de navegador
- **Express.js** 4.x — API REST server
- **CORS** — Cross-Origin Resource Sharing
- **Compression** — Compressão gzip para respostas

### Frontend 🆕
- **Vue.js** 3.5+ — Framework progressivo
- **TypeScript** 5.9+ — Tipagem estática
- **Vite** 7.x — Build tool e dev server
- **Pinia** 2.x — State management (oficial Vue 3)
- **Vue Router** 4.x — Roteamento (hash mode)
- **vue-virtual-scroller** 2.0 — Virtual scrolling para performance
- **date-fns** 3.x — Formatação de datas
- **Chart.js** 5.x + **vue-chartjs** 5.x — Gráficos (para features P3)
- **@vueuse/core** — Utilitários composables

---

## 📊 Interface Web - Recursos Detalhados

### Página Inicial (Session List)
- **Grid Responsivo** — Layout adaptável com cards de sessão
- **Ordenação Automática** — Sessões mais recentes primeiro
- **Informações Rápidas** — Contagem de eventos e timestamp de cada sessão
- **Hover Effects** — Feedback visual ao passar o mouse
- **Estados de Loading** — Spinner durante carregamento

### Timeline View
- **Virtual Scrolling** — Renderiza apenas eventos visíveis para performance
- **Color-Coding por Tipo**:
  - 🔵 **USER_INTERACTION** — Azul (cliques, scrolls)
  - 🟣 **NETWORK_REQUEST** — Roxo (chamadas de API)
  - 🟢 **SNAPSHOT** — Verde (capturas de DOM)
  - 🟠 **PERFORMANCE_SUMMARY** — Laranja (métricas de performance)
  - 🔴 **CONSOLE_ERROR** — Vermelho (erros de console)
- **Expand/Collapse** — Clique em qualquer evento para ver JSON completo
- **Timestamps Precisos** — Formato "2026-01-20 15:23:05.123"
- **Estatísticas** — Contagem total de eventos exibida
- **Navegação** — Link "Back to Sessions" para retornar à lista

### Performance
- ✅ Carrega 1000 eventos em < 3 segundos
- ✅ Mantém 60 FPS durante scroll com 500+ eventos
- ✅ Bundle size otimizado (~120KB gzipped)
- ✅ Lazy loading de rotas

---

## 📁 Arquivos de Saída

Cada sessão de gravação cria uma pasta em `captures/`:

```
captures/
└── session_2026-01-14T15-23-02-361Z/
    ├── timeline.json          # Eventos estruturados para consumo de IA
    ├── console_dump.log       # Saída do console do navegador (debug)
    └── snap_clean_*.html      # Snapshots sanitizados do DOM
```

### Descrição dos Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `timeline.json` | **Saída principal.** Array cronológico de interações do usuário, requisições de rede e snapshots. Otimizado para contexto de LLM. |
| `console_dump.log` | Saída bruta do console do navegador com timestamps. Útil para debug, mas excluído da timeline para reduzir ruído. |
| `snap_clean_*.html` | Capturas HTML limpas acionadas por navegação ou erros. Scripts, estilos, SVGs e atributos de tracking removidos. |

---

## 📊 Estrutura de Dados

### Schema do timeline.json

```json
[
  {
    "timestamp": "2026-01-14T15:23:05.123Z",
    "type": "USER_INTERACTION",
    "data": {
      "action": "click",
      "x": 150,
      "y": 320,
      "selector": "button#submit",
      "tagName": "BUTTON"
    }
  },
  {
    "timestamp": "2026-01-14T15:23:06.456Z",
    "type": "NETWORK_REQUEST",
    "data": {
      "method": "POST",
      "url": "https://api.exemplo.com/login",
      "status": 200,
      "responseSnippet": "{\"token\": \"***REDACTED***\", \"user\": \"joao\"}"
    }
  },
  {
    "timestamp": "2026-01-14T15:23:07.789Z",
    "type": "SNAPSHOT",
    "data": {
      "file": "snap_clean_2026-01-14T15-23-07-789Z.html",
      "trigger": "navigation_complete"
    }
  },
  {
    "timestamp": "2026-01-16T13:25:03.779Z",
    "type": "PERFORMANCE_SUMMARY",
    "data": {
      "summary_type": "performance_bottlenecks",
      "metrics": {
        "total_blocking_time": 542.25,
        "long_tasks_count": 11,
        "categories": {
          "scripting": 1870.35,
          "rendering": 303.23,
          "painting": 49.65
        },
        "offenders": [
          "web-animations-next-lite.min.js (163.9ms)",
          "heavy-computation.js (93.7ms)"
        ]
      },
      "analysis_hint": "High main thread blocking detected. UI may feel unresponsive."
    }
  }
]
```

### Tipos de Eventos

| Tipo | Descrição |
|------|-----------|
| `USER_INTERACTION` | Eventos de clique com coordenadas e seletor CSS |
| `NETWORK_REQUEST` | Chamadas XHR/Fetch filtradas com snippets da resposta (máx 1KB) |
| `SNAPSHOT` | Referência ao arquivo HTML limpo, acionado por navegação ou erros |
| `PERFORMANCE_SUMMARY` | Resumo estatístico de uso de CPU, renderização e bloqueios (gerado ao final da sessão) |
| `CONSOLE_ERROR` | Erros críticos (também em console_dump.log com stack trace completo) |

---

## 🔒 Funcionalidades de Segurança

### Sanitização de Dados
- Chaves sensíveis (`password`, `token`, `auth`, `secret`, `apikey`) são **mascaradas** como `***REDACTED***`
- Atributos de tracking (`data-gtm-*`, `data-analytics-*`) removidos dos snapshots

### Blocklist de Rede
Ignora automaticamente:
- `google-analytics`, `googletagmanager`, `doubleclick`
- `facebook`, `fbcdn`, `hotjar`, `clarity`
- `metrics`, `telemetry`, `beacon`, `ping`

### Compatibilidade com CSP
Usa **política de Trusted Types** (`vibe-logger-policy`) para injetar a UI em sites com CSP restritivo.

---

## 🛠️ Configuração

### Método Recomendado: Arquivo de Configuração Externo

1. Copie o arquivo de exemplo:
   ```bash
   cp config.example.json config.json
   ```

2. Edite `config.json` com suas preferências:
   ```json
   {
     "urlBlocklist": ["my-tracker.com", "custom-analytics"],
     "ignoredExtensions": [".png", ".jpg"],
     "maxResponseSnippet": 2048
   }
   ```

3. Reinicie a aplicação para aplicar as mudanças.

**Campos Disponíveis:**
- `urlBlocklist`: Array de padrões de URL para ignorar
- `ignoredExtensions`: Array de extensões de arquivo para ignorar (incluir o ponto)
- `maxResponseSnippet`: Tamanho máximo do snippet de resposta em bytes

**Comportamento de Fallback:**
- Se `config.json` não existir, valores padrão serão usados
- Se o arquivo contiver JSON inválido, valores padrão serão usados
- Se um campo tiver tipo inválido, o valor padrão daquele campo será usado

### Método Alternativo: Edição Direta do Código

Para usuários avançados, as constantes padrão podem ser editadas em `index.js`:
```javascript
// Adicionar URLs para ignorar
const URL_BLOCKLIST = ['google-analytics', 'doubleclick', ...];

// Adicionar extensões de arquivo para pular
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.css', ...];

// Tamanho máximo do snippet de resposta (bytes)
const MAX_RESPONSE_SNIPPET = 1024;
```

---

## 📋 Requisitos

- Node.js 18+
- Puppeteer 21+

---

## 📄 Licença

MIT

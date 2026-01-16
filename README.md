# 🎬 Vibe Logger v1.1

**Gravador de Contexto Semântico para Agentes de IA**

Vibe Logger captura não apenas vídeo, mas uma **timeline estruturada de interações do usuário** (cliques, requisições de rede, snapshots do DOM) otimizada para treinamento de LLMs e construção de contexto para agentes de IA.

---

## 🎯 Funcionalidades

- ✅ **Filtro Inteligente de Rede** — Ignora ruído de tracking/analytics, captura apenas chamadas de API relevantes
- ✅ **Rastreamento de Cliques com Feedback Visual** — Efeito ripple vermelho para gravação de vídeo, seletores CSS registrados
- ✅ **Snapshots HTML Limpos** — DOM sanitizado sem scripts, estilos ou SVGs
- ✅ **Análise de Performance (ETL)** — Detecta gargalos de renderização, *Long Tasks* e scripts pesados, convertendo gigabytes de logs brutos em métricas de poucos KB.
- ✅ **Bypass de CSP (Trusted Types)** — Funciona em sites de alta segurança como Google/YouTube
- ✅ **Persistência de Estado** — Gravação continua entre navegações de página
- ✅ **Logs Separados** — Timeline para consumo de IA, dump de console para debug

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.js                                │
│                    (Orquestrador Puppeteer)                     │
│  • Inicialização e ciclo de vida do navegador                   │
│  • Interceptação de rede + Filtro Inteligente (blocklist)       │
│  • Controle de Sessão (Start/Stop/Snapshot)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌────────────────────┐          ┌────────────────────┐
    │  trace_cleaner.js  │          │    client_ui.js    │
    │     (Módulo ETL)   │          │ (Injected Script)  │
    └────────────────────┘          └────────────────────┘
              │                               │
              ▼                               ▼
    ┌────────────────────┐          ┌────────────────────┐
    │   timeline.json    │◀─────────│ Eventos de DOM     │
    │ (Output Unificado) │          │ Cliques & Scroll   │
    └────────────────────┘          └────────────────────┘
```

---

## 📦 Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd Interceptor

# Instale as dependências
npm install puppeteer
```

---

## 🚀 Como Usar

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

Edite as constantes em `index.js`:

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

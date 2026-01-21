# Interceptor Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-21

## Active Technologies

- (003-vue-frontend-arch) Vue.js 3.5 + Pinia + Vue Router + TypeScript
- (004-gui-integration) Express.js child_process API for capture control
- (rebuild-dashboard-mockup) Tailwind CSS 3.x via CDN + Material Icons Round

## Project Structure

```text
/                           # Root (backend)
├── api-server.js          # Express API (sessions + capture control + download/delete)
├── index.js               # Puppeteer orchestrator
├── logger.js              # Data layer
├── interceptor/           # Vue.js frontend
│   ├── index.html         # Tailwind CSS + fonts configuration
│   └── src/
│       ├── components/    # UI components
│       ├── stores/        # Pinia stores
│       ├── types/         # TypeScript types
│       └── views/         # Route views (HomeView with mockup design)
└── captures/              # Session output
```

## Commands

```bash
make install    # Install all dependencies
make dev        # Run API + Frontend (parallel)
make capture    # Run Puppeteer capture (CLI)
make kill-ports # Kill processes on 3001/5173
```

## Code Style

- Follow standard conventions
- Vue.js: Composition API with `<script setup>`
- TypeScript for frontend, JavaScript for backend
- Frontend: Tailwind CSS utility classes (no custom CSS unless necessary)
- Dark mode: Use `dark:` prefix for dark mode variants

## Recent Changes

- rebuild-dashboard-mockup: Complete UI redesign with Tailwind CSS matching mockups
- rebuild-dashboard-mockup: Added dark mode toggle with localStorage persistence
- rebuild-dashboard-mockup: Implemented session download (ZIP) and delete endpoints
- rebuild-dashboard-mockup: Changed primary button to "Gerenciar Navegador" (browser management)
- 004-gui-integration: Added capture control API endpoints (start/stop/status)
- 004-gui-integration: Added RecordingControl.vue component
- 004-gui-integration: Cleaned up Vue scaffold files
- 003-vue-frontend-arch: Added Vue.js frontend with timeline visualization

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

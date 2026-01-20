<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import SessionList from '@/components/SessionList.vue'
import RecordingControl from '@/components/RecordingControl.vue'

const sessionStore = useSessionStore()

onMounted(async () => {
  await sessionStore.loadSessions()
})
</script>

<template>
  <main class="home-view">
    <header class="header">
      <h1 class="title">🎬 Interceptor</h1>
      <p class="subtitle">Capture & Analyze Browser Sessions</p>
    </header>

    <!-- Recording Control (T013) -->
    <section class="control-section">
      <RecordingControl />
    </section>

    <div v-if="sessionStore.error" class="error-banner">
      <strong>Error:</strong> {{ sessionStore.error }}
    </div>
    
    <section class="sessions-section">
      <h2 class="section-title">📊 Sessões Capturadas</h2>
      <SessionList :sessions="sessionStore.sessions" :loading="sessionStore.loading" />
    </section>
  </main>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  padding: 32px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #9ca3af;
  font-size: 1.1rem;
  margin: 0;
}

.control-section {
  max-width: 600px;
  margin: 0 auto 32px auto;
}

.sessions-section {
  max-width: 900px;
  margin: 0 auto;
}

.section-title {
  color: #e0e0e0;
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.error-banner {
  max-width: 600px;
  margin: 0 auto 24px auto;
  padding: 16px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  border-radius: 8px;
}
</style>

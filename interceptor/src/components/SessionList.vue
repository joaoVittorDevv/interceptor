<script setup lang="ts">
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import type { Session } from '@/types/session'

defineProps<{
  sessions: Session[]
  loading: boolean
}>()

const router = useRouter()

function selectSession(sessionId: string) {
  router.push({ name: 'timeline', params: { sessionId } })
}

function formatDate(date: Date) {
  return format(date, 'yyyy-MM-dd HH:mm:ss')
}
</script>

<template>
  <div class="session-list">
    <h2>Captured Sessions</h2>
    
    <div v-if="loading" class="loading">
      Loading sessions...
    </div>
    
    <div v-else-if="sessions.length === 0" class="empty">
      No sessions found. Run the Vibe Logger to capture a session.
    </div>
    
    <div v-else class="sessions">
      <div
        v-for="session in sessions"
        :key="session.sessionId"
        class="session-card"
        @click="selectSession(session.sessionId)"
      >
        <div class="session-header">
          <h3>{{ session.sessionId }}</h3>
          <span class="event-count">{{ session.eventCount }} events</span>
        </div>
        <div class="session-meta">
          <span class="timestamp">{{ formatDate(session.timestamp) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.loading,
.empty {
  padding: 2rem;
  text-align: center;
  color: #666;
  background: #f5f5f5;
  border-radius: 8px;
}

.sessions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.session-card {
  padding: 1.5rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.session-card:hover {
  border-color: #42b983;
  box-shadow: 0 4px 12px rgba(66, 185, 131, 0.15);
  transform: translateY(-2px);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.session-header h3 {
  margin: 0;
  font-size: 0.9rem;
  font-family: monospace;
  color: #2c3e50;
}

.event-count {
  padding: 0.25rem 0.75rem;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.session-meta {
  display: flex;
  gap: 1rem;
}

.timestamp {
  font-family: monospace;
  font-size: 0.85rem;
  color: #666;
}
</style>

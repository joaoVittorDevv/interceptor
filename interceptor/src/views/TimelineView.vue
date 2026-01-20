<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import TimelineEvent from '@/components/TimelineEvent.vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const route = useRoute()
const sessionStore = useSessionStore()

const sessionId = computed(() => route.params.sessionId as string)
const session = computed(() => sessionStore.getSelectedSession())

onMounted(async () => {
  if (!session.value?.loaded) {
    await sessionStore.loadTimeline(sessionId.value)
  }
})
</script>

<template>
  <div class="timeline-view">
    <header class="timeline-header">
      <h1>Timeline: {{ sessionId }}</h1>
      <router-link to="/" class="back-link">← Back to Sessions</router-link>
    </header>
    
    <div v-if="sessionStore.loading" class="loading">
      <div class="spinner"></div>
      <p>Loading timeline...</p>
    </div>
    
    <div v-else-if="sessionStore.error" class="error">
      <strong>Error:</strong> {{ sessionStore.error }}
    </div>
    
    <div v-else-if="session?.events" class="timeline-content">
      <div class="timeline-stats">
        <span class="stat">
          <strong>{{ session.events.length }}</strong> events
        </span>
      </div>
      
      <RecycleScroller
        class="events-scroller"
        :items="session.events"
        :item-size="null"
        :buffer="200"
        key-field="index"
      >
        <template #default="{ item }">
          <TimelineEvent :event="item" />
        </template>
      </RecycleScroller>
    </div>
    
    <div v-else class="empty">
      No events found in this session.
    </div>
  </div>
</template>

<style scoped>
.timeline-view {
  min-height: 100vh;
  background: #f5f5f5;
}

.timeline-header {
  background: white;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeline-header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-family: monospace;
  color: #2c3e50;
}

.back-link {
  color: #42b983;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.back-link:hover {
  color: #35a372;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0;
  border-top-color: #42b983;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading p {
  color: #666;
  margin: 0;
}

.error {
  padding: 2rem;
  margin: 2rem;
  background: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
  border-radius: 4px;
}

.empty {
  padding: 4rem;
  text-align: center;
  color: #666;
}

.timeline-content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.timeline-stats {
  display: flex;
  gap: 2rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat {
  font-size: 0.9rem;
  color: #666;
}

.stat strong {
  color: #2c3e50;
  font-size: 1.1rem;
  margin-right: 0.25rem;
}

.events-scroller {
  height: calc(100vh - 250px);
  overflow-y: auto;
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { format, parseISO } from 'date-fns'
import type { Event } from '@/types/session'

const props = defineProps<{
  event: Event
}>()

const expanded = ref(false)

function toggleExpand() {
  expanded.value = !expanded.value
}

function formatTimestamp(timestamp: string) {
  return format(parseISO(timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')
}
</script>

<template>
  <div class="timeline-event" :class="`type-${event.type}`" @click="toggleExpand">
    <div class="event-header">
      <span class="timestamp">{{ formatTimestamp(event.timestamp) }}</span>
      <span class="type-badge">{{ event.type }}</span>
      <span class="expand-icon">{{ expanded ? '▼' : '▶' }}</span>
    </div>
    
    <div v-if="expanded" class="event-data">
      <pre>{{ JSON.stringify(event.data, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.timeline-event {
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: white;
  border-left: 4px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timeline-event:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateX(4px);
}

.event-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.timestamp {
  font-family: monospace;
  font-size: 0.85rem;
  color: #666;
  flex-shrink: 0;
}

.type-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.expand-icon {
  margin-left: auto;
  color: #999;
  font-size: 0.75rem;
}

.event-data {
  margin-top: 1rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  overflow-x: auto;
}

.event-data pre {
  margin: 0;
  font-family: monospace;
  font-size: 0.85rem;
  color: #2c3e50;
}

/* Type-specific colors */
.type-USER_INTERACTION {
  border-left-color: #1976d2;
}

.type-USER_INTERACTION .type-badge {
  background: #e3f2fd;
  color: #1976d2;
}

.type-NETWORK_REQUEST {
  border-left-color: #7b1fa2;
}

.type-NETWORK_REQUEST .type-badge {
  background: #f3e5f5;
  color: #7b1fa2;
}

.type-SNAPSHOT {
  border-left-color: #388e3c;
}

.type-SNAPSHOT .type-badge {
  background: #e8f5e9;
  color: #388e3c;
}

.type-PERFORMANCE_SUMMARY {
  border-left-color: #f57c00;
}

.type-PERFORMANCE_SUMMARY .type-badge {
  background: #fff3e0;
  color: #f57c00;
}

.type-CONSOLE_ERROR {
  border-left-color: #c62828;
}

.type-CONSOLE_ERROR .type-badge {
  background: #ffebee;
  color: #c62828;
}
</style>

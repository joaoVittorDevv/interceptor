import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Session, Event, SessionListResponse, TimelineResponse } from '@/types/session'

export const useSessionStore = defineStore('session', () => {
    // State
    const sessions = ref<Session[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    const selectedSessionId = ref<string | null>(null)

    // Actions
    async function loadSessions() {
        loading.value = true
        error.value = null

        try {
            const response = await fetch('http://localhost:3001/api/sessions')

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const data: SessionListResponse = await response.json()
            sessions.value = data.sessions.map((s) => ({
                ...s,
                timestamp: new Date(s.timestamp),
                loaded: false
            }))
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load sessions'
            console.error('Failed to load sessions:', err)
        } finally {
            loading.value = false
        }
    }

    async function loadTimeline(sessionId: string) {
        const session = sessions.value.find((s) => s.sessionId === sessionId)
        if (!session) {
            throw new Error(`Session ${sessionId} not found`)
        }

        loading.value = true
        error.value = null

        try {
            const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}/timeline`)

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || `HTTP ${response.status}`)
            }

            const data: TimelineResponse = await response.json()
            session.events = data.events.map((event, index) => ({
                ...event,
                index,
                expanded: false
            }))
            session.loaded = true
            selectedSessionId.value = sessionId
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load timeline'
            console.error('Failed to load timeline:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    // Getters
    function getSelectedSession() {
        return sessions.value.find((s) => s.sessionId === selectedSessionId.value)
    }

    return {
        // State
        sessions,
        loading,
        error,
        selectedSessionId,
        // Actions
        loadSessions,
        loadTimeline,
        // Getters
        getSelectedSession
    }
})

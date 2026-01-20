/**
 * Recording Store (Pinia)
 * T008: Manages recording state and API interactions
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CaptureStatus, CaptureStartResponse, CaptureStopResponse, CaptureStatusResponse } from '@/types/capture'

const API_BASE = 'http://localhost:3001'

export const useRecordingStore = defineStore('recording', () => {
    // State
    const status = ref<CaptureStatus>('IDLE')
    const startedAt = ref<string | null>(null)
    const pid = ref<number | null>(null)
    const error = ref<string | null>(null)
    const lastSessionId = ref<string | null>(null)
    const isLoading = ref(false)

    // Computed
    const isRecording = computed(() => status.value === 'RECORDING')
    const isIdle = computed(() => status.value === 'IDLE')
    const hasError = computed(() => status.value === 'ERROR' || error.value !== null)

    // Actions
    async function fetchStatus() {
        try {
            const response = await fetch(`${API_BASE}/api/capture/status`)
            if (!response.ok) throw new Error('Failed to fetch status')

            const data: CaptureStatusResponse = await response.json()
            status.value = data.status
            startedAt.value = data.startedAt
            pid.value = data.pid
            error.value = data.error
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Connection failed'
            status.value = 'ERROR'
        }
    }

    async function startCapture() {
        if (isLoading.value || isRecording.value) return

        isLoading.value = true
        error.value = null

        try {
            const response = await fetch(`${API_BASE}/api/capture/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to start recording')
            }

            const data: CaptureStartResponse = await response.json()
            status.value = 'RECORDING'
            startedAt.value = data.startedAt
            pid.value = data.pid
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Servidor não disponível'
            status.value = 'ERROR'
        } finally {
            isLoading.value = false
        }
    }

    async function stopCapture() {
        if (isLoading.value || !isRecording.value) return

        isLoading.value = true
        error.value = null

        try {
            const response = await fetch(`${API_BASE}/api/capture/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to stop recording')
            }

            const data: CaptureStopResponse = await response.json()
            status.value = 'IDLE'
            startedAt.value = null
            pid.value = null
            lastSessionId.value = data.sessionId
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to stop'
            status.value = 'ERROR'
        } finally {
            isLoading.value = false
        }
    }

    function clearError() {
        error.value = null
        if (status.value === 'ERROR') {
            status.value = 'IDLE'
        }
    }

    return {
        // State
        status,
        startedAt,
        pid,
        error,
        lastSessionId,
        isLoading,
        // Computed
        isRecording,
        isIdle,
        hasError,
        // Actions
        fetchStatus,
        startCapture,
        stopCapture,
        clearError
    }
})

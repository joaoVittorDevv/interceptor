<script setup lang="ts">
/**
 * RecordingControl Component
 * T010-T016: Main control for starting/stopping recording with visual feedback
 */

import { onMounted } from 'vue'
import { useRecordingStore } from '@/stores/recording'

const recording = useRecordingStore()

// Fetch initial status on mount
onMounted(() => {
    recording.fetchStatus()
})

function handleToggle() {
    if (recording.isRecording) {
        recording.stopCapture()
    } else {
        recording.startCapture()
    }
}
</script>

<template>
    <div class="recording-control" :class="{ 
        'is-recording': recording.isRecording,
        'is-error': recording.hasError,
        'is-loading': recording.isLoading 
    }">
        <!-- Status Indicator (T011) -->
        <div class="status-indicator">
            <span class="status-dot" :class="recording.status.toLowerCase()"></span>
            <span class="status-text">
                <template v-if="recording.isLoading">Processando...</template>
                <template v-else-if="recording.isRecording">🔴 Gravando...</template>
                <template v-else-if="recording.hasError">⚠️ Erro</template>
                <template v-else>✅ Pronto para gravar</template>
            </span>
        </div>

        <!-- Main Button (T010, T014) -->
        <button 
            class="control-button"
            :class="{ recording: recording.isRecording }"
            :disabled="recording.isLoading"
            @click="handleToggle"
        >
            <span class="button-icon">
                {{ recording.isRecording ? '⏹️' : '⏺️' }}
            </span>
            <span class="button-text">
                {{ recording.isRecording ? 'Parar Gravação' : 'Iniciar Gravação' }}
            </span>
        </button>

        <!-- Error Message (T012) -->
        <div v-if="recording.error" class="error-message">
            <span class="error-icon">❌</span>
            <span class="error-text">{{ recording.error }}</span>
            <button class="error-dismiss" @click="recording.clearError">×</button>
        </div>

        <!-- Last Session Info -->
        <div v-if="recording.lastSessionId" class="last-session">
            <span class="session-icon">📁</span>
            <span class="session-text">Última sessão: {{ recording.lastSessionId }}</span>
        </div>
    </div>
</template>

<style scoped>
/* T016: Recording button styles */
.recording-control {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
}

.status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #666;
    transition: all 0.3s ease;
}

.status-dot.idle {
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

.status-dot.recording {
    background: #ef4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
    animation: pulse 1.5s infinite;
}

.status-dot.error {
    background: #f97316;
    box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
}

@keyframes pulse {
    0%, 100% { 
        transform: scale(1); 
        opacity: 1; 
    }
    50% { 
        transform: scale(1.3); 
        opacity: 0.7; 
    }
}

.status-text {
    color: #e0e0e0;
    font-size: 14px;
    font-weight: 500;
}

.control-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 32px;
    font-size: 16px;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
}

.control-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

.control-button:active:not(:disabled) {
    transform: translateY(0);
}

.control-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.control-button.recording {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

.control-button.recording:hover:not(:disabled) {
    box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
}

.button-icon {
    font-size: 20px;
}

.error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 14px;
}

.error-dismiss {
    margin-left: auto;
    background: none;
    border: none;
    color: #fca5a5;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
}

.error-dismiss:hover {
    color: white;
}

.last-session {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding: 12px 16px;
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.2);
    border-radius: 8px;
    color: #86efac;
    font-size: 13px;
}

.session-text {
    font-family: monospace;
}
</style>

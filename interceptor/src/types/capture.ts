/**
 * Capture API Types
 * Type definitions for capture control endpoints
 */

export type CaptureStatus = 'IDLE' | 'RECORDING' | 'ERROR';

export interface CaptureStartResponse {
    status: 'RECORDING';
    startedAt: string;
    pid: number;
}

export interface CaptureStopResponse {
    status: 'IDLE';
    sessionId: string;
    stoppedAt: string;
}

export interface CaptureStatusResponse {
    status: CaptureStatus;
    startedAt: string | null;
    pid: number | null;
    error: string | null;
}

export interface CaptureErrorResponse {
    error: string;
    message: string;
}

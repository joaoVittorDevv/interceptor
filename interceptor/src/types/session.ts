// Event Types
export type EventType =
    | 'USER_INTERACTION'
    | 'NETWORK_REQUEST'
    | 'SNAPSHOT'
    | 'PERFORMANCE_SUMMARY'
    | 'CONSOLE_ERROR'

// Event Data Types
export interface UserInteractionData {
    action: string
    x: number
    y: number
    selector: string
    tagName: string
}

export interface NetworkRequestData {
    method: string
    url: string
    status: number
    responseSnippet: string
}

export interface SnapshotData {
    file: string
    trigger: string
}

export interface PerformanceSummaryData {
    summary_type: string
    metrics: {
        total_blocking_time: number
        long_tasks_count: number
        categories: {
            scripting: number
            rendering: number
            painting: number
        }
        offenders: string[]
    }
    analysis_hint: string
}

export interface ConsoleErrorData {
    message: string
    stack?: string
    source?: string
    line?: number
}

export type EventData =
    | UserInteractionData
    | NetworkRequestData
    | SnapshotData
    | PerformanceSummaryData
    | ConsoleErrorData

// Core Entities
export interface Event {
    timestamp: string
    type: EventType
    data: EventData
    index?: number
    expanded?: boolean
}

export interface Session {
    sessionId: string
    timestamp: Date
    eventCount: number
    filePath: string
    loaded: boolean
    events?: Event[]
}

export interface EventFilter {
    types: EventType[]
    searchQuery: string
    caseSensitive: boolean
}

export interface UIState {
    selectedSessionId: string | null
    loading: boolean
    error: string | null
    expandedEventIndices: Set<number>
}

// API Response Types
export interface SessionListResponse {
    sessions: {
        sessionId: string
        timestamp: string
        eventCount: number
        filePath: string
    }[]
    total: number
}

export interface TimelineResponse {
    sessionId: string
    events: Event[]
    metadata: {
        eventCount: number
        firstEventTimestamp: string | null
        lastEventTimestamp: string | null
        duration: number | null
    }
}

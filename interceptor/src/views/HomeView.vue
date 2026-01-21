<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()

// Dark mode toggle from App.vue
const toggleTheme = inject<() => void>('toggleTheme')

// Search and pagination state
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 10

// Load sessions on mount
onMounted(async () => {
  await sessionStore.loadSessions()
})

// Filtered sessions based on search
const filteredSessions = computed(() => {
  if (!searchQuery.value) {
    return sessionStore.sessions
  }
  return sessionStore.sessions.filter(session =>
    session.sessionId.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Paginated sessions
const paginatedSessions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredSessions.value.slice(start, end)
})

// Pagination metadata
const totalPages = computed(() => Math.ceil(filteredSessions.value.length / itemsPerPage))
const startIndex = computed(() => (currentPage.value - 1) * itemsPerPage + 1)
const endIndex = computed(() => Math.min(currentPage.value * itemsPerPage, filteredSessions.value.length))

// Page numbers to display
const pageNumbers = computed(() => {
  const pages = []
  for (let i = 1; i <= Math.min(totalPages.value, 3); i++) {
    pages.push(i)
  }
  return pages
})

// Pagination handlers
function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

// Session actions
async function viewSession(sessionId: string) {
  // Navigate to timeline view (existing functionality)
  window.location.hash = `#/timeline/${sessionId}`
}

async function downloadSession(sessionId: string) {
  try {
    const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}/download`)
    
    if (!response.ok) {
      throw new Error('Failed to download session')
    }
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionId}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download error:', error)
    alert('Failed to download session. Please try again.')
  }
}

async function deleteSession(sessionId: string) {
  if (!confirm(`Are you sure you want to delete session ${sessionId}?\n\nThis action cannot be undone.`)) {
    return
  }

  try {
    const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete session')
    }
    
    // Refresh session list after successful deletion
    await sessionStore.loadSessions()
    
    // Reset to first page if current page is now empty
    if (paginatedSessions.value.length === 0 && currentPage.value > 1) {
      currentPage.value = 1
    }
  } catch (error) {
    console.error('Delete error:', error)
    alert(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Browser management (replaces recording control)
async function manageBrowser() {
  try {
    // Call the capture start endpoint to open/focus browser
    const response = await fetch('http://localhost:3001/api/capture/start', {
      method: 'POST'
    })
    
    if (!response.ok) {
      const error = await response.json()
      // If already recording, that's fine - browser is already open
      if (error.error === 'Recording already in progress') {
        alert('Browser is already open and ready for recording.')
        return
      }
      throw new Error(error.message || 'Failed to open browser')
    }
    
    const result = await response.json()
    console.log('Browser opened:', result)
  } catch (error) {
    console.error('Browser management error:', error)
    alert(`Failed to manage browser: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Navigation Bar -->
    <nav class="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-20 items-center">
          <!-- Logo Section -->
          <div class="flex items-center gap-3">
            <div class="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg">
              <span class="material-icons-round text-primary text-2xl">movie_filter</span>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Interceptor</h1>
              <p class="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Capture & Analyze</p>
            </div>
          </div>

          <!-- Right Section -->
          <div class="flex items-center gap-4 sm:gap-6">
            <!-- Status Badge (desktop only) -->
            <div class="hidden md:flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-900/50">
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span class="text-sm font-medium text-green-700 dark:text-green-400">Pronto para gravar</span>
            </div>

            <!-- Primary Action Button -->
            <button 
              @click="manageBrowser"
              class="bg-primary hover:bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition-all transform active:scale-95 font-medium"
            >
              <span class="material-icons-round text-lg">radio_button_checked</span>
              <span>Gerenciar Navegador</span>
            </button>

            <!-- Divider -->
            <div class="h-8 w-px bg-border-light dark:bg-border-dark hidden sm:block"></div>

            <!-- Dark Mode Toggle -->
            <button 
              @click="toggleTheme"
              class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <span class="material-icons-round block dark:hidden">dark_mode</span>
              <span class="material-icons-round hidden dark:block text-yellow-400">light_mode</span>
            </button>

            <!-- Mobile Menu Button -->
            <button class="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
              <span class="material-icons-round">menu</span>
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-grow w-full px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header Section -->
      <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span class="material-icons-round text-primary">assessment</span>
            Sessões Capturadas
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Gerencie e analise suas gravações de sessão recentes.</p>
        </div>

        <!-- Search and Filter Controls -->
        <div class="flex gap-3">
          <div class="relative">
            <input 
              v-model="searchQuery"
              class="pl-10 pr-4 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-surface-dark text-sm focus:ring-2 focus:ring-primary focus:border-transparent w-full sm:w-64 dark:text-white dark:placeholder-gray-500"
              placeholder="Buscar por ID..."
              type="text"
            />
            <span class="material-icons-round absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
          </div>
          <button class="p-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <span class="material-icons-round">filter_list</span>
          </button>
        </div>
      </div>

      <!-- Sessions Table -->
      <div class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-border-light dark:divide-border-dark">
            <thead class="bg-gray-50 dark:bg-white/5">
              <tr>
                <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nome da Sessão
                </th>
                <th scope="col" class="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody class="bg-surface-light dark:bg-surface-dark divide-y divide-border-light dark:divide-border-dark">
              <!-- Empty State -->
              <tr v-if="paginatedSessions.length === 0">
                <td colspan="2" class="px-6 py-12 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <span class="material-icons-round text-gray-400 text-5xl">folder_open</span>
                    <p class="text-gray-500 dark:text-gray-400">Nenhuma sessão encontrada</p>
                    <p class="text-sm text-gray-400 dark:text-gray-500">Inicie uma gravação para começar</p>
                  </div>
                </td>
              </tr>

              <!-- Session Rows -->
              <tr 
                v-for="session in paginatedSessions" 
                :key="session.sessionId"
                class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <span class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-mono">
                      {{ session.sessionId }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    @click="viewSession(session.sessionId)"
                    class="text-primary hover:text-indigo-800 dark:hover:text-indigo-300 mr-3 transition-colors" 
                    title="Visualizar"
                  >
                    <span class="material-icons-round text-xl align-middle">visibility</span>
                  </button>
                  <button 
                    @click="downloadSession(session.sessionId)"
                    class="text-primary hover:text-indigo-800 dark:hover:text-indigo-300 mr-3 transition-colors" 
                    title="Download"
                  >
                    <span class="material-icons-round text-xl align-middle">download</span>
                  </button>
                  <button 
                    @click="deleteSession(session.sessionId)"
                    class="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" 
                    title="Excluir"
                  >
                    <span class="material-icons-round text-xl align-middle">delete_outline</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="filteredSessions.length > 0" class="bg-white dark:bg-surface-dark px-4 py-3 flex items-center justify-between border-t border-border-light dark:border-border-dark sm:px-6">
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-400">
                Mostrando <span class="font-medium text-gray-900 dark:text-white">{{ startIndex }}</span> a 
                <span class="font-medium text-gray-900 dark:text-white">{{ endIndex }}</span> de 
                <span class="font-medium text-gray-900 dark:text-white">{{ filteredSessions.length }}</span> resultados
              </p>
            </div>
            <div>
              <nav aria-label="Pagination" class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  @click="previousPage"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span class="sr-only">Anterior</span>
                  <span class="material-icons-round text-sm">chevron_left</span>
                </button>

                <button
                  v-for="page in pageNumbers"
                  :key="page"
                  @click="goToPage(page)"
                  :class="[
                    page === currentPage
                      ? 'z-10 bg-indigo-50 dark:bg-indigo-900/30 border-primary text-primary'
                      : 'bg-white dark:bg-surface-dark border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                    'relative inline-flex items-center px-4 py-2 border text-sm font-medium'
                  ]"
                >
                  {{ page }}
                </button>

                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span class="sr-only">Próximo</span>
                  <span class="material-icons-round text-sm">chevron_right</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark py-6 mt-auto">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 dark:text-gray-400">
        <div class="flex items-center gap-2 mb-2 sm:mb-0">
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          Sistema Operacional
        </div>
        <div>
          © 2026 Interceptor Tool. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>

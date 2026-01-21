<script setup lang="ts">
import { RouterView } from 'vue-router'
import { ref, onMounted, watch } from 'vue'

// Dark mode state
const isDark = ref(false)

// Initialize dark mode from localStorage
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  isDark.value = savedTheme === 'dark'
  applyTheme()
})

// Watch for theme changes and apply
watch(isDark, () => {
  applyTheme()
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
})

// Apply theme to document
function applyTheme() {
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Toggle theme function (will be used by child components via provide/inject)
function toggleTheme() {
  isDark.value = !isDark.value
}

// Provide theme state and toggle function to child components
import { provide } from 'vue'
provide('isDark', isDark)
provide('toggleTheme', toggleTheme)
</script>

<template>
  <div id="app" class="bg-background-light dark:bg-background-dark text-gray-800 dark:text-gray-200 min-h-screen transition-colors duration-300">
    <RouterView />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
    'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>

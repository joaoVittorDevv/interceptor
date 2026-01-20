import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/session/:sessionId',
      name: 'timeline',
      component: () => import('../views/TimelineView.vue')
    }
  ]
})

export default router

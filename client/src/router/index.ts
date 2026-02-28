import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('@/views/SetupView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/sites',
      name: 'sites',
      component: () => import('@/views/SiteListView.vue'),
    },
    {
      path: '/sites/new',
      name: 'site-new',
      component: () => import('@/views/SiteEditView.vue'),
    },
    {
      path: '/sites/:id/edit',
      name: 'site-edit',
      component: () => import('@/views/SiteEditView.vue'),
      props: true,
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('@/views/ImportView.vue'),
    },
    {
      path: '/monitor',
      name: 'monitor',
      component: () => import('@/views/MonitorView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (auth.loading) {
    await auth.checkStatus();
  }

  // Pokud setup není hotový, přesměrovat na setup
  if (!auth.setupComplete && to.name !== 'setup') {
    return { name: 'setup' };
  }

  // Pokud je setup hotový a jsme na setup stránce
  if (auth.setupComplete && to.name === 'setup') {
    return { name: 'login' };
  }

  // Pokud stránka vyžaduje přihlášení
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' };
  }

  // Pokud jsme přihlášeni a jdeme na login
  if (auth.isAuthenticated && to.name === 'login') {
    return { name: 'dashboard' };
  }
});

export default router;

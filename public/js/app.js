import { insforge } from './insforge.js';
import { upsertProfile } from './api.js';
import { render as renderToday } from './views/today.js';
import { render as renderWorkout } from './views/workout.js';
import { render as renderSchedule } from './views/schedule.js';
import { render as renderTemplates } from './views/templates.js';
import { render as renderExercises } from './views/exercises.js';
import { render as renderHistory } from './views/history.js';
import { render as renderLogin } from './views/login.js';

const views = {
  today: renderToday,
  workout: renderWorkout,
  schedule: renderSchedule,
  templates: renderTemplates,
  exercises: renderExercises,
  history: renderHistory,
};

const appEl = document.getElementById('app');
const navEl = document.getElementById('bottom-nav');
const navBtns = document.querySelectorAll('.nav-btn');

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/');
  const route = parts[0] || 'today';
  const param = parts[1] || null;
  return { route, param };
}

let currentUser = null;

let isNavigating = false;
async function navigate() {
  if (isNavigating) return;
  isNavigating = true;
  try {
    // Try to get user from memory/storage first
    currentUser = insforge.auth.tokenManager.getUser();
    
    let authError = null;
    // Only call getCurrentUser if we don't have a user or if we have an OAuth code
    if (!currentUser || location.search.includes('insforge_code')) {
      const { data, error } = await insforge.auth.getCurrentUser().catch((err) => {
        console.error('Auth error:', err);
        authError = err;
        if (location.search.includes('insforge_code')) {
          location.search = ''; 
          return { data: { user: null }, error: err };
        }
        return { data: { user: null }, error: null };
      });
      currentUser = data?.user ?? null;
    }

    if (!currentUser) {
      // If no user but we have a code in URL, getCurrentUser should have handled it.
      // If still no user, show login.
      navEl.style.display = 'none';
      await renderLogin(appEl, { 
        error: authError || error,
        hasCode: location.search.includes('insforge_code')
      });
      return;
    }

    // Persist profile info on first load
    await upsertProfile(currentUser).catch(console.warn);

    navEl.style.display = 'flex';

    const { route, param } = parseHash();

    navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });

    const renderFn = views[route];
    if (!renderFn) {
      appEl.innerHTML = `<div class="page"><div class="empty"><div class="empty-text">Page not found</div></div></div>`;
      return;
    }

    appEl.innerHTML = '<div class="loading">Loading...</div>';

    const params = { userId: currentUser.id };
    if (route === 'workout' && param) params.sessionId = param;
    if (route === 'templates' && param) params.templateId = param;
    if (route === 'history' && param) params.sessionId = param;
    await renderFn(appEl, params);
  } catch (err) {
    console.error('View render error:', err);
    appEl.innerHTML = `<div class="page"><div class="empty"><div class="empty-text">Something went wrong</div><div class="empty-sub">${err.message}</div></div></div>`;
  } finally {
    isNavigating = false;
  }
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    location.hash = '#/' + btn.dataset.route;
  });
});

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', async () => {
  // If we have an OAuth code, handle it immediately before rendering anything
  if (location.search.includes('insforge_code')) {
    try {
      await insforge.auth.getCurrentUser();
      // Clean up the URL
      const url = new URL(location.href);
      url.searchParams.delete('insforge_code');
      history.replaceState({}, document.title, url.pathname + url.hash);
    } catch (err) {
      console.error('Initial auth error:', err);
    }
  }
  navigate();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW:', err));
  });
}

window.__logout = async () => {
  await insforge.auth.signOut().catch(console.error);
  currentUser = null;
  location.hash = '';
  navigate();
};

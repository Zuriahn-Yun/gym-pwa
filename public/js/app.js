import { render as renderToday } from './views/today.js';
import { render as renderWorkout } from './views/workout.js';
import { render as renderSchedule } from './views/schedule.js';
import { render as renderTemplates } from './views/templates.js';
import { render as renderExercises } from './views/exercises.js';
import { render as renderHistory } from './views/history.js';

const views = {
  today: renderToday,
  workout: renderWorkout,
  schedule: renderSchedule,
  templates: renderTemplates,
  exercises: renderExercises,
  history: renderHistory,
};

const appEl = document.getElementById('app');
const navBtns = document.querySelectorAll('.nav-btn');

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/');
  const route = parts[0] || 'today';
  const param = parts[1] || null;
  return { route, param };
}

async function navigate() {
  const { route, param } = parseHash();

  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });

  const renderFn = views[route];
  if (!renderFn) {
    appEl.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">🤷</div><div class="empty-text">Page not found</div></div></div>`;
    return;
  }

  appEl.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const params = {};
    if (route === 'workout' && param) params.sessionId = param;
    if (route === 'templates' && param) params.templateId = param;
    if (route === 'history' && param) params.sessionId = param;
    await renderFn(appEl, params);
  } catch (err) {
    console.error('View render error:', err);
    appEl.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Something went wrong</div><div class="empty-sub">${err.message}</div></div></div>`;
  }
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    location.hash = '#/' + btn.dataset.route;
  });
});

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW:', err));
  });
}

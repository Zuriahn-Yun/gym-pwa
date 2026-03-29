import * as api from '../api.js';

export async function render(container, params) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const [schedule, sessions] = await Promise.all([api.getSchedule(), api.getSessions(3, 0)]);
    // JS: 0=Sun,1=Mon..6=Sat → App: 0=Mon..6=Sun
    const jsDay = new Date().getDay();
    const appDay = jsDay === 0 ? 6 : jsDay - 1;
    const today = schedule[appDay];
    const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    container.innerHTML = `
      <div class="page">
        <h1 class="page-title">Today</h1>
        <div class="card" style="text-align:center; padding:28px 16px;">
          ${today.template_id ? `
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">Scheduled Workout</div>
            <div style="font-size:28px;font-weight:700;margin-bottom:20px;">${today.template_name}</div>
            <button class="btn btn-primary btn-full" id="start-btn" style="font-size:17px;padding:14px;">Start Workout</button>
          ` : `
            <div style="font-size:48px;margin-bottom:12px;">🛌</div>
            <div style="font-size:20px;font-weight:600;margin-bottom:8px;">Rest Day</div>
            <div style="color:var(--text-muted);font-size:14px;margin-bottom:18px;">No workout scheduled today</div>
            <button class="btn btn-secondary" id="start-empty-btn">Start Empty Workout</button>
          `}
        </div>
        <div style="font-size:15px;font-weight:600;color:var(--text-muted);margin-bottom:10px;">Recent</div>
        ${sessions.length === 0
          ? `<div class="empty" style="padding:24px;"><div class="empty-icon">📝</div><div class="empty-text">No workouts yet</div><div class="empty-sub">Start your first workout above</div></div>`
          : sessions.map(s => `
            <div class="card" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;" data-sid="${s.id}">
              <div>
                <div class="card-title">${s.template_name || 'Custom Workout'}</div>
                <div style="color:var(--text-muted);font-size:13px;">${fmt(s.started_at)} · ${s.exercise_count || 0} exercises</div>
              </div>
              <span style="color:var(--text-muted);font-size:20px;">›</span>
            </div>
          `).join('')}
      </div>`;

    const startBtn = container.querySelector('#start-btn');
    if (startBtn) startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.textContent = 'Starting...';
      const s = await api.createSession(today.template_id);
      location.hash = '#/workout/' + s.id;
    });

    const emptyBtn = container.querySelector('#start-empty-btn');
    if (emptyBtn) emptyBtn.addEventListener('click', async () => {
      const s = await api.createSession(null);
      location.hash = '#/workout/' + s.id;
    });

    container.querySelectorAll('[data-sid]').forEach(el =>
      el.addEventListener('click', () => { location.hash = '#/history/' + el.dataset.sid; }));
  } catch (err) {
    container.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">${err.message}</div></div></div>`;
  }
}

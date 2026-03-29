import * as api from '../api.js';

export async function render(container, params) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  const sessions = await api.getSessions(50, 0);

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const fmtDur = (start, end) => {
    if (!end) return 'In progress';
    const m = Math.round((new Date(end) - new Date(start)) / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
  };

  container.innerHTML = `<div class="page">
    <h1 class="page-title">History</h1>
    ${sessions.length === 0
      ? '<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">No workouts logged yet</div><div class="empty-sub">Start a workout from Today</div></div>'
      : sessions.map(s => `
        <div class="card session-card" data-sid="${s.id}" style="cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="card-title">${s.template_name || 'Custom Workout'}</div>
              <div style="color:var(--text-muted);font-size:13px;">${fmtDate(s.started_at)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:13px;color:var(--text-muted);">${fmtDur(s.started_at, s.finished_at)}</div>
              <div style="font-size:12px;color:var(--text-muted);">${s.exercise_count || 0} exercises</div>
            </div>
          </div>
          <div class="session-detail" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px;"></div>
        </div>`).join('')}
  </div>`;

  container.addEventListener('click', async (e) => {
    const card = e.target.closest('.session-card');
    if (!card) return;
    const detail = card.querySelector('.session-detail');
    if (detail.style.display !== 'none') { detail.style.display = 'none'; return; }
    detail.style.display = 'block';
    detail.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Loading...</div>';
    const sess = await api.getSession(parseInt(card.dataset.sid));
    if (!sess.exercises.length) {
      detail.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No exercises logged</div>';
      return;
    }
    detail.innerHTML = sess.exercises.map(ex => {
      const done = ex.sets.filter(s => s.completed);
      const summary = done.length ? done.map(s => `${s.weight} lbs×${s.reps}`).join(', ') : 'No completed sets';
      return `<div style="margin-bottom:8px;">
        <div style="font-weight:600;font-size:14px;">${ex.name}</div>
        <div style="color:var(--text-muted);font-size:12px;margin-top:2px;">${summary}</div>
      </div>`;
    }).join('');
  });
}

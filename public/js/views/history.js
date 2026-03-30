import * as api from '../api.js';

export async function render(container, params) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  let sessions = await api.getSessions(50, 0);

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const fmtDur = (start, end) => {
    if (!end) return 'In progress';
    const m = Math.round((new Date(end) - new Date(start)) / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
  };

  function sessionCardHtml(s) {
    return `<div class="card session-card" data-sid="${s.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;min-width:0;cursor:pointer;" class="session-toggle">
          <div class="card-title">${s.templates?.name ?? s.template_name ?? 'Custom Workout'}</div>
          <div style="color:var(--text-muted);font-size:13px;">${fmtDate(s.started_at)} · ${fmtDur(s.started_at, s.finished_at)}</div>
        </div>
        <button class="btn btn-danger btn-sm del-session" data-sid="${s.id}" style="margin-left:12px;flex-shrink:0;">Delete</button>
      </div>
      <div class="session-detail" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px;"></div>
    </div>`;
  }

  function renderList() {
    const listEl = container.querySelector('#session-list');
    if (!listEl) return;
    listEl.innerHTML = sessions.length === 0
      ? '<div class="empty"><div class="empty-text">No workouts logged yet</div><div class="empty-sub">Start a workout from Today</div></div>'
      : sessions.map(sessionCardHtml).join('');
  }

  container.innerHTML = `<div class="page">
    <h1 class="page-title">History</h1>
    <div id="session-list"></div>
  </div>`;

  renderList();

  container.addEventListener('click', async (e) => {
    // Delete session
    const delBtn = e.target.closest('.del-session');
    if (delBtn) {
      e.stopPropagation();
      if (!confirm('Delete this workout?')) return;
      const sid = parseInt(delBtn.dataset.sid);
      try {
        await api.deleteSession(sid);
        sessions = sessions.filter(s => s.id !== sid);
        renderList();
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
      return;
    }

    // Toggle detail
    const toggle = e.target.closest('.session-toggle');
    if (!toggle) return;
    const card = toggle.closest('.session-card');
    const detail = card.querySelector('.session-detail');
    if (detail.style.display !== 'none') { detail.style.display = 'none'; return; }
    detail.style.display = 'block';
    detail.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Loading...</div>';
    let sess;
    try {
      sess = await api.getSession(parseInt(card.dataset.sid));
    } catch (err) {
      detail.innerHTML = `<div style="color:var(--text-muted);font-size:13px;">Failed to load: ${err.message}</div>`;
      return;
    }
    const sessExercises = sess.session_exercises || [];
    if (!sessExercises.length) {
      detail.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No exercises logged</div>';
      return;
    }
    detail.innerHTML = sessExercises.map(ex => {
      const done = (ex.sets || []).filter(s => s.completed);
      const summary = done.length ? done.map(s => `${s.weight} lbs×${s.reps}`).join(', ') : 'No completed sets';
      const exName = ex.exercises?.name ?? ex.name ?? 'Unknown';
      return `<div style="margin-bottom:8px;">
        <div style="font-weight:600;font-size:14px;">${exName}</div>
        <div style="color:var(--text-muted);font-size:12px;margin-top:2px;">${summary}</div>
      </div>`;
    }).join('');
  });
}

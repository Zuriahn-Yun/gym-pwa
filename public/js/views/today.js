import * as api from '../api.js';

export async function render(container, params) {
  const userId = params?.userId ?? null;
  container.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const [schedule, sessions] = await Promise.all([api.getSchedule(), api.getSessions(3, 0)]);
    // JS: 0=Sun,1=Mon..6=Sat → App: 0=Mon..6=Sun
    const jsDay = new Date().getDay();
    const appDay = jsDay === 0 ? 6 : jsDay - 1;
    const today = schedule.find(d => d.day_of_week === appDay) ?? schedule[appDay];
    const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    container.innerHTML = `
      <div class="page">
        <h1 class="page-title">Today</h1>
        <div class="card" style="text-align:center; padding:28px 16px;">
          ${today?.template_id ? `
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">Scheduled Workout</div>
            <div style="font-size:28px;font-weight:700;margin-bottom:20px;">${today.templates?.name ?? ''}</div>
            <button class="btn btn-primary btn-full" id="start-btn" style="font-size:17px;padding:14px;">Start Workout</button>
            <div style="margin-top:12px;">
              <button class="btn btn-ghost btn-sm" id="pick-template-btn">Or pick another</button>
            </div>
          ` : `
            <div style="font-size:20px;font-weight:600;margin-bottom:8px;">Rest Day</div>
            <div style="color:var(--text-muted);font-size:14px;margin-bottom:18px;">No workout scheduled today</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="pick-template-btn">Start from Template</button>
              <button class="btn btn-secondary" id="start-empty-btn">Start Empty Workout</button>
            </div>
          `}
        </div>
        <div style="font-size:15px;font-weight:600;color:var(--text-muted);margin-bottom:10px;">Recent</div>
        ${sessions.length === 0
          ? `<div class="empty" style="padding:24px;"><div class="empty-text">No workouts yet</div><div class="empty-sub">Start your first workout above</div></div>`
          : sessions.map(s => `
            <div class="card" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;" data-sid="${s.id}">
              <div>
                <div class="card-title">${s.templates?.name ?? s.template_name ?? 'Custom Workout'}</div>
                <div style="color:var(--text-muted);font-size:13px;">${fmt(s.started_at)}</div>
              </div>
              <span style="color:var(--text-muted);font-size:20px;">›</span>
            </div>
          `).join('')}
      </div>`;

    const startBtn = container.querySelector('#start-btn');
    if (startBtn) startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.textContent = 'Starting...';
      try {
        const s = await api.createSession(today?.template_id ?? null, userId);
        location.hash = '#/workout/' + s.id;
      } catch (err) {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Workout';
        alert('Failed to start workout: ' + err.message);
      }
    });

    const emptyBtn = container.querySelector('#start-empty-btn');
    if (emptyBtn) emptyBtn.addEventListener('click', async () => {
      emptyBtn.disabled = true;
      emptyBtn.textContent = 'Starting...';
      try {
        const s = await api.createSession(null, userId);
        location.hash = '#/workout/' + s.id;
      } catch (err) {
        emptyBtn.disabled = false;
        emptyBtn.textContent = 'Start Empty Workout';
        alert('Failed to start workout: ' + err.message);
      }
    });

    const pickBtn = container.querySelector('#pick-template-btn');
    if (pickBtn) pickBtn.addEventListener('click', async () => {
      try {
        const templates = await api.getTemplates();
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="modal card">
            <h2 class="modal-title">Choose Template</h2>
            <div style="margin-bottom:20px;">
              ${templates.map(t => `
                <div class="ex-option" data-tid="${t.id}" style="border-bottom:1px solid var(--border); padding:12px 0;">
                  <div style="font-weight:600;">${t.name}</div>
                </div>
              `).join('')}
              <div class="ex-option" data-tid="" style="padding:12px 0;">
                <div style="font-weight:600; color:var(--text-muted);">Empty Workout</div>
              </div>
            </div>
            <button class="btn btn-secondary btn-full" id="modal-cancel">Cancel</button>
          </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#modal-cancel').onclick = () => modal.remove();
        modal.querySelectorAll('.ex-option').forEach(el => {
          el.onclick = async () => {
            const tid = el.dataset.tid || null;
            modal.innerHTML = '<div class="loading">Starting...</div>';
            try {
              const s = await api.createSession(tid, userId);
              modal.remove();
              location.hash = '#/workout/' + s.id;
            } catch (err) {
              alert('Failed to start: ' + err.message);
              modal.remove();
            }
          };
        });
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    container.querySelectorAll('[data-sid]').forEach(el =>
      el.addEventListener('click', () => { location.hash = '#/history/' + el.dataset.sid; }));
  } catch (err) {
    container.innerHTML = `<div class="page"><div class="empty"><div class="empty-text">Error: ${err.message}</div></div></div>`;
  }
}

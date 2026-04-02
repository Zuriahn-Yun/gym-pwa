import * as api from '../api.js';

// Persistent state for history view to maintain month/selection across navigations
const state = {
  currentDate: new Date(),
  selectedDate: new Date(),
  sessions: []
};

export async function render(container, params) {
  const userId = params?.userId ?? null;
  const sessionId = params?.sessionId ?? null;

  // If sessionId is provided, render the detail view instead of the calendar
  if (sessionId) {
    await renderSessionDetail(container, sessionId);
    return;
  }

  // Create initial shell immediately to ensure elements exist for listeners/data
  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">History</h1>
      <div id="calendar-view"></div>
      <div style="font-size:11px; color:var(--text-muted); text-align:center; margin-top:8px;">
        Double-tap a day to quickly add a workout
      </div>
      <div id="day-detail"></div>
      <div id="history-debug" style="font-size:9px; color:var(--surface2); text-align:center; margin-top:40px; border-top:1px solid var(--surface2); padding-top:8px;">
        User: ${userId} | Month: Loading... | Sessions: Loading...
      </div>
    </div>
  `;

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }

  async function loadMonthData() {
    const calendarContainer = container.querySelector('#calendar-view');
    if (!calendarContainer) return;

    calendarContainer.innerHTML = '<div class="loading">Loading calendar...</div>';
    
    const startOfMonth = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1).toISOString();
    const endOfMonth = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
    
    try {
      const debugEl = container.querySelector('#history-debug');
      if (!api.insforge || !api.insforge.database) {
        throw new Error('Database client not initialized');
      }

      console.error(`Attempting fetch for userId: ${userId}`);
      // Step 1: Fetch core sessions explicitly for this user
      const { data, error } = await api.insforge.database.from('sessions')
        .select('*, templates(name)')
        .eq('user_id', userId)
        .gte('started_at', startOfMonth)
        .lte('started_at', endOfMonth)
        .order('started_at', { ascending: false });
      
      if (error) {
        console.error('SUPABASE ERROR:', error);
        throw error;
      }
      state.sessions = data || [];

      // Step 2: Lazy load summaries if any Strava activities exist
      const stravaIds = state.sessions.filter(s => s.strava_id).map(s => s.id);
      if (stravaIds.length > 0) {
        const { data: summaries, error: sumErr } = await api.insforge.database.from('session_exercises')
          .select('session_id, sets(distance, duration)')
          .in('session_id', stravaIds);
        
        if (!sumErr && summaries) {
          state.sessions.forEach(s => {
            if (s.strava_id) s.session_exercises = summaries.filter(sum => sum.session_id === s.id);
          });
        }
      }

      renderCalendar();
      renderDayDetail();
      
      if (debugEl) {
        debugEl.textContent = `User: ${userId} | Month: ${state.currentDate.getMonth() + 1}/${state.currentDate.getFullYear()} | Sessions: ${state.sessions.length}`;
      }
    } catch (err) {
      console.error('Failed to load month data:', err);
      const debugEl = container.querySelector('#history-debug');
      if (debugEl) debugEl.textContent = `CRITICAL ERROR: ${err.message}`;
      
      state.sessions = [];
      renderCalendar();
      const detailContainer = container.querySelector('#day-detail');
      if (detailContainer) {
        detailContainer.innerHTML = `<div class="empty"><div class="empty-text">Loading Error</div><div class="empty-sub">${err.message}</div></div>`;
      }
    }
  }

  function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const monthName = state.currentDate.toLocaleString('default', { month: 'long' });
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const calendarContainer = container.querySelector('#calendar-view');
    if (!calendarContainer) return;

    let html = `
      <div class="calendar-view">
        <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <button class="btn btn-ghost btn-sm" id="prev-month" style="min-width:44px;">&lsaquo;</button>
          <h2>${monthName} ${year}</h2>
          <button class="btn btn-ghost btn-sm" id="next-month" style="min-width:44px;">&rsaquo;</button>
        </div>
        <div class="calendar-grid">
          ${['S','M','T','W','T','F','S'].map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
    `;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const isToday = new Date().toDateString() === dayDate.toDateString();
      const isSelected = state.selectedDate.toDateString() === dayDate.toDateString();
      const hasWorkout = state.sessions.some(s => new Date(s.started_at).toDateString() === dayDate.toDateString());
      
      let classes = ['calendar-day'];
      if (isSelected) classes.push('selected');
      if (isToday) classes.push('today');
      if (hasWorkout) classes.push('has-workout');
      
      html += `
        <div class="${classes.join(' ')}" data-day="${day}">
          <span>${day}</span>
        </div>
      `;
    }

    const totalCellsUsed = firstDay + daysInMonth;
    for (let i = totalCellsUsed; i < 42; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    html += `</div></div>`;
    calendarContainer.innerHTML = html;

    // Attach Listeners
    container.querySelector('#prev-month').onclick = (e) => {
      e.stopPropagation();
      state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1, 1);
      state.selectedDate = new Date(state.currentDate);
      loadMonthData();
    };
    container.querySelector('#next-month').onclick = (e) => {
      e.stopPropagation();
      state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 1);
      state.selectedDate = new Date(state.currentDate);
      loadMonthData();
    };
    container.querySelectorAll('.calendar-day[data-day]').forEach(el => {
      el.onclick = () => {
        state.selectedDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), parseInt(el.dataset.day));
        renderCalendar();
        renderDayDetail();
      };
      el.ondblclick = (e) => {
        e.preventDefault();
        state.selectedDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), parseInt(el.dataset.day));
        showAddWorkoutModal();
      };
    });
  }

  function renderDayDetail() {
    const detailContainer = container.querySelector('#day-detail');
    if (!detailContainer) return;

    const daySessions = state.sessions.filter(s => new Date(s.started_at).toDateString() === state.selectedDate.toDateString());
    const fmtDate = state.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    let html = `
      <div style="margin-top:24px; border-top:1px solid var(--border); padding-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-size:16px;">${fmtDate}</h3>
          <button class="btn btn-sm btn-primary" id="add-workout-btn">+ Add</button>
        </div>
    `;

    if (daySessions.length === 0) {
      html += `<div class="empty" style="padding:20px;"><div class="empty-text">No workouts logged</div></div>`;
    } else {
      html += daySessions.map(s => {
        let summary = '';
        if (s.strava_id && s.session_exercises?.[0]?.sets?.[0]) {
          const set = s.session_exercises[0].sets[0];
          const dist = set.distance ? `${parseFloat(set.distance).toFixed(2)} mi` : '';
          const dur = set.duration ? `${Math.floor(set.duration / 60)}m ${set.duration % 60}s` : '';
          summary = `<div style="font-size:12px; color:var(--accent); font-weight:600; margin-top:4px;">
            ${dist}${dist && dur ? ' • ' : ''}${dur}
          </div>`;
        }

        return `
          <div class="card session-card" data-sid="${s.id}" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="cursor:pointer; flex:1;" class="session-info">
                <div class="card-title" style="margin:0;">${s.templates?.name ?? s.template_name ?? 'Custom Workout'}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                  ${new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                ${summary}
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn btn-danger btn-sm delete-session-btn" data-sid="${s.id}">Delete</button>
                <span style="color:var(--text-muted); cursor:pointer;" class="session-info">›</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    html += `</div>`;
    detailContainer.innerHTML = html;

    container.querySelector('#add-workout-btn').onclick = () => showAddWorkoutModal();
    container.querySelectorAll('.session-info').forEach(el => {
      const card = el.closest('.session-card');
      el.onclick = () => { location.hash = '#/history/' + card.dataset.sid; };
    });

    container.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this workout?')) return;
        const sid = parseInt(btn.dataset.sid);
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await api.deleteSession(sid);
          await loadMonthData();
        } catch (err) {
          alert('Failed to delete: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Delete';
        }
      };
    });
  }

  async function renderSessionDetail(container, id) {
    container.innerHTML = '<div class="loading">Loading details...</div>';
    try {
      if (!api.insforge || !api.insforge.database) throw new Error('Database client not initialized');
      const s = await api.getSession(id);
      if (!s) throw new Error('Session not found');

      const dateStr = new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      container.innerHTML = `
        <div class="page">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <button class="btn btn-ghost btn-sm" onclick="location.hash = '#/history'" style="padding:0; min-width:32px; font-size:24px;">‹</button>
            <h1 class="page-title" style="margin:0;">Workout Detail</h1>
          </div>
          <div class="card" style="margin-bottom:24px;">
            <div style="font-size:20px; font-weight:700; margin-bottom:4px;">${s.templates?.name ?? s.template_name ?? 'Custom Workout'}</div>
            <div style="font-size:14px; color:var(--text-muted);">${dateStr} at ${timeStr}</div>
          </div>
          ${s.session_exercises.length === 0 ? '<div class="empty">No exercises recorded</div>' : s.session_exercises.map(se => `
            <div class="card" style="margin-bottom:16px; padding:16px;">
              <div style="font-weight:700; font-size:16px; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">${se.exercises?.name}</div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${se.sets.map(set => {
                  let detail = (set.distance != null || set.duration != null) ? `${set.distance != null ? parseFloat(set.distance).toFixed(2) + ' mi' : ''}${set.distance && set.duration ? ' • ' : ''}${set.duration != null ? Math.floor(set.duration / 60) + 'm ' + (set.duration % 60) + 's' : ''}` : `${set.weight} lbs × ${set.reps} reps`;
                  return `<div style="display:flex; justify-content:space-between; align-items:center; font-size:14px;"><span style="color:var(--text-muted);">Set ${set.set_number}</span><span style="font-weight:500;">${detail}</span></div>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
          <div style="margin-top:32px;"><button class="btn btn-danger btn-full" id="delete-detail-btn">Delete Workout</button></div>
        </div>
      `;

      container.querySelector('#delete-detail-btn').onclick = async () => {
        if (!confirm('Permanently delete this workout history?')) return;
        try {
          await api.deleteSession(id);
          location.hash = '#/history';
        } catch (err) { alert('Failed to delete: ' + err.message); }
      };
    } catch (err) {
      container.innerHTML = `<div class="page"><div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;"><button class="btn btn-ghost btn-sm" onclick="location.hash = '#/history'" style="padding:0; min-width:32px; font-size:24px;">‹</button><h1 class="page-title" style="margin:0;">Error</h1></div><div class="empty"><div class="empty-text">${err.message}</div></div></div>`;
    }
  }

  async function showAddWorkoutModal() {
    try {
      const templates = await api.getTemplates();
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal card" style="width:100%; max-width:400px; margin:20px; padding:24px;">
          <h2 style="margin-top:0; margin-bottom:20px;">Add Workout</h2>
          <div style="margin-bottom:16px;">
            <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">Choose a template</div>
            <select id="template-select" class="btn btn-secondary btn-full" style="text-align:left; appearance:auto; padding:10px;">
              <option value="">Empty Workout</option>
              ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-secondary btn-full" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary btn-full" id="modal-confirm">Add</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#modal-cancel').onclick = () => modal.remove();
      modal.querySelector('#modal-confirm').onclick = async () => {
        const templateId = modal.querySelector('#template-select').value;
        const confirmBtn = modal.querySelector('#modal-confirm');
        confirmBtn.disabled = true; confirmBtn.textContent = 'Adding...';
        try {
          const dateWithTime = new Date(state.selectedDate);
          dateWithTime.setHours(12, 0, 0, 0);
          const s = await api.createSession(templateId || null, userId, dateWithTime.toISOString());
          modal.remove();
          if (state.selectedDate.toDateString() === new Date().toDateString()) location.hash = '#/workout/' + s.id;
          else await loadMonthData();
        } catch (err) { alert('Failed to add workout: ' + err.message); confirmBtn.disabled = false; confirmBtn.textContent = 'Add'; }
      };
    } catch (err) { alert('Error: ' + err.message); }
  }

  await loadMonthData();
}

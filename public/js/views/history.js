import * as api from '../api.js';

export async function render(container, params) {
  const userId = params?.userId ?? null;
  const sessionId = params?.sessionId ?? null;
  let currentDate = new Date();
  let selectedDate = new Date();
  let sessions = [];

  // If sessionId is provided, render the detail view instead of the calendar
  if (sessionId) {
    return renderSessionDetail(container, sessionId);
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }

  async function loadMonthData() {
    // Only load if we are in the main view (not detail)
    const calendarContainer = container.querySelector('#calendar-view');
    if (!calendarContainer) return;

    calendarContainer.innerHTML = '<div class="loading">Loading calendar...</div>';
    
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
    
    try {
      if (!api.insforge || !api.insforge.database) {
        throw new Error('Database client not initialized');
      }

      // Fetch sessions with nested sets for summaries
      const { data, error } = await api.insforge.database.from('sessions')
        .select('*, templates(name), session_exercises(id, sets(distance, duration))')
        .gte('started_at', startOfMonth)
        .lte('started_at', endOfMonth)
        .order('started_at', { ascending: false });
      
      if (error) {
        console.error('Database query error:', error);
        throw new Error(error.message || 'Database query failed');
      }
      
      sessions = data || [];

      renderCalendar();
      renderDayDetail();
    } catch (err) {
      console.error('Failed to load month data:', err);
      sessions = [];
      renderCalendar();
      
      const detailContainer = container.querySelector('#day-detail');
      if (detailContainer) {
        detailContainer.innerHTML = `
          <div class="empty">
            <div class="empty-text">Loading Error</div>
            <div class="empty-sub" style="color:#ef4444; font-family:monospace; margin-top:8px;">
              ${err.message}
            </div>
            <button class="btn btn-ghost btn-sm" onclick="location.reload()" style="margin-top:16px;">
              Retry Connection
            </button>
          </div>
        `;
      }
    }
  }

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
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

    // Empty spaces for first week
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const isToday = new Date().toDateString() === dayDate.toDateString();
      const isSelected = selectedDate.toDateString() === dayDate.toDateString();
      const hasWorkout = sessions.some(s => new Date(s.started_at).toDateString() === dayDate.toDateString());
      
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

    // Fill remaining cells to reach 42 (6 rows x 7 days)
    const totalCellsUsed = firstDay + daysInMonth;
    for (let i = totalCellsUsed; i < 42; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    html += `</div></div>`;
    calendarContainer.innerHTML = html;

    // Listeners
    container.querySelector('#prev-month').onclick = () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      loadMonthData();
    };
    container.querySelector('#next-month').onclick = () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      loadMonthData();
    };
    container.querySelectorAll('.calendar-day[data-day]').forEach(el => {
      el.onclick = () => {
        selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), parseInt(el.dataset.day));
        renderCalendar();
        renderDayDetail();
      };
      el.ondblclick = (e) => {
        e.preventDefault();
        selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), parseInt(el.dataset.day));
        showAddWorkoutModal();
      };
    });
  }

  function renderDayDetail() {
    const detailContainer = container.querySelector('#day-detail');
    if (!detailContainer) return;

    const daySessions = sessions.filter(s => new Date(s.started_at).toDateString() === selectedDate.toDateString());
    const fmtDate = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

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
        // Calculate Strava summary if applicable
        let summary = '';
        if (s.strava_id && s.session_exercises?.[0]?.sets?.[0]) {
          const set = s.session_exercises[0].sets[0];
          const dist = set.distance ? `${set.distance.toFixed(2)} mi` : '';
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
      const s = await api.getSession(id);
      if (!s) throw new Error('Session not found');

      const dateStr = new Date(s.started_at).toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });
      const timeStr = new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let html = `
        <div class="page">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <button class="btn btn-ghost btn-sm" onclick="location.hash = '#/history'" style="padding:0; min-width:32px; font-size:24px;">‹</button>
            <h1 class="page-title" style="margin:0;">Workout Detail</h1>
          </div>

          <div class="card" style="margin-bottom:24px;">
            <div style="font-size:20px; font-weight:700; margin-bottom:4px;">${s.templates?.name ?? s.template_name ?? 'Custom Workout'}</div>
            <div style="font-size:14px; color:var(--text-muted);">${dateStr} at ${timeStr}</div>
          </div>

          ${s.session_exercises.length === 0 
            ? '<div class="empty">No exercises recorded</div>'
            : s.session_exercises.map(se => `
              <div class="card" style="margin-bottom:16px; padding:16px;">
                <div style="font-weight:700; font-size:16px; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                  ${se.exercises?.name}
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${se.sets.map(set => {
                    let detail = '';
                    if (set.distance != null || set.duration != null) {
                      const dist = set.distance != null ? `${set.distance.toFixed(2)} mi` : '';
                      const dur = set.duration != null ? `${Math.floor(set.duration / 60)}m ${set.duration % 60}s` : '';
                      detail = `${dist}${dist && dur ? ' • ' : ''}${dur}`;
                    } else {
                      detail = `${set.weight} lbs × ${set.reps} reps`;
                    }
                    return `
                      <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px;">
                        <span style="color:var(--text-muted);">Set ${set.set_number}</span>
                        <span style="font-weight:500;">${detail}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          
          <div style="margin-top:32px;">
            <button class="btn btn-danger btn-full" id="delete-detail-btn">Delete Workout</button>
          </div>
        </div>
      `;
      container.innerHTML = html;

      container.querySelector('#delete-detail-btn').onclick = async () => {
        if (!confirm('Permanently delete this workout history?')) return;
        try {
          await api.deleteSession(id);
          location.hash = '#/history';
        } catch (err) {
          alert('Failed to delete: ' + err.message);
        }
      };

    } catch (err) {
      container.innerHTML = `<div class="page">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
          <button class="btn btn-ghost btn-sm" onclick="location.hash = '#/history'" style="padding:0; min-width:32px; font-size:24px;">‹</button>
          <h1 class="page-title" style="margin:0;">Error</h1>
        </div>
        <div class="empty"><div class="empty-text">${err.message}</div></div>
      </div>`;
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
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Adding...';
        try {
          const dateWithTime = new Date(selectedDate);
          dateWithTime.setHours(12, 0, 0, 0);
          const s = await api.createSession(templateId || null, userId, dateWithTime.toISOString());
          modal.remove();
          if (selectedDate.toDateString() === new Date().toDateString()) {
            location.hash = '#/workout/' + s.id;
          } else {
            await loadMonthData();
          }
        } catch (err) {
          alert('Failed to add workout: ' + err.message);
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Add';
        }
      };
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">History</h1>
      <div id="calendar-view"></div>
      <div style="font-size:11px; color:var(--text-muted); text-align:center; margin-top:8px;">
        Double-tap a day to quickly add a workout
      </div>
      <div id="day-detail"></div>
    </div>
  `;

  await loadMonthData();
}

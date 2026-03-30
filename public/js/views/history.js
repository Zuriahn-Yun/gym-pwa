import * as api from '../api.js';

export async function render(container, params) {
  const userId = params?.userId ?? null;
  let currentDate = new Date();
  let selectedDate = new Date();
  let sessions = [];

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }

  async function loadMonthData() {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
    
    try {
      sessions = await api.getSessionsByDateRange(startOfMonth, endOfMonth);
      renderCalendar();
      renderDayDetail();
    } catch (err) {
      console.error('Failed to load month data:', err);
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
      <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <button class="btn btn-sm btn-secondary" id="prev-month">&lsaquo;</button>
        <h2>${monthName} ${year}</h2>
        <button class="btn btn-sm btn-secondary" id="next-month">&rsaquo;</button>
      </div>
      <div class="calendar-grid">
        ${['S','M','T','W','T','F','S'].map(d => `<div style="font-weight:600; font-size:12px; color:var(--text-muted); padding-bottom:8px;">${d}</div>`).join('')}
    `;

    // Empty spaces for first week
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const isSelected = selectedDate.toDateString() === new Date(year, month, day).toDateString();
      const hasWorkout = sessions.some(s => new Date(s.started_at).toDateString() === new Date(year, month, day).toDateString());
      
      let classes = ['calendar-day'];
      if (isSelected) classes.push('selected');
      if (isToday) classes.push('today');
      if (hasWorkout) classes.push('has-workout');
      
      html += `
        <div class="${classes.join(' ')}" data-day="${day}">
          ${day}
        </div>
      `;
    }

    html += `</div>`;
    calendarContainer.innerHTML = html;

    // Listeners
    container.querySelector('#prev-month').onclick = () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      loadMonthData();
    };
    container.querySelector('#next-month').onclick = () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
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
      html += daySessions.map(s => `
        <div class="card session-card" data-sid="${s.id}" style="margin-bottom:12px; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="card-title" style="margin:0;">${s.templates?.name ?? s.template_name ?? 'Custom Workout'}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                ${new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <span style="color:var(--text-muted);">›</span>
          </div>
        </div>
      `).join('');
    }

    html += `</div>`;
    detailContainer.innerHTML = html;

    container.querySelector('#add-workout-btn').onclick = () => showAddWorkoutModal();
    container.querySelectorAll('.session-card[data-sid]').forEach(el => {
      el.onclick = () => { location.hash = '#/history/' + el.dataset.sid; };
    });
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
          // Set the time to noon to avoid timezone shift issues during initial creation
          const dateWithTime = new Date(selectedDate);
          dateWithTime.setHours(12, 0, 0, 0);
          const s = await api.createSession(templateId || null, userId, dateWithTime.toISOString());
          modal.remove();
          // If it's today, we might want to navigate to the workout view immediately
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

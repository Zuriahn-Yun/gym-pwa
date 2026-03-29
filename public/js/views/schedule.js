import * as api from '../api.js';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export async function render(container, params) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  const [schedule, templates] = await Promise.all([api.getSchedule(), api.getTemplates()]);
  const opts = ['<option value="">Rest Day</option>',
    ...templates.map(t => `<option value="${t.id}">${t.name}</option>`)].join('');

  container.innerHTML = `<div class="page">
    <h1 class="page-title">Schedule</h1>
    ${schedule.map((day, i) => `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;">
        <div style="font-weight:600;min-width:105px;">${DAYS[i]}</div>
        <select class="input" data-day="${day.day_of_week}" style="max-width:190px;">${opts}</select>
      </div>`).join('')}
  </div>`;

  schedule.forEach(day => {
    const sel = container.querySelector(`[data-day="${day.day_of_week}"]`);
    if (sel) sel.value = day.template_id || '';
  });

  container.addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-day]');
    if (!sel) return;
    await api.setScheduleDay(parseInt(sel.dataset.day), sel.value ? parseInt(sel.value) : null);
  });
}

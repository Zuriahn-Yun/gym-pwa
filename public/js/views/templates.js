import * as api from '../api.js';

export async function render(container, params) {
  if (params && params.templateId) await renderDetail(container, parseInt(params.templateId));
  else await renderList(container);
}

async function renderList(container) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  const templates = await api.getTemplates();
  container.innerHTML = `<div class="page">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h1 class="page-title" style="margin:0;">Templates</h1>
      <button class="btn btn-primary btn-sm" id="new-tmpl">+ New</button>
    </div>
    ${templates.length === 0
      ? '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No templates yet</div></div>'
      : templates.map(t => `
        <div class="card" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;" data-tid="${t.id}">
          <div style="font-size:17px;font-weight:600;">${t.name}</div>
          <span style="color:var(--text-muted);font-size:20px;">›</span>
        </div>`).join('')}
  </div>`;

  container.querySelectorAll('[data-tid]').forEach(el =>
    el.addEventListener('click', () => { location.hash = '#/templates/' + el.dataset.tid; }));

  container.querySelector('#new-tmpl').addEventListener('click', async () => {
    const name = prompt('Template name:');
    if (!name || !name.trim()) return;
    const t = await api.createTemplate(name.trim());
    location.hash = '#/templates/' + t.id;
  });
}

async function renderDetail(container, templateId) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  const [template, exercises, allEx] = await Promise.all([
    api.getTemplate(templateId),
    api.getTemplateExercises(templateId),
    api.getExercises()
  ]);
  if (!template) {
    container.innerHTML = '<div class="empty"><div class="empty-text">Template not found</div></div>';
    return;
  }

  const exListHtml = (exs) => exs.map(ex => `
    <div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <div style="flex:1;">
        <div style="font-weight:600;">${ex.name}</div>
        <div style="font-size:12px;color:var(--text-muted);">${ex.default_sets} sets · ${ex.default_reps} reps · ${ex.default_weight} lbs</div>
      </div>
      <button class="btn btn-danger btn-sm rm-ex" data-eid="${ex.exercise_id}">✕</button>
    </div>`).join('');

  container.innerHTML = `<div class="page">
    <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom:12px;">‹ Templates</button>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h1 class="page-title" style="margin:0;">${template.name}</h1>
      <button class="btn btn-danger btn-sm" id="del-tmpl">Delete</button>
    </div>
    <div id="ex-list">
      ${exercises.length === 0
        ? '<div class="empty" style="padding:20px;"><div class="empty-text">No exercises yet</div></div>'
        : exListHtml(exercises)}
    </div>
    <button class="btn btn-secondary btn-full" id="add-ex-btn" style="margin-top:8px;">+ Add Exercise</button>
  </div>`;

  container.querySelector('#back-btn').addEventListener('click', () => { location.hash = '#/templates'; });

  container.querySelector('#del-tmpl').addEventListener('click', async () => {
    if (!confirm(`Delete "${template.name}"?`)) return;
    await api.deleteTemplate(templateId);
    location.hash = '#/templates';
  });

  container.querySelector('#ex-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.rm-ex');
    if (!btn) return;
    await api.removeExerciseFromTemplate(templateId, parseInt(btn.dataset.eid));
    await renderDetail(container, templateId);
  });

  container.querySelector('#add-ex-btn').addEventListener('click', async () => {
    const assigned = new Set(exercises.map(e => e.exercise_id));
    const available = allEx.filter(e => !assigned.has(e.id));

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal">
      <div class="modal-title">Add to Template</div>
      <input class="input" id="search" placeholder="Search..." style="margin-bottom:12px;">
      <div id="av-list">${available.map(ex => `
        <div class="card" style="cursor:pointer;margin-bottom:8px;" data-eid="${ex.id}" data-name="${ex.name}">
          <div style="font-weight:600;">${ex.name}</div>
          ${ex.muscle_group ? `<span class="tag">${ex.muscle_group}</span>` : ''}
        </div>`).join('')}
      </div>
      <button class="btn btn-secondary btn-full" id="cancel" style="margin-top:12px;">Cancel</button>
    </div>`;
    document.body.appendChild(backdrop);

    backdrop.querySelector('#search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      backdrop.querySelectorAll('[data-eid]').forEach(el =>
        el.style.display = el.dataset.name.toLowerCase().includes(q) ? '' : 'none');
    });

    backdrop.querySelector('#cancel').addEventListener('click', () => backdrop.remove());

    backdrop.querySelector('#av-list').addEventListener('click', async (e) => {
      const card = e.target.closest('[data-eid]');
      if (!card) return;
      await api.addExerciseToTemplate(templateId, parseInt(card.dataset.eid), { position: exercises.length });
      backdrop.remove();
      await renderDetail(container, templateId);
    });
  });
}

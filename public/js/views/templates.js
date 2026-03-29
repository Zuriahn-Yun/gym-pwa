import * as api from '../api.js';

export async function render(container, params) {
  if (params && params.templateId) await renderDetail(container, parseInt(params.templateId));
  else await renderList(container);
}

// ===== LIST =====

async function renderList(container) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  const templates = await api.getTemplates();

  container.innerHTML = `<div class="page">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h1 class="page-title" style="margin:0;">Templates</h1>
      <button class="btn btn-primary btn-sm" id="new-tmpl">+ New</button>
    </div>
    ${templates.length === 0
      ? '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No templates yet.<br>Tap + New to create one.</div></div>'
      : templates.map(t => `
        <div class="card" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;" data-tid="${t.id}">
          <div style="font-size:17px;font-weight:600;">${t.name}</div>
          <span style="color:var(--text-muted);font-size:20px;">›</span>
        </div>`).join('')}
  </div>`;

  container.querySelectorAll('[data-tid]').forEach(el =>
    el.addEventListener('click', () => { location.hash = '#/templates/' + el.dataset.tid; }));

  container.querySelector('#new-tmpl').addEventListener('click', () => showNameModal(null, async (name) => {
    const t = await api.createTemplate(name);
    location.hash = '#/templates/' + t.id;
  }));
}

// ===== DETAIL =====

async function renderDetail(container, templateId) {
  container.innerHTML = '<div class="loading">Loading...</div>';

  let [template, exercises, allEx] = await Promise.all([
    api.getTemplate(templateId),
    api.getTemplateExercises(templateId),
    api.getExercises()
  ]);

  if (!template) {
    container.innerHTML = '<div class="empty"><div class="empty-text">Template not found</div></div>';
    return;
  }

  const renderExList = () => {
    const list = container.querySelector('#ex-list');
    if (!list) return;
    if (exercises.length === 0) {
      list.innerHTML = '<div class="empty" style="padding:20px;"><div class="empty-text">No exercises yet</div></div>';
      return;
    }
    list.innerHTML = exercises.map((ex, i) => `
      <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;" data-idx="${i}">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;margin-bottom:2px;">${ex.exercises ? ex.exercises.name : ex.name}</div>
          <div style="font-size:12px;color:var(--text-muted);">${ex.default_sets} sets · ${ex.default_reps} reps · ${ex.default_weight} lbs</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px;">
          <button class="btn btn-ghost btn-sm move-up" data-idx="${i}" ${i === 0 ? 'disabled' : ''} style="padding:2px 8px;font-size:16px;">↑</button>
          <button class="btn btn-ghost btn-sm move-down" data-idx="${i}" ${i === exercises.length - 1 ? 'disabled' : ''} style="padding:2px 8px;font-size:16px;">↓</button>
        </div>
        <button class="btn btn-secondary btn-sm edit-ex" data-idx="${i}" style="padding:6px 10px;">✎</button>
        <button class="btn btn-danger btn-sm rm-ex" data-idx="${i}" style="padding:6px 10px;">✕</button>
      </div>`).join('');
  };

  container.innerHTML = `<div class="page">
    <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom:12px;">‹ Templates</button>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h1 class="page-title" style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${template.name}</h1>
      <div style="display:flex;gap:8px;margin-left:8px;flex-shrink:0;">
        <button class="btn btn-secondary btn-sm" id="rename-tmpl">Rename</button>
        <button class="btn btn-danger btn-sm" id="del-tmpl">Delete</button>
      </div>
    </div>
    <div id="ex-list"></div>
    <button class="btn btn-secondary btn-full" id="add-ex-btn" style="margin-top:8px;">+ Add Exercise</button>
  </div>`;

  renderExList();

  container.querySelector('#back-btn').addEventListener('click', () => { location.hash = '#/templates'; });

  container.querySelector('#rename-tmpl').addEventListener('click', () => {
    showNameModal(template.name, async (name) => {
      template = await api.updateTemplate(templateId, name);
      container.querySelector('.page-title').textContent = template.name;
    });
  });

  container.querySelector('#del-tmpl').addEventListener('click', async () => {
    if (!confirm(`Delete "${template.name}"?`)) return;
    await api.deleteTemplate(templateId);
    location.hash = '#/templates';
  });

  container.querySelector('#ex-list').addEventListener('click', async (e) => {
    if (e.target.closest('.rm-ex')) {
      const idx = parseInt(e.target.closest('.rm-ex').dataset.idx);
      const ex = exercises[idx];
      await api.removeExerciseFromTemplate(templateId, ex.exercise_id);
      exercises.splice(idx, 1);
      renderExList();
      return;
    }

    if (e.target.closest('.edit-ex')) {
      const idx = parseInt(e.target.closest('.edit-ex').dataset.idx);
      showEditModal(exercises[idx], async (fields) => {
        await api.updateTemplateExercise(templateId, exercises[idx].exercise_id, fields);
        exercises[idx] = { ...exercises[idx], ...fields };
        renderExList();
      });
      return;
    }

    const upBtn = e.target.closest('.move-up');
    const downBtn = e.target.closest('.move-down');
    if (upBtn || downBtn) {
      const idx = parseInt((upBtn || downBtn).dataset.idx);
      const swapIdx = upBtn ? idx - 1 : idx + 1;
      [exercises[idx], exercises[swapIdx]] = [exercises[swapIdx], exercises[idx]];
      const items = exercises.map((ex, i) => ({ exercise_id: ex.exercise_id, position: i }));
      renderExList();
      await api.reorderTemplateExercises(templateId, items);
    }
  });

  container.querySelector('#add-ex-btn').addEventListener('click', async () => {
    const assigned = new Set(exercises.map(e => e.exercise_id));
    const available = allEx.filter(e => !assigned.has(e.id));
    showAddModal(available, async (exerciseId) => {
      const added = await api.addExerciseToTemplate(templateId, exerciseId, { position: exercises.length });
      exercises.push(added);
      allEx = await api.getExercises();
      renderExList();
    });
  });
}

// ===== MODALS =====

function showNameModal(currentName, onConfirm) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-title">${currentName ? 'Rename Template' : 'New Template'}</div>
    <input class="input" id="tmpl-name" placeholder="Template name" value="${currentName || ''}" style="margin-bottom:16px;">
    <div style="display:flex;gap:8px;">
      <button class="btn btn-secondary" style="flex:1;" id="cancel">Cancel</button>
      <button class="btn btn-primary" style="flex:1;" id="confirm">${currentName ? 'Rename' : 'Create'}</button>
    </div>
  </div>`;
  document.body.appendChild(backdrop);

  const input = backdrop.querySelector('#tmpl-name');
  input.focus();
  input.select();

  const doConfirm = async () => {
    const name = input.value.trim();
    if (!name) return;
    backdrop.remove();
    await onConfirm(name);
  };

  backdrop.querySelector('#confirm').addEventListener('click', doConfirm);
  backdrop.querySelector('#cancel').addEventListener('click', () => backdrop.remove());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doConfirm(); if (e.key === 'Escape') backdrop.remove(); });
}

function showEditModal(ex, onSave) {
  const name = ex.exercises ? ex.exercises.name : ex.name;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-title">Edit Defaults — ${name}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Sets</div>
        <input class="input" id="sets" type="number" inputmode="numeric" min="1" max="20" value="${ex.default_sets}">
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Reps</div>
        <input class="input" id="reps" type="number" inputmode="numeric" min="1" max="100" value="${ex.default_reps}">
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Weight (lbs)</div>
        <input class="input" id="weight" type="number" inputmode="decimal" min="0" step="2.5" value="${ex.default_weight}">
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-secondary" style="flex:1;" id="cancel">Cancel</button>
      <button class="btn btn-primary" style="flex:1;" id="save">Save</button>
    </div>
  </div>`;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#sets').focus();

  backdrop.querySelector('#save').addEventListener('click', async () => {
    const sets = parseInt(backdrop.querySelector('#sets').value) || ex.default_sets;
    const reps = parseInt(backdrop.querySelector('#reps').value) || ex.default_reps;
    const weight = parseFloat(backdrop.querySelector('#weight').value) || 0;
    backdrop.remove();
    await onSave({ default_sets: sets, default_reps: reps, default_weight: weight });
  });

  backdrop.querySelector('#cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('keydown', e => { if (e.key === 'Escape') backdrop.remove(); });
}

function showAddModal(available, onSelect) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-title">Add Exercise</div>
    <input class="input" id="search" placeholder="Search exercises..." style="margin-bottom:12px;" autocomplete="off">
    <div id="av-list" style="max-height:300px;overflow-y:auto;">
      ${available.length === 0
        ? '<div class="empty" style="padding:16px;"><div class="empty-text">All exercises already added</div></div>'
        : available.map(ex => `
          <div class="card" style="cursor:pointer;margin-bottom:8px;" data-eid="${ex.id}" data-name="${ex.name}">
            <div style="font-weight:600;">${ex.name}</div>
            ${ex.muscle_group ? `<span class="tag">${ex.muscle_group}</span>` : ''}
          </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-full" id="cancel" style="margin-top:12px;">Cancel</button>
  </div>`;
  document.body.appendChild(backdrop);

  const searchInput = backdrop.querySelector('#search');
  searchInput.focus();

  searchInput.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    backdrop.querySelectorAll('[data-eid]').forEach(el =>
      el.style.display = el.dataset.name.toLowerCase().includes(q) ? '' : 'none');
  });

  backdrop.querySelector('#cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('keydown', e => { if (e.key === 'Escape') backdrop.remove(); });

  backdrop.querySelector('#av-list').addEventListener('click', async (e) => {
    const card = e.target.closest('[data-eid]');
    if (!card) return;
    backdrop.remove();
    await onSelect(parseInt(card.dataset.eid));
  });
}

import * as api from '../api.js';

export async function render(container, params) {
  container.innerHTML = '<div class="loading">Loading...</div>';
  let exercises = await api.getExercises();

  const listHtml = (list) => list.length === 0
    ? '<div class="empty"><div class="empty-icon">🏋️</div><div class="empty-text">No exercises</div></div>'
    : list.map(ex => `
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:600;">${ex.name}</div>
            ${ex.muscle_group ? `<span class="tag">${ex.muscle_group}</span>` : ''}
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm edit-btn"
              data-id="${ex.id}"
              data-name="${ex.name.replace(/"/g, '&quot;')}"
              data-muscle="${(ex.muscle_group || '').replace(/"/g, '&quot;')}"
              data-notes="${(ex.notes || '').replace(/"/g, '&quot;')}">Edit</button>
            <button class="btn btn-danger btn-sm del-btn"
              data-id="${ex.id}"
              data-name="${ex.name.replace(/"/g, '&quot;')}">✕</button>
          </div>
        </div>`).join('');

  container.innerHTML = `<div class="page">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h1 class="page-title" style="margin:0;">Exercises</h1>
      <button class="btn btn-primary btn-sm" id="add-ex">+ New</button>
    </div>
    <input class="input" id="search" placeholder="Search exercises..." style="margin-bottom:12px;">
    <div id="ex-list">${listHtml(exercises)}</div>
  </div>`;

  const listEl = container.querySelector('#ex-list');

  container.querySelector('#search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    listEl.innerHTML = listHtml(
      exercises.filter(ex => ex.name.toLowerCase().includes(q) || (ex.muscle_group || '').toLowerCase().includes(q))
    );
  });

  function showModal(existing) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal">
      <div class="modal-title">${existing ? 'Edit' : 'New'} Exercise</div>
      <div class="input-group"><label class="input-label">Name *</label>
        <input class="input" id="ex-name" placeholder="e.g. Barbell Bench Press" value="${existing ? existing.name : ''}">
      </div>
      <div class="input-group"><label class="input-label">Muscle Group</label>
        <input class="input" id="ex-muscle" placeholder="e.g. chest" value="${existing ? existing.muscle : ''}">
      </div>
      <div class="input-group"><label class="input-label">Notes</label>
        <input class="input" id="ex-notes" placeholder="Optional" value="${existing ? existing.notes : ''}">
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;" id="cancel">Cancel</button>
        <button class="btn btn-primary" style="flex:1;" id="save">${existing ? 'Save' : 'Create'}</button>
      </div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#cancel').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#save').addEventListener('click', async () => {
      const name = backdrop.querySelector('#ex-name').value.trim();
      if (!name) { alert('Name is required'); return; }
      const muscle = backdrop.querySelector('#ex-muscle').value.trim();
      const notes = backdrop.querySelector('#ex-notes').value.trim();
      if (existing) await api.updateExercise(existing.id, { name, muscle_group: muscle, notes });
      else await api.createExercise(name, muscle, notes);
      exercises = await api.getExercises();
      listEl.innerHTML = listHtml(exercises);
      backdrop.remove();
    });
  }

  container.querySelector('#add-ex').addEventListener('click', () => showModal(null));

  listEl.addEventListener('click', async (e) => {
    if (e.target.closest('.edit-btn')) {
      const b = e.target.closest('.edit-btn');
      showModal({ id: parseInt(b.dataset.id), name: b.dataset.name, muscle: b.dataset.muscle, notes: b.dataset.notes });
    } else if (e.target.closest('.del-btn')) {
      const b = e.target.closest('.del-btn');
      if (!confirm(`Delete "${b.dataset.name}"?`)) return;
      await api.deleteExercise(parseInt(b.dataset.id));
      exercises = await api.getExercises();
      listEl.innerHTML = listHtml(exercises);
    }
  });
}

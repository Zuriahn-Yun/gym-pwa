import * as api from '../api.js';

export async function render(container, params) {
  const sessionId = params && params.sessionId ? parseInt(params.sessionId) : null;
  if (!sessionId) {
    container.innerHTML = '<div class="empty"><div class="empty-text">No session selected</div></div>';
    return;
  }
  container.innerHTML = '<div class="loading">Loading workout...</div>';

  let session = await api.getSession(sessionId).catch(() => null);
  if (!session) {
    container.innerHTML = '<div class="empty"><div class="empty-text">Session not found</div></div>';
    return;
  }

  const statsMap = {};
  const exercises = session.session_exercises || [];
  await Promise.all(exercises.map(async ex => {
    statsMap[ex.exercise_id] = await api.getExerciseStats(ex.exercise_id).catch(() => ({}));
  }));

  const isFinished = !!session.finished_at;
  const templateName = session.templates?.name ?? 'Workout';

  function prevText(exerciseId) {
    const s = statsMap[exerciseId] || {};
    if (s.lastWeight != null) return `${s.lastWeight} × ${s.lastReps}`;
    return '—';
  }

  // exType map: exerciseId → exercise_type
  const exTypeMap = {};
  exercises.forEach(ex => {
    exTypeMap[ex.exercise_id] = ex.exercises?.exercise_type ?? 'strength';
  });

  function setRowHtml(set, seId, exerciseId, setIndex, exType) {
    const type = exType || exTypeMap[exerciseId] || 'strength';
    const prev = setIndex === 0 ? prevText(exerciseId) : '—';
    if (type === 'swimming') {
      return `<div class="set-row" data-set-id="${set.id}" data-se-id="${seId}" data-type="swimming">
        <div class="set-num">${set.set_number}</div>
        <div class="set-prev">${prev}</div>
        <input class="set-input" type="number" inputmode="numeric" placeholder="0"
          value="${set.distance || ''}" data-field="distance" ${set.completed ? 'style="opacity:0.5"' : ''}>
        <input class="set-input" type="number" inputmode="numeric" placeholder="0"
          value="${set.duration || ''}" data-field="duration" ${set.completed ? 'style="opacity:0.5"' : ''}>
        <button class="set-check ${set.completed ? 'done' : ''}" data-completed="${set.completed ? '1' : '0'}">
          ${set.completed ? '✓' : ''}
        </button>
      </div>`;
    }
    if (type === 'running') {
      return `<div class="set-row" data-set-id="${set.id}" data-se-id="${seId}" data-type="running">
        <div class="set-num">${set.set_number}</div>
        <div class="set-prev">${prev}</div>
        <input class="set-input" type="number" inputmode="decimal" placeholder="0"
          value="${set.distance || ''}" data-field="distance" ${set.completed ? 'style="opacity:0.5"' : ''}>
        <input class="set-input" type="number" inputmode="numeric" placeholder="0"
          value="${set.duration || ''}" data-field="duration" ${set.completed ? 'style="opacity:0.5"' : ''}>
        <button class="set-check ${set.completed ? 'done' : ''}" data-completed="${set.completed ? '1' : '0'}">
          ${set.completed ? '✓' : ''}
        </button>
      </div>`;
    }
    return `<div class="set-row" data-set-id="${set.id}" data-se-id="${seId}" data-type="strength">
      <div class="set-num">${set.set_number}</div>
      <div class="set-prev">${prev}</div>
      <input class="set-input" type="number" inputmode="decimal" placeholder="0"
        value="${set.weight || ''}" data-field="weight" ${set.completed ? 'style="opacity:0.5"' : ''}>
      <input class="set-input" type="number" inputmode="numeric" placeholder="0"
        value="${set.reps || ''}" data-field="reps" ${set.completed ? 'style="opacity:0.5"' : ''}>
      <button class="set-check ${set.completed ? 'done' : ''}" data-completed="${set.completed ? '1' : '0'}">
        ${set.completed ? '✓' : ''}
      </button>
    </div>`;
  }

  function exerciseCardHtml(ex) {
    const name = ex.exercises?.name ?? ex.name ?? 'Unknown';
    const muscle = ex.exercises?.muscle_group ?? ex.muscle_group ?? '';
    const exType = ex.exercises?.exercise_type ?? 'strength';
    const sets = ex.sets || [];
    const colHeaders = exType === 'swimming'
      ? ['SET', 'PREVIOUS', 'YDS', 'SEC', '']
      : exType === 'running'
      ? ['SET', 'PREVIOUS', 'MI', 'MIN', '']
      : ['SET', 'PREVIOUS', 'LBS', 'REPS', ''];
    return `<div class="card exercise-card" data-se-id="${ex.id}" data-eid="${ex.exercise_id}" data-type="${exType}" style="padding:0;overflow:hidden;">
      <div style="padding:14px 16px 10px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:16px;font-weight:700;">${name}</div>
          ${muscle ? `<span class="tag" style="margin-top:4px;display:inline-block;">${muscle}</span>` : ''}
        </div>
        ${isFinished ? '' : `<button class="btn btn-danger btn-sm del-exercise" data-se-id="${ex.id}" style="margin-left:8px;flex-shrink:0;">Remove</button>`}
      </div>
      <div class="set-table">
        <div class="set-table-header">
          ${colHeaders.map(h => `<div>${h}</div>`).join('')}
        </div>
        <div class="sets-container">
          ${sets.map((s, i) => setRowHtml(s, ex.id, ex.exercise_id, i, exType)).join('')}
        </div>
      </div>
      ${isFinished ? '' : `<div style="padding:8px 12px 12px;display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm add-set-btn" style="flex:1;">+ Add Set</button>
        <button class="btn btn-danger btn-sm del-last-set" data-se-id="${ex.id}" style="flex:0;">- Set</button>
      </div>`}
    </div>`;
  }

  function showEmptyState() {
    exContainer.innerHTML = `<div class="empty-workout-state" style="text-align:center;padding:40px 24px;">
      <div style="font-size:15px;color:var(--text-muted);margin-bottom:20px;">No exercises yet</div>
      <button class="btn btn-primary btn-full" id="add-ex-btn-empty">+ Add Exercise</button>
    </div>`;
    container.querySelector('#add-ex-btn')?.remove();
    attachAddExBtn();
  }

  container.innerHTML = `
    <div class="workout-header">
      <div>
        <div style="font-size:17px;font-weight:700;">${templateName}</div>
        <div style="font-size:12px;color:var(--text-muted);">${new Date(session.started_at).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${isFinished
          ? '<span style="font-size:13px;color:var(--success);font-weight:600;">Finished</span>'
          : '<button class="btn btn-primary btn-sm" id="finish-btn">Finish</button>'}
        <button class="btn btn-danger btn-sm" id="delete-workout-btn">Delete</button>
      </div>
    </div>
    <div class="page" style="padding-top:12px;">
      <div id="exercises-container">
        ${exercises.length === 0
          ? `<div class="empty-workout-state" style="text-align:center;padding:40px 24px;">
               <div style="font-size:15px;color:var(--text-muted);margin-bottom:20px;">No exercises yet</div>
               <button class="btn btn-primary btn-full" id="add-ex-btn-empty">+ Add Exercise</button>
             </div>`
          : exercises.map(exerciseCardHtml).join('')}
      </div>
      ${isFinished || exercises.length === 0 ? '' : `<button class="btn btn-secondary btn-full" id="add-ex-btn" style="margin-top:4px;">+ Add Exercise</button>`}
    </div>`;

  const exContainer = container.querySelector('#exercises-container');

  // Save weight/reps on blur
  exContainer.addEventListener('blur', async (e) => {
    if (!e.target.classList.contains('set-input')) return;
    const row = e.target.closest('[data-set-id]');
    if (!row) return;
    const val = parseFloat(e.target.value) || 0;
    await api.updateSet(parseInt(row.dataset.setId), { [e.target.dataset.field]: val }).catch(console.error);
  }, true);

  exContainer.addEventListener('click', async (e) => {
    // Check/uncheck set
    const checkBtn = e.target.closest('.set-check');
    if (checkBtn) {
      const row = checkBtn.closest('[data-set-id]');
      const setId = parseInt(row.dataset.setId);
      const nowDone = checkBtn.dataset.completed === '0' ? 1 : 0;
      const rowType = row.dataset.type || 'strength';
      let fields = { completed: nowDone };
      if (rowType === 'swimming' || rowType === 'running') {
        fields.distance = parseFloat(row.querySelector('[data-field="distance"]')?.value) || 0;
        fields.duration = parseInt(row.querySelector('[data-field="duration"]')?.value) || 0;
      } else {
        fields.weight = parseFloat(row.querySelector('[data-field="weight"]')?.value) || 0;
        fields.reps = parseInt(row.querySelector('[data-field="reps"]')?.value) || 0;
      }
      try {
        await api.updateSet(setId, fields);
      } catch (err) { console.error('updateSet failed:', err); return; }
      checkBtn.dataset.completed = String(nowDone);
      checkBtn.className = 'set-check' + (nowDone ? ' done' : '');
      checkBtn.textContent = nowDone ? '✓' : '';
      row.querySelectorAll('.set-input').forEach(i => i.style.opacity = nowDone ? '0.5' : '1');
      return;
    }

    // Add set
    const addSetBtn = e.target.closest('.add-set-btn');
    if (addSetBtn) {
      const card = addSetBtn.closest('.exercise-card');
      const seId = parseInt(card.dataset.seId);
      const eid = parseInt(card.dataset.eid);
      const rows = card.querySelectorAll('[data-set-id]');
      const nextNum = rows.length + 1;
      const cardType = card.dataset.type || 'strength';
      let defW = 0, defR = 0, defDist = 0, defDur = 0;
      if (rows.length > 0) {
        const last = rows[rows.length - 1];
        if (cardType === 'swimming' || cardType === 'running') {
          defDist = parseFloat(last.querySelector('[data-field="distance"]')?.value) || 0;
          defDur = parseInt(last.querySelector('[data-field="duration"]')?.value) || 0;
        } else {
          defW = parseFloat(last.querySelector('[data-field="weight"]')?.value) || 0;
          defR = parseInt(last.querySelector('[data-field="reps"]')?.value) || 0;
        }
      }
      try {
        const newSet = await api.addSet(seId, nextNum, defW, defR, defDist, defDur);
        card.querySelector('.sets-container').insertAdjacentHTML('beforeend', setRowHtml(newSet, seId, eid, rows.length, cardType));
      } catch (err) { alert('Failed to add set: ' + err.message); }
      return;
    }

    // Delete last set
    const delLastSet = e.target.closest('.del-last-set');
    if (delLastSet) {
      const card = delLastSet.closest('.exercise-card');
      const rows = [...card.querySelectorAll('[data-set-id]')];
      if (rows.length === 0) return;
      const last = rows[rows.length - 1];
      const setId = parseInt(last.dataset.setId);
      try {
        await api.deleteSet(setId);
        last.remove();
      } catch (err) { alert('Failed to delete set: ' + err.message); }
      return;
    }

    // Remove exercise
    const delExBtn = e.target.closest('.del-exercise');
    if (delExBtn) {
      if (!confirm('Remove this exercise?')) return;
      const seId = parseInt(delExBtn.dataset.seId);
      try {
        await api.removeExerciseFromSession(seId);
      } catch (err) { alert('Failed to remove exercise: ' + err.message); return; }
      const card = exContainer.querySelector(`.exercise-card[data-se-id="${seId}"]`);
      if (card) card.remove();
      if (!exContainer.querySelector('.exercise-card')) showEmptyState();
      return;
    }
  });

  // Delete entire workout
  container.querySelector('#delete-workout-btn').addEventListener('click', async () => {
    if (!confirm('Delete this entire workout?')) return;
    try {
      await api.deleteSession(sessionId);
      location.hash = '#/history';
    } catch (err) { alert('Failed to delete workout: ' + err.message); }
  });

  // Finish workout
  const finishBtn = container.querySelector('#finish-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      if (!confirm('Finish this workout?')) return;
      finishBtn.disabled = true;
      try {
        await api.finishSession(sessionId);
        location.hash = '#/history';
      } catch (err) {
        finishBtn.disabled = false;
        alert('Failed to finish workout: ' + err.message);
      }
    });
  }

  function attachAddExBtn() {
    const btn = container.querySelector('#add-ex-btn') || container.querySelector('#add-ex-btn-empty');
    if (btn && !btn._hasListener) {
      btn._hasListener = true;
      btn.addEventListener('click', () => showAddExerciseModal(sessionId, exContainer, exerciseCardHtml, setRowHtml, container, showEmptyState));
    }
  }
  attachAddExBtn();
}

async function showAddExerciseModal(sessionId, exContainer, exerciseCardHtml, setRowHtml, container, showEmptyState) {
  const allEx = await api.getExercises();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-title">Add Exercise</div>
    <input class="input" id="ex-search" placeholder="Type to search..." autocomplete="off" style="margin-bottom:8px;">
    <div id="ex-list" style="max-height:340px;overflow-y:auto;"></div>
    <button class="btn btn-secondary btn-full" id="cancel-modal" style="margin-top:8px;">Cancel</button>
  </div>`;
  document.body.appendChild(backdrop);

  const searchInput = backdrop.querySelector('#ex-search');
  const listEl = backdrop.querySelector('#ex-list');

  function renderList(query) {
    const trimmed = query.trim();
    const pattern = trimmed ? new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const matches = pattern ? allEx.filter(ex => pattern.test(ex.name) || pattern.test(ex.muscle_group || '')) : allEx;
    const exactMatch = allEx.find(ex => ex.name.toLowerCase() === trimmed.toLowerCase());
    const showCreate = trimmed.length > 0 && !exactMatch;

    listEl.innerHTML = matches.map(ex => `
      <div class="ex-option" data-eid="${ex.id}" data-name="${ex.name}">
        <div style="font-weight:600;">${ex.name}</div>
        ${ex.muscle_group ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${ex.muscle_group}</div>` : ''}
      </div>`).join('') +
      (showCreate ? `<div class="ex-option ex-create" data-create="1" data-name="${trimmed}" style="border:1px dashed var(--border);">
        <div style="font-weight:600;color:var(--accent);">+ Create "${trimmed}"</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Add as new exercise</div>
      </div>` : '') +
      (matches.length === 0 && !showCreate ? `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:14px;">No exercises found</div>` : '');
  }

  renderList('');
  searchInput.focus();
  searchInput.addEventListener('input', e => renderList(e.target.value));
  backdrop.querySelector('#cancel-modal').addEventListener('click', () => backdrop.remove());

  listEl.addEventListener('click', async (e) => {
    const opt = e.target.closest('[data-eid], [data-create]');
    if (!opt) return;
    backdrop.remove();

    let exerciseId;
    if (opt.dataset.create) {
      const newEx = await api.createExercise(opt.dataset.name, '', '');
      exerciseId = newEx.id;
    } else {
      exerciseId = parseInt(opt.dataset.eid);
    }

    const currentCount = exContainer.querySelectorAll('.exercise-card').length;
    const seData = await api.addExerciseToSession(sessionId, exerciseId, currentCount);
    await api.addSet(seData.id, 1, 0, 0);
    const session = await api.getSession(sessionId);
    const updatedExercises = session.session_exercises || [];
    const newEx = updatedExercises.find(ex => ex.id === seData.id);
    if (!newEx) return;

    const emptyState = exContainer.querySelector('.empty-workout-state');
    if (emptyState) {
      exContainer.innerHTML = exerciseCardHtml(newEx);
      const page = container.querySelector('.page');
      if (page && !container.querySelector('#add-ex-btn')) {
        page.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary btn-full" id="add-ex-btn" style="margin-top:4px;">+ Add Exercise</button>`);
      }
    } else {
      exContainer.insertAdjacentHTML('beforeend', exerciseCardHtml(newEx));
    }

    const newAddBtn = container.querySelector('#add-ex-btn');
    if (newAddBtn && !newAddBtn._hasListener) {
      newAddBtn._hasListener = true;
      newAddBtn.addEventListener('click', () => showAddExerciseModal(sessionId, exContainer, exerciseCardHtml, setRowHtml, container, showEmptyState));
    }
  });
}

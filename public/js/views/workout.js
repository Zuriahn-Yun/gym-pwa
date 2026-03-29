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
  await Promise.all(session.exercises.map(async ex => {
    statsMap[ex.exercise_id] = await api.getExerciseStats(ex.exercise_id).catch(() => ({}));
  }));

  const isFinished = !!session.finished_at;

  function statsChips(exerciseId) {
    const s = statsMap[exerciseId] || {};
    let html = '';
    if (s.lastWeight != null) html += `<span class="chip accent">Last: ${s.lastWeight} lbs × ${s.lastReps}</span>`;
    if (s.pr != null) html += `<span class="chip">PR: ${s.pr} lbs</span>`;
    return html ? `<div style="margin:6px 0 8px;">${html}</div>` : '';
  }

  function setRowHtml(set, seId) {
    const dim = set.completed ? 'style="opacity:0.5"' : '';
    return `<div class="set-row" data-set-id="${set.id}" data-se-id="${seId}">
      <div class="set-num">${set.set_number}</div>
      <input class="set-input" type="number" inputmode="decimal" placeholder="lbs"
        value="${set.weight || ''}" data-field="weight" ${dim}>
      <input class="set-input" type="number" inputmode="numeric" placeholder="reps"
        value="${set.reps || ''}" data-field="reps" ${dim}>
      <button class="set-check ${set.completed ? 'done' : ''}" data-completed="${set.completed}">${set.completed ? '✓' : '○'}</button>
    </div>`;
  }

  function exerciseCardHtml(ex) {
    return `<div class="card exercise-card" data-se-id="${ex.id}" data-eid="${ex.exercise_id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div>
          <div class="card-title">${ex.name}</div>
          ${ex.muscle_group ? `<span class="tag">${ex.muscle_group}</span>` : ''}
        </div>
      </div>
      ${statsChips(ex.exercise_id)}
      <div class="set-header">
        <div></div>
        <div class="set-header-label">lbs</div>
        <div class="set-header-label">reps</div>
        <div></div>
      </div>
      <div class="sets-container">${ex.sets.map(s => setRowHtml(s, ex.id)).join('')}</div>
      ${isFinished ? '' : `<button class="btn btn-ghost btn-sm add-set-btn" style="margin-top:8px;width:100%;">+ Add Set</button>`}
    </div>`;
  }

  container.innerHTML = `
    <div class="workout-header">
      <div>
        <div style="font-size:17px;font-weight:700;">${session.template_name || 'Workout'}</div>
        <div style="font-size:12px;color:var(--text-muted);">${new Date(session.started_at).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
      ${isFinished
        ? '<span class="chip" style="color:var(--success);">✓ Finished</span>'
        : '<button class="btn btn-primary btn-sm" id="finish-btn">Finish</button>'}
    </div>
    <div class="page" style="padding-top:8px;">
      <div id="exercises-container">
        ${session.exercises.length === 0
          ? '<div class="empty"><div class="empty-icon">💪</div><div class="empty-text">No exercises yet</div><div class="empty-sub">Add one below</div></div>'
          : session.exercises.map(exerciseCardHtml).join('')}
      </div>
      ${isFinished ? '' : `<button class="btn btn-secondary btn-full" id="add-ex-btn" style="margin-top:4px;">+ Add Exercise</button>`}
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

  // Check button toggle + Add Set
  exContainer.addEventListener('click', async (e) => {
    const checkBtn = e.target.closest('.set-check');
    if (checkBtn) {
      const row = checkBtn.closest('[data-set-id]');
      const setId = parseInt(row.dataset.setId);
      const nowDone = checkBtn.dataset.completed === '0' ? 1 : 0;
      const w = parseFloat(row.querySelector('[data-field="weight"]').value) || 0;
      const r = parseInt(row.querySelector('[data-field="reps"]').value) || 0;
      await api.updateSet(setId, { weight: w, reps: r, completed: nowDone });
      checkBtn.dataset.completed = String(nowDone);
      checkBtn.className = 'set-check' + (nowDone ? ' done' : '');
      checkBtn.textContent = nowDone ? '✓' : '○';
      row.querySelectorAll('.set-input').forEach(i => i.style.opacity = nowDone ? '0.5' : '1');
      return;
    }

    const addSetBtn = e.target.closest('.add-set-btn');
    if (addSetBtn) {
      const card = addSetBtn.closest('.exercise-card');
      const seId = parseInt(card.dataset.seId);
      const rows = card.querySelectorAll('[data-set-id]');
      const nextNum = rows.length + 1;
      let defW = 0, defR = 0;
      if (rows.length > 0) {
        const last = rows[rows.length - 1];
        defW = parseFloat(last.querySelector('[data-field="weight"]').value) || 0;
        defR = parseInt(last.querySelector('[data-field="reps"]').value) || 0;
      }
      const newSet = await api.addSet(seId, nextNum, defW, defR);
      card.querySelector('.sets-container').insertAdjacentHTML('beforeend', setRowHtml(newSet, seId));
      return;
    }
  });

  // Finish workout
  const finishBtn = container.querySelector('#finish-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      if (!confirm('Finish this workout?')) return;
      finishBtn.disabled = true;
      await api.finishSession(sessionId);
      location.hash = '#/history';
    });
  }

  // Add Exercise modal
  const addExBtn = container.querySelector('#add-ex-btn');
  if (addExBtn) {
    addExBtn.addEventListener('click', async () => {
      const allEx = await api.getExercises();
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `<div class="modal">
        <div class="modal-title">Add Exercise</div>
        <input class="input" id="ex-search" placeholder="Search..." style="margin-bottom:12px;">
        <div id="ex-list">${allEx.map(ex => `
          <div class="card" style="cursor:pointer;margin-bottom:8px;" data-eid="${ex.id}" data-name="${ex.name}">
            <div style="font-weight:600;">${ex.name}</div>
            ${ex.muscle_group ? `<span class="tag">${ex.muscle_group}</span>` : ''}
          </div>`).join('')}
        </div>
        <button class="btn btn-secondary btn-full" id="cancel-modal" style="margin-top:12px;">Cancel</button>
      </div>`;
      document.body.appendChild(backdrop);

      backdrop.querySelector('#ex-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        backdrop.querySelectorAll('[data-eid]').forEach(el =>
          el.style.display = el.dataset.name.toLowerCase().includes(q) ? '' : 'none');
      });

      backdrop.querySelector('#cancel-modal').addEventListener('click', () => backdrop.remove());

      backdrop.querySelector('#ex-list').addEventListener('click', async (e) => {
        const card = e.target.closest('[data-eid]');
        if (!card) return;
        const seData = await api.addExerciseToSession(sessionId, parseInt(card.dataset.eid), session.exercises.length);
        session = await api.getSession(sessionId);
        const newEx = session.exercises.find(ex => ex.id === seData.id);
        if (newEx) {
          statsMap[newEx.exercise_id] = await api.getExerciseStats(newEx.exercise_id).catch(() => ({}));
          const emptyEl = exContainer.querySelector('.empty');
          if (emptyEl) emptyEl.remove();
          exContainer.insertAdjacentHTML('beforeend', exerciseCardHtml(newEx));
        }
        backdrop.remove();
      });
    });
  }
}

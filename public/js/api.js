import { insforge } from './insforge.js';
const db = insforge.database;

// ===== SCHEDULE =====
export async function getSchedule() {
  const { data, error } = await db.from('schedule').select('*, templates(id, name)').order('day_of_week');
  if (error) throw new Error(error.message);
  return data;
}

export async function setScheduleDay(day, template_id) {
  const { data, error } = await db.from('schedule')
    .update({ template_id: template_id || null })
    .eq('day_of_week', day)
    .select('*, templates(id, name)')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ===== TEMPLATES =====
export async function getTemplates() {
  const { data, error } = await db.from('templates').select().order('id');
  if (error) throw new Error(error.message);
  return data;
}

export async function getTemplate(id) {
  const { data, error } = await db.from('templates').select().eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createTemplate(name) {
  const { data, error } = await db.from('templates').insert([{ name }]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTemplate(id, name) {
  const { data, error } = await db.from('templates').update({ name }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTemplate(id) {
  const { error } = await db.from('templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getTemplateExercises(id) {
  const { data, error } = await db.from('template_exercises')
    .select('*, exercises(id, name, muscle_group, notes)')
    .eq('template_id', id)
    .order('position');
  if (error) throw new Error(error.message);
  return data;
}

export async function addExerciseToTemplate(templateId, exercise_id, opts = {}) {
  const { data, error } = await db.from('template_exercises')
    .insert([{
      template_id: templateId,
      exercise_id,
      position: opts.position || 0,
      default_sets: opts.default_sets || 3,
      default_reps: opts.default_reps || 8,
      default_weight: opts.default_weight || 0
    }])
    .select('*, exercises(id, name, muscle_group)')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeExerciseFromTemplate(templateId, exerciseId) {
  const { error } = await db.from('template_exercises')
    .delete()
    .eq('template_id', templateId)
    .eq('exercise_id', exerciseId);
  if (error) throw new Error(error.message);
}

export async function updateTemplateExercise(templateId, exerciseId, fields) {
  const { data, error } = await db.from('template_exercises')
    .update(fields)
    .eq('template_id', templateId)
    .eq('exercise_id', exerciseId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function reorderTemplateExercises(templateId, items) {
  // items: [{ exercise_id, position }]
  await Promise.all(items.map(({ exercise_id, position }) =>
    db.from('template_exercises')
      .update({ position })
      .eq('template_id', templateId)
      .eq('exercise_id', exercise_id)
  ));
}

// ===== EXERCISES =====
export async function getExercises() {
  const { data, error } = await db.from('exercises').select().order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function getExercise(id) {
  const { data, error } = await db.from('exercises').select().eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createExercise(name, muscle_group, notes) {
  const { data, error } = await db.from('exercises').insert([{ name, muscle_group, notes }]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateExercise(id, fields) {
  const { data, error } = await db.from('exercises').update(fields).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteExercise(id) {
  const { error } = await db.from('exercises').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getExerciseStats(id) {
  const { data, error } = await insforge.database.rpc('get_exercise_stats', { p_exercise_id: id });
  if (error) throw new Error(error.message);
  const row = data && data[0];
  if (!row) return { lastWeight: null, lastReps: null, lastDate: null, pr: null };
  return {
    lastWeight: row.last_weight ? parseFloat(row.last_weight) : null,
    lastReps: row.last_reps || null,
    lastDate: row.last_date || null,
    pr: row.pr ? parseFloat(row.pr) : null
  };
}

// ===== SESSIONS =====
export async function getSessions(limit = 20, offset = 0) {
  const { data, error } = await db.from('sessions')
    .select('*, templates(name)')
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return data;
}

export async function getSession(id) {
  const { data, error } = await db.from('sessions')
    .select('*, templates(name), session_exercises(*, exercises(id, name, muscle_group), sets(*))')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  // Sort sets by set_number
  if (data && data.session_exercises) {
    data.session_exercises.sort((a, b) => a.position - b.position);
    for (const se of data.session_exercises) {
      if (se.sets) se.sets.sort((a, b) => a.set_number - b.set_number);
    }
  }
  return data;
}

export async function createSession(template_id) {
  const { data: session, error } = await db.from('sessions')
    .insert([{ template_id: template_id || null }])
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Auto-load exercises from template
  if (template_id) {
    const { data: tmplExercises } = await db.from('template_exercises')
      .select()
      .eq('template_id', template_id)
      .order('position');
    if (tmplExercises && tmplExercises.length) {
      const sessionExercises = tmplExercises.map(te => ({
        session_id: session.id,
        exercise_id: te.exercise_id,
        position: te.position
      }));
      const { data: inserted } = await db.from('session_exercises').insert(sessionExercises).select();

      // Create default sets for each exercise
      const setRows = [];
      for (let i = 0; i < tmplExercises.length; i++) {
        const te = tmplExercises[i];
        const se = inserted[i];
        for (let s = 1; s <= (te.default_sets || 3); s++) {
          setRows.push({
            session_exercise_id: se.id,
            set_number: s,
            weight: te.default_weight || 0,
            reps: te.default_reps || 8,
            completed: false
          });
        }
      }
      if (setRows.length) await db.from('sets').insert(setRows);
    }
  }
  return session;
}

export async function finishSession(id) {
  const { data, error } = await db.from('sessions')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSession(id) {
  const { error } = await db.from('sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addExerciseToSession(sessionId, exercise_id, position = 0) {
  const { data: se, error } = await db.from('session_exercises')
    .insert([{ session_id: sessionId, exercise_id, position }])
    .select('*, exercises(id, name, muscle_group)')
    .single();
  if (error) throw new Error(error.message);
  return se;
}

// ===== SETS =====
export async function addSet(sessionExerciseId, set_number, weight = 0, reps = 0) {
  const { data, error } = await db.from('sets')
    .insert([{ session_exercise_id: sessionExerciseId, set_number, weight, reps, completed: false }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSet(id, fields) {
  const { data, error } = await db.from('sets').update(fields).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSet(id) {
  const { error } = await db.from('sets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

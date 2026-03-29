const BASE = '/api';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Schedule
export const getSchedule = () => req('GET', '/schedule');
export const setScheduleDay = (day, template_id) => req('PUT', `/schedule/${day}`, { template_id });

// Templates
export const getTemplates = () => req('GET', '/templates');
export const getTemplate = (id) => req('GET', `/templates/${id}`);
export const createTemplate = (name) => req('POST', '/templates', { name });
export const updateTemplate = (id, name) => req('PUT', `/templates/${id}`, { name });
export const deleteTemplate = (id) => req('DELETE', `/templates/${id}`);
export const getTemplateExercises = (id) => req('GET', `/templates/${id}/exercises`);
export const addExerciseToTemplate = (id, exercise_id, opts) => req('POST', `/templates/${id}/exercises`, { exercise_id, ...opts });
export const removeExerciseFromTemplate = (tid, eid) => req('DELETE', `/templates/${tid}/exercises/${eid}`);
export const reorderTemplateExercises = (id, items) => req('PUT', `/templates/${id}/exercises/reorder`, { items });

// Exercises
export const getExercises = () => req('GET', '/exercises');
export const getExercise = (id) => req('GET', `/exercises/${id}`);
export const createExercise = (name, muscle_group, notes) => req('POST', '/exercises', { name, muscle_group, notes });
export const updateExercise = (id, data) => req('PUT', `/exercises/${id}`, data);
export const deleteExercise = (id) => req('DELETE', `/exercises/${id}`);
export const getExerciseStats = (id) => req('GET', `/exercises/${id}/stats`);

// Sessions
export const getSessions = (limit, offset) => req('GET', `/sessions?limit=${limit || 20}&offset=${offset || 0}`);
export const getSession = (id) => req('GET', `/sessions/${id}`);
export const createSession = (template_id) => req('POST', '/sessions', { template_id: template_id || null });
export const finishSession = (id) => req('PUT', `/sessions/${id}/finish`);
export const deleteSession = (id) => req('DELETE', `/sessions/${id}`);
export const addExerciseToSession = (sessionId, exercise_id, position) => req('POST', `/sessions/${sessionId}/exercises`, { exercise_id, position: position || 0 });

// Sets
export const addSet = (sessionExerciseId, set_number, weight, reps) => req('POST', `/session-exercises/${sessionExerciseId}/sets`, { set_number, weight: weight || 0, reps: reps || 0 });
export const updateSet = (id, data) => req('PUT', `/sets/${id}`, data);
export const deleteSet = (id) => req('DELETE', `/sets/${id}`);

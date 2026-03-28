'use strict';
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'gym.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS template_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      default_sets INTEGER DEFAULT 3,
      default_reps INTEGER DEFAULT 8,
      default_weight REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS schedule (
      day_of_week INTEGER PRIMARY KEY,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES templates(id),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS session_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight REAL NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0
    );
  `);
  const insertDay = db.prepare('INSERT OR IGNORE INTO schedule (day_of_week, template_id) VALUES (?, NULL)');
  for (let i = 0; i <= 6; i++) insertDay.run(i);
}

// SCHEDULE
function getSchedule() {
  return db.prepare(`
    SELECT s.day_of_week, s.template_id, t.name as template_name
    FROM schedule s LEFT JOIN templates t ON s.template_id = t.id
    ORDER BY s.day_of_week
  `).all();
}
function setScheduleDay(dayOfWeek, templateId) {
  db.prepare('UPDATE schedule SET template_id = ? WHERE day_of_week = ?').run(templateId, dayOfWeek);
}

// TEMPLATES
function getTemplates() { return db.prepare('SELECT id, name FROM templates ORDER BY name').all(); }
function getTemplate(id) { return db.prepare('SELECT id, name FROM templates WHERE id = ?').get(id) || null; }
function createTemplate(name) {
  const r = db.prepare('INSERT INTO templates (name) VALUES (?)').run(name);
  return { id: r.lastInsertRowid, name };
}
function updateTemplate(id, name) {
  db.prepare('UPDATE templates SET name = ? WHERE id = ?').run(name, id);
  return { id, name };
}
function deleteTemplate(id) { return db.prepare('DELETE FROM templates WHERE id = ?').run(id); }

// TEMPLATE EXERCISES
function getTemplateExercises(templateId) {
  return db.prepare(`
    SELECT te.id, te.exercise_id, e.name, e.muscle_group, te.position,
           te.default_sets, te.default_reps, te.default_weight
    FROM template_exercises te JOIN exercises e ON te.exercise_id = e.id
    WHERE te.template_id = ?
    ORDER BY te.position
  `).all(templateId);
}
function addExerciseToTemplate(templateId, exerciseId, opts) {
  const { position = 0, default_sets = 3, default_reps = 8, default_weight = 0 } = opts || {};
  const r = db.prepare(`
    INSERT INTO template_exercises (template_id, exercise_id, position, default_sets, default_reps, default_weight)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(templateId, exerciseId, position, default_sets, default_reps, default_weight);
  return { id: r.lastInsertRowid, template_id: templateId, exercise_id: exerciseId, position, default_sets, default_reps, default_weight };
}
function removeExerciseFromTemplate(templateId, exerciseId) {
  return db.prepare('DELETE FROM template_exercises WHERE template_id = ? AND exercise_id = ?').run(templateId, exerciseId);
}
function reorderTemplateExercises(templateId, items) {
  const update = db.prepare('UPDATE template_exercises SET position = ? WHERE template_id = ? AND exercise_id = ?');
  db.transaction(() => { for (const { exercise_id, position } of items) update.run(position, templateId, exercise_id); })();
}

// EXERCISES
function getExercises() { return db.prepare('SELECT id, name, muscle_group, notes FROM exercises ORDER BY name').all(); }
function getExercise(id) { return db.prepare('SELECT id, name, muscle_group, notes FROM exercises WHERE id = ?').get(id) || null; }
function createExercise(name, muscleGroup, notes) {
  const r = db.prepare('INSERT INTO exercises (name, muscle_group, notes) VALUES (?, ?, ?)').run(name, muscleGroup || null, notes || null);
  return { id: r.lastInsertRowid, name, muscle_group: muscleGroup, notes };
}
function updateExercise(id, fields) {
  const ex = getExercise(id);
  if (!ex) return null;
  const name = fields.name !== undefined ? fields.name : ex.name;
  const muscle_group = fields.muscleGroup !== undefined ? fields.muscleGroup : (fields.muscle_group !== undefined ? fields.muscle_group : ex.muscle_group);
  const notes = fields.notes !== undefined ? fields.notes : ex.notes;
  db.prepare('UPDATE exercises SET name = ?, muscle_group = ?, notes = ? WHERE id = ?').run(name, muscle_group, notes, id);
  return { id, name, muscle_group, notes };
}
function deleteExercise(id) { return db.prepare('DELETE FROM exercises WHERE id = ?').run(id); }
function getExerciseStats(exerciseId) {
  const last = db.prepare(`
    SELECT s.weight, s.reps, sess.started_at as date
    FROM sets s
    JOIN session_exercises se ON s.session_exercise_id = se.id
    JOIN sessions sess ON se.session_id = sess.id
    WHERE se.exercise_id = ? AND sess.finished_at IS NOT NULL AND s.completed = 1
    ORDER BY sess.started_at DESC, s.set_number DESC
    LIMIT 1
  `).get(exerciseId);
  const prRow = db.prepare(`
    SELECT MAX(s.weight) as pr
    FROM sets s
    JOIN session_exercises se ON s.session_exercise_id = se.id
    JOIN sessions sess ON se.session_id = sess.id
    WHERE se.exercise_id = ? AND sess.finished_at IS NOT NULL AND s.completed = 1
  `).get(exerciseId);
  return {
    lastWeight: last ? last.weight : null,
    lastReps: last ? last.reps : null,
    lastDate: last ? last.date : null,
    pr: prRow ? prRow.pr : null
  };
}

// SESSIONS
function getSessions(limit, offset) {
  limit = limit || 20; offset = offset || 0;
  return db.prepare(`
    SELECT s.id, s.template_id, t.name as template_name, s.started_at, s.finished_at,
           COUNT(DISTINCT se.id) as exercise_count
    FROM sessions s
    LEFT JOIN templates t ON s.template_id = t.id
    LEFT JOIN session_exercises se ON se.session_id = s.id
    GROUP BY s.id
    ORDER BY s.started_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}
function getSession(id) {
  const session = db.prepare(`
    SELECT s.id, s.template_id, t.name as template_name, s.started_at, s.finished_at, s.notes
    FROM sessions s LEFT JOIN templates t ON s.template_id = t.id
    WHERE s.id = ?
  `).get(id);
  if (!session) return null;
  const exercises = db.prepare(`
    SELECT se.id, se.exercise_id, e.name, e.muscle_group, se.position
    FROM session_exercises se JOIN exercises e ON se.exercise_id = e.id
    WHERE se.session_id = ?
    ORDER BY se.position
  `).all(id);
  for (const ex of exercises) {
    ex.sets = db.prepare('SELECT * FROM sets WHERE session_exercise_id = ? ORDER BY set_number').all(ex.id);
  }
  session.exercises = exercises;
  return session;
}
function createSession(templateId) {
  const r = db.prepare("INSERT INTO sessions (template_id, started_at) VALUES (?, datetime('now'))").run(templateId || null);
  const sessionId = r.lastInsertRowid;
  if (templateId) {
    const texs = getTemplateExercises(templateId);
    const insertSE = db.prepare('INSERT INTO session_exercises (session_id, exercise_id, position) VALUES (?, ?, ?)');
    db.transaction(() => { for (const te of texs) insertSE.run(sessionId, te.exercise_id, te.position); })();
  }
  return { id: sessionId, template_id: templateId || null, started_at: new Date().toISOString() };
}
function finishSession(id) {
  db.prepare("UPDATE sessions SET finished_at = datetime('now') WHERE id = ?").run(id);
  return db.prepare('SELECT id, finished_at FROM sessions WHERE id = ?').get(id);
}
function deleteSession(id) { return db.prepare('DELETE FROM sessions WHERE id = ?').run(id); }

// SESSION EXERCISES
function addExerciseToSession(sessionId, exerciseId, position) {
  const r = db.prepare('INSERT INTO session_exercises (session_id, exercise_id, position) VALUES (?, ?, ?)').run(sessionId, exerciseId, position || 0);
  return { id: r.lastInsertRowid, session_id: sessionId, exercise_id: exerciseId, position: position || 0 };
}

// SETS
function addSet(sessionExerciseId, setNumber, weight, reps) {
  weight = weight || 0; reps = reps || 0;
  const r = db.prepare('INSERT INTO sets (session_exercise_id, set_number, weight, reps, completed) VALUES (?, ?, ?, ?, 0)').run(sessionExerciseId, setNumber, weight, reps);
  return { id: r.lastInsertRowid, session_exercise_id: sessionExerciseId, set_number: setNumber, weight, reps, completed: 0 };
}
function updateSet(id, fields) {
  const set = db.prepare('SELECT * FROM sets WHERE id = ?').get(id);
  if (!set) return null;
  const weight = fields.weight !== undefined ? fields.weight : set.weight;
  const reps = fields.reps !== undefined ? fields.reps : set.reps;
  const completed = fields.completed !== undefined ? fields.completed : set.completed;
  db.prepare('UPDATE sets SET weight = ?, reps = ?, completed = ? WHERE id = ?').run(weight, reps, completed, id);
  return { ...set, weight, reps, completed };
}
function deleteSet(id) { return db.prepare('DELETE FROM sets WHERE id = ?').run(id); }

module.exports = {
  initDatabase, getSchedule, setScheduleDay,
  getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  getTemplateExercises, addExerciseToTemplate, removeExerciseFromTemplate, reorderTemplateExercises,
  getExercises, getExercise, createExercise, updateExercise, deleteExercise, getExerciseStats,
  getSessions, getSession, createSession, finishSession, deleteSession,
  addExerciseToSession, addSet, updateSet, deleteSet
};

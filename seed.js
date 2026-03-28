'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const db_module = require('./database');

db_module.initDatabase();

// Use raw db for INSERT OR IGNORE
const raw = new Database(path.join(__dirname, 'gym.db'));
raw.pragma('foreign_keys = ON');

const exercises = [
  ['Barbell Bench Press', 'chest'], ['Incline Dumbbell Press', 'chest'], ['Dumbbell Fly', 'chest'],
  ['Overhead Press', 'shoulders'], ['Lateral Raises', 'shoulders'], ['Front Raises', 'shoulders'],
  ['Tricep Pushdown', 'triceps'], ['Skull Crushers', 'triceps'], ['Tricep Dips', 'triceps'],
  ['Deadlift', 'back'], ['Barbell Row', 'back'], ['Pull-ups', 'back'],
  ['Lat Pulldown', 'back'], ['Face Pulls', 'rear delts'], ['Seated Cable Row', 'back'],
  ['Barbell Squat', 'legs'], ['Romanian Deadlift', 'legs'], ['Leg Press', 'legs'],
  ['Leg Curl', 'legs'], ['Leg Extension', 'legs'], ['Calf Raises', 'legs'],
  ['Dumbbell Bicep Curl', 'biceps'], ['Barbell Bicep Curl', 'biceps'], ['Hammer Curls', 'biceps'],
];

for (const [name, muscleGroup] of exercises) {
  raw.prepare('INSERT OR IGNORE INTO exercises (name, muscle_group) VALUES (?, ?)').run(name, muscleGroup);
}

const templates = {
  'Push': ['Barbell Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raises', 'Tricep Pushdown', 'Skull Crushers'],
  'Pull': ['Deadlift', 'Pull-ups', 'Barbell Row', 'Face Pulls', 'Dumbbell Bicep Curl', 'Hammer Curls'],
  'Legs': ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raises'],
};

for (const [templateName, exNames] of Object.entries(templates)) {
  let tmpl = raw.prepare('SELECT id FROM templates WHERE name = ?').get(templateName);
  if (!tmpl) {
    const r = raw.prepare('INSERT INTO templates (name) VALUES (?)').run(templateName);
    tmpl = { id: r.lastInsertRowid };
  }
  exNames.forEach((exName, i) => {
    const ex = raw.prepare('SELECT id FROM exercises WHERE name = ?').get(exName);
    if (ex) {
      raw.prepare('INSERT OR IGNORE INTO template_exercises (template_id, exercise_id, position, default_sets, default_reps, default_weight) VALUES (?, ?, ?, 3, 8, 0)').run(tmpl.id, ex.id, i);
    }
  });
}

console.log(`✓ Seeded ${exercises.length} exercises, 3 templates (Push, Pull, Legs)`);
raw.close();

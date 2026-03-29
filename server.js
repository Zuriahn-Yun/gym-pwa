'use strict';
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.initDatabase();

// ===== SCHEDULE =====
app.get('/api/schedule', (req, res) => {
  try { res.json(db.getSchedule()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/schedule/:day', (req, res) => {
  try {
    const day = parseInt(req.params.day);
    const template_id = req.body.template_id != null ? parseInt(req.body.template_id) : null;
    db.setScheduleDay(day, template_id);
    res.json(db.getSchedule());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== TEMPLATES =====
app.get('/api/templates', (req, res) => {
  try { res.json(db.getTemplates()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/templates', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    res.status(201).json(db.createTemplate(name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/templates/:id', (req, res) => {
  try {
    const t = db.getTemplate(parseInt(req.params.id));
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/templates/:id', (req, res) => {
  try {
    const { name } = req.body;
    res.json(db.updateTemplate(parseInt(req.params.id), name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/templates/:id', (req, res) => {
  try { db.deleteTemplate(parseInt(req.params.id)); res.status(204).send(); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/templates/:id/exercises', (req, res) => {
  try { res.json(db.getTemplateExercises(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/templates/:id/exercises', (req, res) => {
  try {
    const { exercise_id, position, default_sets, default_reps, default_weight } = req.body;
    if (!exercise_id) return res.status(400).json({ error: 'exercise_id required' });
    res.status(201).json(db.addExerciseToTemplate(
      parseInt(req.params.id), parseInt(exercise_id),
      { position: position || 0, default_sets: default_sets || 3, default_reps: default_reps || 8, default_weight: default_weight || 0 }
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/templates/:id/exercises/:eid', (req, res) => {
  try {
    db.removeExerciseFromTemplate(parseInt(req.params.id), parseInt(req.params.eid));
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/templates/:id/exercises/reorder', (req, res) => {
  try {
    const { items } = req.body;
    db.reorderTemplateExercises(parseInt(req.params.id), items);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== EXERCISES =====
app.get('/api/exercises', (req, res) => {
  try { res.json(db.getExercises()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/exercises', (req, res) => {
  try {
    const { name, muscle_group, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    res.status(201).json(db.createExercise(name, muscle_group, notes));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/exercises/:id', (req, res) => {
  try {
    const ex = db.getExercise(parseInt(req.params.id));
    if (!ex) return res.status(404).json({ error: 'Not found' });
    res.json(ex);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/exercises/:id', (req, res) => {
  try { res.json(db.updateExercise(parseInt(req.params.id), req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/exercises/:id', (req, res) => {
  try { db.deleteExercise(parseInt(req.params.id)); res.status(204).send(); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/exercises/:id/stats', (req, res) => {
  try { res.json(db.getExerciseStats(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== SESSIONS =====
app.get('/api/sessions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    res.json(db.getSessions(limit, offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/sessions', (req, res) => {
  try {
    const template_id = req.body.template_id ? parseInt(req.body.template_id) : null;
    res.status(201).json(db.createSession(template_id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/sessions/:id', (req, res) => {
  try {
    const s = db.getSession(parseInt(req.params.id));
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/sessions/:id', (req, res) => {
  try { db.deleteSession(parseInt(req.params.id)); res.status(204).send(); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/sessions/:id/finish', (req, res) => {
  try { res.json(db.finishSession(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/sessions/:id/exercises', (req, res) => {
  try {
    const { exercise_id, position } = req.body;
    if (!exercise_id) return res.status(400).json({ error: 'exercise_id required' });
    res.status(201).json(db.addExerciseToSession(parseInt(req.params.id), parseInt(exercise_id), position || 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== SETS =====
app.post('/api/session-exercises/:id/sets', (req, res) => {
  try {
    const { set_number, weight, reps } = req.body;
    if (set_number == null) return res.status(400).json({ error: 'set_number required' });
    res.status(201).json(db.addSet(parseInt(req.params.id), set_number, weight || 0, reps || 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/sets/:id', (req, res) => {
  try { res.json(db.updateSet(parseInt(req.params.id), req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/sets/:id', (req, res) => {
  try { db.deleteSet(parseInt(req.params.id)); res.status(204).send(); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ===== START SERVER =====
const PORT = parseInt(process.env.PORT || '3443');
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000');
const certDir = path.join(__dirname, 'certs');
const certFile = path.join(certDir, 'cert.pem');
const keyFile = path.join(certDir, 'key.pem');

if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  const options = { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
  https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
    console.log(`Gym PWA running at https://localhost:${PORT}`);
    console.log('Use start.sh to get phone access instructions.');
  });
} else {
  http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Gym PWA running at http://localhost:${HTTP_PORT}`);
    console.log('Tip: add certs/cert.pem + certs/key.pem for HTTPS. See start.sh');
  });
}

module.exports = app;

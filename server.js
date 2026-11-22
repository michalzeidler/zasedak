const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'zasedak.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rows INTEGER NOT NULL DEFAULT 4,
    desks_per_row INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seat_index INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);
if (db.prepare('SELECT COUNT(*) AS count FROM classes').get().count === 0) {
  db.prepare('INSERT INTO classes (name) VALUES (?)').run('Moje třída');
}

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const getClass = db.prepare('SELECT id, name, rows, desks_per_row AS desksPerRow FROM classes WHERE id = ?');
const getStudents = db.prepare('SELECT id, name, seat_index AS seatIndex, sort_order AS sortOrder FROM students WHERE class_id = ? ORDER BY sort_order, id');
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

app.get('/api/classes', (_req, res) => {
  const classes = db.prepare(`SELECT c.id, c.name, c.rows, c.desks_per_row AS desksPerRow,
    COUNT(s.id) AS studentCount FROM classes c LEFT JOIN students s ON s.class_id = c.id
    GROUP BY c.id ORDER BY c.id`).all();
  res.json(classes);
});

app.post('/api/classes', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80) || 'Nová třída';
  const result = db.prepare('INSERT INTO classes (name) VALUES (?)').run(name);
  res.status(201).json({ ...getClass.get(result.lastInsertRowid), students: [] });
});

app.get('/api/classes/:id', (req, res) => {
  const classroom = getClass.get(Number(req.params.id));
  if (!classroom) return res.status(404).json({ error: 'Třída nebyla nalezena.' });
  res.json({ ...classroom, students: getStudents.all(classroom.id) });
});

app.put('/api/classes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getClass.get(id)) return res.status(404).json({ error: 'Třída nebyla nalezena.' });
  const name = String(req.body.name || '').trim().slice(0, 80) || 'Nová třída';
  const rows = clamp(req.body.rows, 1, 8);
  const desksPerRow = clamp(req.body.desksPerRow, 1, 8);
  db.prepare('UPDATE classes SET name = ?, rows = ?, desks_per_row = ? WHERE id = ?').run(name, rows, desksPerRow, id);
  db.prepare('UPDATE students SET seat_index = NULL WHERE class_id = ? AND seat_index >= ?').run(id, rows * desksPerRow * 2);
  res.json({ ...getClass.get(id), students: getStudents.all(id) });
});

app.post('/api/classes/:id/students', (req, res) => {
  const id = Number(req.params.id);
  if (!getClass.get(id)) return res.status(404).json({ error: 'Třída nebyla nalezena.' });
  if (!Array.isArray(req.body.names)) return res.status(400).json({ error: 'Očekával jsem seznam jmen.' });
  const names = req.body.names.map(name => String(name).trim().slice(0, 80)).filter(Boolean).slice(0, 100);
  const updateRoster = db.transaction(() => {
    const oldStudents = getStudents.all(id);
    const byName = new Map();
    for (const student of oldStudents) {
      const key = student.name.toLocaleLowerCase('cs');
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(student);
    }
    db.prepare('DELETE FROM students WHERE class_id = ?').run(id);
    const insert = db.prepare('INSERT INTO students (id, class_id, name, seat_index, sort_order) VALUES (?, ?, ?, ?, ?)');
    const insertNew = db.prepare('INSERT INTO students (class_id, name, seat_index, sort_order) VALUES (?, ?, NULL, ?)');
    names.forEach((name, index) => {
      const matches = byName.get(name.toLocaleLowerCase('cs')) || [];
      const previous = matches.shift();
      if (previous) insert.run(previous.id, id, name, previous.seatIndex, index);
      else insertNew.run(id, name, index);
    });
  });
  updateRoster();
  res.json({ ...getClass.get(id), students: getStudents.all(id) });
});

app.put('/api/classes/:id/seating', (req, res) => {
  const id = Number(req.params.id);
  const classroom = getClass.get(id);
  if (!classroom) return res.status(404).json({ error: 'Třída nebyla nalezena.' });
  if (!Array.isArray(req.body.students)) return res.status(400).json({ error: 'Neplatné rozmístění.' });
  const students = getStudents.all(id);
  const knownIds = new Set(students.map(student => student.id));
  const seats = req.body.students;
  const occupied = new Set();
  for (const student of seats) {
    if (!knownIds.has(Number(student.id))) return res.status(400).json({ error: 'Neznámý žák.' });
    if (student.seatIndex !== null && student.seatIndex !== undefined) {
      const seat = Number(student.seatIndex);
      if (!Number.isInteger(seat) || seat < 0 || seat >= classroom.rows * classroom.desksPerRow * 2 || occupied.has(seat)) {
        return res.status(400).json({ error: 'Místa musí být platná a jedinečná.' });
      }
      occupied.add(seat);
    }
  }
  const save = db.transaction(() => {
    const update = db.prepare('UPDATE students SET seat_index = ? WHERE id = ? AND class_id = ?');
    for (const student of seats) update.run(student.seatIndex ?? null, Number(student.id), id);
  });
  save();
  res.json({ students: getStudents.all(id) });
});

app.delete('/api/classes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getClass.get(id)) return res.status(404).json({ error: 'Třída nebyla nalezena.' });
  if (db.prepare('SELECT COUNT(*) AS count FROM classes').get().count <= 1) {
    return res.status(400).json({ error: 'Poslední třídu nelze smazat.' });
  }
  db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  res.status(204).end();
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Zasedák běží na http://localhost:${port}`));

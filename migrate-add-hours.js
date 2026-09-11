// migrate-add-hours.js
// Im Gegensatz zu setup-db.js NICHT destruktiv: legt nur die neue "hours"-Tabelle
// an und befüllt sie NUR, falls sie noch leer ist. Rührt menu_items/categories/
// settings nicht an - sicher auf einer schon laufenden Datenbank auszuführen.

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_HOURS = [
  { day: 'Montag', opens: '11:00', closes: '19:00', closed: false },
  { day: 'Dienstag', opens: '11:00', closes: '19:00', closed: false },
  { day: 'Mittwoch', opens: '11:00', closes: '19:00', closed: false },
  { day: 'Donnerstag', opens: '11:00', closes: '19:00', closed: false },
  { day: 'Freitag', opens: '11:00', closes: '23:00', closed: false },
  { day: 'Samstag', opens: '11:00', closes: '23:00', closed: false },
  { day: 'Sonntag', opens: null, closes: null, closed: true }
];

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hours (
      day_of_week INTEGER PRIMARY KEY,
      day_name TEXT NOT NULL,
      opens TEXT,
      closes TEXT,
      closed BOOLEAN NOT NULL DEFAULT false
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM hours');
  if (parseInt(rows[0].count) > 0) {
    console.log('Tabelle "hours" hat schon Daten - überspringe Befüllung, nichts verändert.');
  } else {
    for (let i = 0; i < DEFAULT_HOURS.length; i++) {
      const h = DEFAULT_HOURS[i];
      await pool.query(
        'INSERT INTO hours (day_of_week, day_name, opens, closes, closed) VALUES ($1, $2, $3, $4, $5)',
        [i, h.day, h.opens, h.closes, h.closed]
      );
    }
    console.log('Tabelle "hours" angelegt und mit Standardwerten befüllt.');
  }

  await pool.end();
}

main();

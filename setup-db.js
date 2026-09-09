// setup-db.js (PostgreSQL-Version)
// Node kann eine .js-Datei nicht "await" ganz oben ausführen, wenn's kein Modul ist -
// deshalb packen wir alles in eine async-Funktion und rufen sie selbst auf.

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function toCents(priceString) {
  const clean = priceString.replace('€', '').trim().replace(',', '.');
  return Math.round(parseFloat(clean) * 100);
}

async function main() {
  // --- Tabellen anlegen ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image TEXT,
      note TEXT,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL
    );
  `);

  // --- alte Daten leeren, damit das Skript gefahrlos mehrfach läuft ---
  await pool.query('DELETE FROM menu_items; DELETE FROM categories; DELETE FROM settings;');

  const content = JSON.parse(fs.readFileSync('data/content.json', 'utf-8'));

  await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['hero_slogan', content.hero.slogan]);

  for (let catIndex = 0; catIndex < content.menu.length; catIndex++) {
    const category = content.menu[catIndex];
    await pool.query(
      'INSERT INTO categories (id, name, image, note, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [category.id, category.name, category.image || null, category.note || null, catIndex]
    );
    for (let itemIndex = 0; itemIndex < category.items.length; itemIndex++) {
      const item = category.items[itemIndex];
      await pool.query(
        'INSERT INTO menu_items (category_id, name, price_cents, description, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [category.id, item.name, toCents(item.price), item.desc || null, itemIndex]
      );
    }
  }

  const { rows: catCount } = await pool.query('SELECT COUNT(*) FROM categories');
  const { rows: itemCount } = await pool.query('SELECT COUNT(*) FROM menu_items');
  console.log('Datenbank angelegt und befüllt (PostgreSQL)');
  console.log('Kategorien:', catCount[0].count);
  console.log('Gerichte:', itemCount[0].count);

  await pool.end(); // Verbindung sauber schließen, sonst hängt das Skript
}

main();

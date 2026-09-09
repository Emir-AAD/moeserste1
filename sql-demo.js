const Database = require('better-sqlite3');
const db = new Database('moeskebap.db');

console.log('--- Alle Gerichte der Kategorie "Vegetarisch" ---');
console.log(db.prepare("SELECT name, price FROM menu_items WHERE category_id = 'menu-vegetarisch'").all());

console.log('--- Die 3 teuersten Gerichte ---');
console.log(db.prepare('SELECT name, price FROM menu_items ORDER BY price DESC LIMIT 3').all());

console.log('--- Slogan aus settings ---');
console.log(db.prepare("SELECT value FROM settings WHERE key = 'hero_slogan'").get());

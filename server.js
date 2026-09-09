require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// Ein "Pool" statt einer einzelnen Verbindung: hält mehrere offene Verbindungen
// bereit und verteilt sie auf gleichzeitige Anfragen - eine einzelne Verbindung
// würde bei mehreren Besuchern gleichzeitig zum Nadelöhr.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Multer: unverändert, hat mit der Datenbank nichts zu tun ---
const upload = multer({
  storage: multer.diskStorage({
    destination: 'public/img',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  }
});

app.set('view engine', 'ejs');
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 4
  }
}));

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

function formatPrice(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

// jetzt "async function" - lädt Daten über await, statt sie sofort zurückzugeben
async function loadContent() {
  const sloganResult = await pool.query("SELECT value FROM settings WHERE key = 'hero_slogan'");
  const slogan = sloganResult.rows[0].value;

  const { rows: categories } = await pool.query('SELECT * FROM categories ORDER BY sort_order');

  const menu = [];
  for (const cat of categories) {
    const { rows: items } = await pool.query(
      'SELECT * FROM menu_items WHERE category_id = $1 ORDER BY sort_order',
      [cat.id]
    );
    menu.push({
      id: cat.id,
      name: cat.name,
      image: cat.image,
      note: cat.note,
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        price: formatPrice(item.price_cents),
        desc: item.description
      }))
    });
  }

  return { hero: { slogan }, menu };
}

// --- öffentliche Seite ---
app.get('/', async (req, res) => {
  try {
    res.render('index', await loadContent());
  } catch (err) {
    console.error(err);
    res.status(500).send('Etwas ist schiefgelaufen.');
  }
});

// --- Admin: Login (keine Datenbank beteiligt, bleibt synchron) ---
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('admin-login', { error: 'Falsches Passwort.' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// --- Admin: Übersicht ---
app.get('/admin', requireAdmin, async (req, res) => {
  try {
    res.render('admin', await loadContent());
  } catch (err) {
    console.error(err);
    res.status(500).send('Etwas ist schiefgelaufen.');
  }
});

// --- Admin: Gericht bearbeiten ---
app.get('/admin/items/:id/edit', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).send('Gericht nicht gefunden.');
  const { rows: categories } = await pool.query('SELECT * FROM categories ORDER BY sort_order');
  res.render('admin-edit-item', { item: rows[0], categories });
});

app.post('/admin/items/:id/edit', requireAdmin, async (req, res) => {
  const cents = Math.round(parseFloat(req.body.price.replace(',', '.')) * 100);
  await pool.query(
    'UPDATE menu_items SET name = $1, price_cents = $2, description = $3, category_id = $4 WHERE id = $5',
    [req.body.name, cents, req.body.description || null, req.body.category_id, req.params.id]
  );
  res.redirect('/admin');
});

// --- Admin: Gericht neu anlegen ---
app.get('/admin/items/new', requireAdmin, async (req, res) => {
  const { rows: categories } = await pool.query('SELECT * FROM categories ORDER BY sort_order');
  const item = { id: null, name: '', category_id: categories[0].id, price_cents: null, description: '' };
  res.render('admin-edit-item', { item, categories });
});

app.post('/admin/items/new', requireAdmin, async (req, res) => {
  const cents = Math.round(parseFloat(req.body.price.replace(',', '.')) * 100);
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_items WHERE category_id = $1',
    [req.body.category_id]
  );
  await pool.query(
    'INSERT INTO menu_items (category_id, name, price_cents, description, sort_order) VALUES ($1, $2, $3, $4, $5)',
    [req.body.category_id, req.body.name, cents, req.body.description || null, rows[0].m + 1]
  );
  res.redirect('/admin');
});

// --- Admin: Gericht löschen ---
app.post('/admin/items/:id/delete', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
  res.redirect('/admin');
});

// --- Admin: Kategorie-Bild bearbeiten ---
app.get('/admin/categories/:id/edit', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).send('Kategorie nicht gefunden.');
  res.render('admin-edit-category', { category: rows[0] });
});

app.post('/admin/categories/:id/edit', requireAdmin, upload.single('image'), async (req, res) => {
  if (req.file) {
    await pool.query('UPDATE categories SET image = $1 WHERE id = $2', [req.file.filename, req.params.id]);
  }
  res.redirect('/admin');
});

// --- Admin: Slogan bearbeiten ---
app.get('/admin/slogan/edit', requireAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'hero_slogan'");
  res.render('admin-slogan', { slogan: rows[0].value });
});

app.post('/admin/slogan/edit', requireAdmin, async (req, res) => {
  await pool.query("UPDATE settings SET value = $1 WHERE key = 'hero_slogan'", [req.body.slogan]);
  res.redirect('/admin');
});

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

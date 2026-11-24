const express = require('express');
const cors = require('cors');
const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');
const multer = require('multer');


// auth
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-env-var';
const JWT_EXPIRES_IN = '8h';




const app = express();
app.use(cors());
app.use(express.json());

// ── Upload directories ─────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CONTAINER_DOCS_DIR = path.join(UPLOAD_DIR, 'containers');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CONTAINER_DOCS_DIR)) fs.mkdirSync(CONTAINER_DOCS_DIR, { recursive: true });

// ── Small helpers ──────────────────────────────────────────────────────────────

function isValidId(id) {
  return /^\d+$/.test(String(id));
}

function requireValidId(req, res) {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return false;
  }
  return true;
}

function safe(handler) {
  return (req, res) => {
    try {
      const result = handler(req, res);
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          console.error(err);
          if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur' });
        });
      }
    } catch (err) {
      console.error(err);
      if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Cette valeur existe deja (doublon)' });
      }
      if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur' });
    }
  };
}

function parseYear(input) {
  const y = parseInt(input, 10);
  if (!input || isNaN(y) || y < 2000 || y > 2100) return new Date().getFullYear();
  return y;
}

function parseTrimestre(input) {
  const t = parseInt(input, 10);
  return [1, 2, 3, 4].includes(t) ? t : null;
}

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Facture amount computation ──────────────────────────────────────────────
function computeFactureAmounts(calc_type, input) {
  if (calc_type === 'total') {
    const total_ttc = parseFloat(input.total_ttc_saisi);
    const pu_ttc = round2(parseFloat(input.pu_ttc));
    if (isNaN(total_ttc) || total_ttc <= 0) throw new Error('Le total TTC est obligatoire et doit etre positif');
    if (isNaN(pu_ttc) || pu_ttc <= 0) throw new Error('Le prix unitaire TTC est obligatoire et doit etre positif');

    const tva = round2(total_ttc / 6);
    const montant_ht = round2(total_ttc - tva);
    const qte_kg = Math.floor(total_ttc / pu_ttc);
    const pt_ttc = round2(qte_kg * pu_ttc);
    const ajustement_arrondi = round2(total_ttc - pt_ttc);

    return { qte_kg, pu_ttc, pt_ttc, montant_ht, tva, ajustement_arrondi, total_ttc_saisi: total_ttc };
  }

  // calc_type === 'qte' (par defaut)
  const qte_kg = parseFloat(input.qte_kg);
  const pu_ttc = round2(parseFloat(input.pu_ttc));
  if (isNaN(qte_kg) || qte_kg <= 0) throw new Error('La quantite (kg) est obligatoire et doit etre positive');
  if (isNaN(pu_ttc) || pu_ttc <= 0) throw new Error('Le prix unitaire TTC est obligatoire et doit etre positif');

  const pt_ttc = round2(qte_kg * pu_ttc);
  const tva = round2(pt_ttc / 6);
  const montant_ht = round2(pt_ttc - tva);

  return { qte_kg, pu_ttc, pt_ttc, montant_ht, tva, ajustement_arrondi: 0, total_ttc_saisi: null };
}

// ── Invoice vars (used for single & grouped exports) ─────────────────────────
function frNumberSrv(n, decimals) {
  const num = Number(n || 0);
  const neg = num < 0;
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = neg ? '-' : '';
  return decPart !== undefined ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}
function fmtSrv(n) { return frNumberSrv(n, 2); }
function fmtDateSrv(d) { return d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
function fmtIntSrv(n) { return n ? frNumberSrv(n, 0) : '0'; }

function numToWords(n) {
  const ones = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingts", "quatre-vingt"];
  function b100(n) { if (n < 20) return ones[n]; const t = Math.floor(n / 10), u = n % 10; if (t === 7) return "soixante-" + ones[10 + u]; if (t === 9) return "quatre-vingt-" + (u ? ones[u] : ""); return tens[t] + (u ? "-" + ones[u] : (t === 8 ? "s" : "")); }
  function b1000(n) { if (n < 100) return b100(n); const h = Math.floor(n / 100), r = n % 100; return (h > 1 ? ones[h] + " " : "") + "cent" + (r ? (h > 1 ? "s" : "") + "-" + b100(r) : "s"); }
  n = Math.round(n); if (n === 0) return "zero"; let res = "";
  if (n >= 1000) { const m = Math.floor(n / 1000); res += (m > 1 ? b1000(m) + " " : "") + "mille "; n %= 1000; }
  if (n > 0) res += b1000(n); return res.trim();
}

function buildInvoiceVarsSrv(f, client) {
  const isPhysique = f.client_type === 'physique';
  const totalTTC = (f.pt_ttc || 0) + (f.ajustement_arrondi || 0);
  return {
    client_nom: isPhysique ? (f.client_nom_manuel || '-') : (client?.name || '-'),
    client_identity: isPhysique ? `CIN : ${f.client_cin_manuel || '-'}` : `ICE : ${client?.ice || '-'}`,
    client_adresse: isPhysique ? (f.client_adresse_manuel || '-') : (client?.address || '-'),
    numero: f.numero,
    lieu: f.lieu,
    date: fmtDateSrv(f.date),
    qte_kg: fmtIntSrv(f.qte_kg),
    designation: f.designation,
    pu_ttc: fmtSrv(f.pu_ttc),
    total_ttc: fmtSrv((f.pt_ttc || 0) + (f.ajustement_arrondi || 0)),
    pt_ttc: fmtSrv(f.pt_ttc),
    montant_ht: fmtSrv(f.montant_ht),
    tva: fmtSrv(f.tva),
    pt_ttc_letters: numToWords(Math.round(totalTTC)) + ' dirhams',
    mode_paiement: f.mode_paiement || '-',
    ajustement_arrondi: fmtSrv(f.ajustement_arrondi || 0)
  };
}

// ── Database setup ────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'tradivia.db'));
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ice TEXT,
    address TEXT,
    phone TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS factures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER,
    numero TEXT UNIQUE NOT NULL,
    lieu TEXT,
    date TEXT,
    qte_kg REAL,
    designation TEXT,
    pu_ttc REAL,
    pt_ttc REAL,
    montant_ht REAL,
    tva REAL,
    paid INTEGER DEFAULT 0,
    FOREIGN KEY (clientId) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    type TEXT,
    scelle TEXT,
    statut TEXT DEFAULT 'En transit',
    fournisseur TEXT,
    port_depart TEXT,
    port_arrivee TEXT,
    date_depart TEXT,
    date_arrivee TEXT,
    nb_sacs INTEGER DEFAULT 0,
    poids_total REAL DEFAULT 0,
    bl TEXT,
    facture_commerciale TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS container_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    categorie TEXT NOT NULL,
    libelle TEXT NOT NULL,
    montant_ht REAL NOT NULL,
    tva REAL DEFAULT 0,
    montant_ttc REAL NOT NULL,
    fournisseur TEXT,
    mode_paiement TEXT DEFAULT 'Virement',
    reference TEXT,
    deductible INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exercices_comptables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    annee INTEGER UNIQUE NOT NULL,
    date_debut TEXT,
    date_fin TEXT,
    statut TEXT DEFAULT 'En cours',
    ca_total REAL DEFAULT 0,
    charges_totales REAL DEFAULT 0,
    resultat_net REAL DEFAULT 0,
    is_du REAL DEFAULT 0,
    cm_du REAL DEFAULT 0,
    css_du REAL DEFAULT 0,
    tva_collectee REAL DEFAULT 0,
    tva_deductible REAL DEFAULT 0,
    tva_a_payer REAL DEFAULT 0,
    patente_du REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS ordres_virement_tva (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    montant REAL NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ordres_virement_zizi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    nom TEXT,
    rib TEXT,
    banque TEXT,
    montant REAL NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Migration: add the new "facture" columns to existing databases ───────────
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('factures', 'client_type', "TEXT DEFAULT 'societe'");
ensureColumn('factures', 'client_nom_manuel', 'TEXT');
ensureColumn('factures', 'client_cin_manuel', 'TEXT');
ensureColumn('factures', 'client_adresse_manuel', 'TEXT');
ensureColumn('factures', 'calc_type', "TEXT DEFAULT 'qte'");
ensureColumn('factures', 'total_ttc_saisi', 'REAL');
ensureColumn('factures', 'mode_paiement', 'TEXT');
ensureColumn('factures', 'ajustement_arrondi', 'REAL DEFAULT 0');
ensureColumn('ordres_virement_zizi', 'nom', 'TEXT');
ensureColumn('ordres_virement_zizi', 'rib', 'TEXT');
ensureColumn('ordres_virement_zizi', 'banque', 'TEXT');

// Seed default clients if empty
const count = db.prepare('SELECT COUNT(*) as c FROM clients').get();
if (count.c === 0) {
  const insert = db.prepare('INSERT INTO clients (name, ice, address, phone, email) VALUES (?, ?, ?, ?, ?)');
  insert.run('Grande Surface Atlas', '002345678901234', 'Bd Zerktouni, Casablanca', '+212 6 61 00 00 00', 'achats@atlas.ma');
  insert.run('Cafe Central',         '003456789012345', 'Rue de Fes, Rabat',        '+212 6 62 00 00 00', 'cafe.central@mail.ma');
  insert.run('Hotel Mogador',        '',                'Av Hassan II, Essaouira',  '+212 5 24 00 00 00', 'achats@mogador.com');
}

// Seed sample charges if empty
const chargeCount = db.prepare('SELECT COUNT(*) as c FROM charges').get();
if (chargeCount.c === 0) {
  const insertCharge = db.prepare(`
    INSERT INTO charges (date, categorie, libelle, montant_ht, tva, montant_ttc, fournisseur, mode_paiement, reference, deductible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCharge.run('2026-01-15', 'Fournitures', 'Achat cafe vert - Lot janvier', 45000, 9000, 54000, 'Cooperative Agricole Taroudant', 'Virement', 'FAC-2026-001', 1);
  insertCharge.run('2026-01-20', 'Logistique', 'Fret maritime conteneur MSCU2847563', 28000, 5600, 33600, 'Maersk Line Maroc', 'Virement', 'BL-MSC-2847', 1);
  insertCharge.run('2026-02-05', 'Fournitures', 'Achat cafe vert - Lot fevrier', 52000, 10400, 62400, 'Cooperative Agricole Taroudant', 'Virement', 'FAC-2026-015', 1);
  insertCharge.run('2026-02-10', 'Salaires', 'Salaires janvier 2026', 35000, 0, 35000, 'Personnel', 'Virement', 'SAL-01-2026', 1);
  insertCharge.run('2026-02-15', 'Charges sociales', 'CNSS janvier 2026', 8750, 0, 8750, 'CNSS', 'Virement', 'CNSS-01-2026', 1);
  insertCharge.run('2026-03-01', 'Marketing', 'Campagne publicitaire Q1', 15000, 3000, 18000, 'Agence MediaCom', 'Virement', 'FAC-MED-2026-003', 1);
  insertCharge.run('2026-03-10', 'Fournitures', 'Achat cafe vert - Lot mars', 48000, 9600, 57600, 'Cooperative Agricole Taroudant', 'Virement', 'FAC-2026-032', 1);
  insertCharge.run('2026-03-15', 'Frais bancaires', 'Commissions bancaires T1', 2500, 500, 3000, 'Attijariwafa Bank', 'Prelevement', 'COM-BANK-Q1', 1);
  insertCharge.run('2026-03-20', 'Loyer', 'Loyer local commercial Q1', 36000, 7200, 43200, 'Proprietaire Immobilier', 'Virement', 'LOY-Q1-2026', 1);
  insertCharge.run('2026-04-05', 'Fournitures', 'Achat cafe vert - Lot avril', 55000, 11000, 66000, 'Cooperative Agricole Taroudant', 'Virement', 'FAC-2026-048', 1);
}



const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
  const hash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('⚠️  Utilisateur admin cree avec mot de passe temporaire — changez-le immediatement.');
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, active FROM users WHERE id = ?').get(payload.id);
    if (!user || !user.active) return res.status(401).json({ error: 'Session invalide' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expiree ou invalide' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acces refuse' });
    }
    next();
  };
}

// ── Auth routes ────────────────────────────────────────────────────────────────
// IMPORTANT: login must be registered BEFORE the requireAuth middleware,
// otherwise nobody could ever log in.
app.post('/api/auth/login', safe((req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.active) return res.status(401).json({ error: 'Identifiants incorrects' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
}));

// From here on, every /api/* route requires a valid JWT.
app.use('/api', requireAuth);

app.get('/api/auth/me', safe((req, res) => {
  res.json({ user: req.user });
}));

app.post('/api/auth/change-password', safe((req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caracteres' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
}));

// Admin-only: manage users
app.get('/api/users', requireRole('admin'), safe((req, res) => {
  res.json(db.prepare('SELECT id, username, role, active, created_at, last_login FROM users ORDER BY username').all());
}));

app.post('/api/users', requireRole('admin'), safe((req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });

  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role === 'admin' ? 'admin' : 'user');
  res.json(db.prepare('SELECT id, username, role, active FROM users WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/users/:id/deactivate', requireRole('admin'), safe((req, res) => {
  if (!requireValidId(req, res)) return;
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Client routes ─────────────────────────────────────────────────────────────
app.get('/api/clients', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM clients ORDER BY name').all());
}));

app.post('/api/clients', safe((req, res) => {
  const { name, ice, address, phone, email } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Le nom du client est obligatoire' });
  const r = db.prepare('INSERT INTO clients (name, ice, address, phone, email) VALUES (?, ?, ?, ?, ?)').run(name, ice || null, address || null, phone || null, email || null);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/clients/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { name, ice, address, phone, email } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Le nom du client est obligatoire' });
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client non trouve' });
  db.prepare('UPDATE clients SET name=?, ice=?, address=?, phone=?, email=? WHERE id=?').run(name, ice || null, address || null, phone || null, email || null, req.params.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
}));

app.delete('/api/clients/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Facture routes ────────────────────────────────────────────────────────────
app.get('/api/factures', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM factures ORDER BY date DESC').all());
}));

app.post('/api/factures', safe((req, res) => {
  const {
    clientId, client_type, client_nom_manuel, client_cin_manuel, client_adresse_manuel,
    numero, lieu, date, designation,
    calc_type, qte_kg, pu_ttc, total_ttc_saisi,
    mode_paiement
  } = req.body;

  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de facture est obligatoire' });

  const type = client_type === 'physique' ? 'physique' : 'societe';

  if (type === 'societe') {
    if (!clientId) return res.status(400).json({ error: 'Le client est obligatoire' });
    const clientExists = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId);
    if (!clientExists) return res.status(400).json({ error: 'Client invalide' });
  } else {
    if (!client_nom_manuel || !String(client_nom_manuel).trim()) return res.status(400).json({ error: 'Le nom de la personne physique est obligatoire' });
    if (!client_cin_manuel || !String(client_cin_manuel).trim()) return res.status(400).json({ error: 'Le CIN est obligatoire' });
  }

  const mode = calc_type === 'total' ? 'total' : 'qte';
  let amounts;
  try {
    amounts = computeFactureAmounts(mode, { qte_kg, pu_ttc, total_ttc_saisi });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const r = db.prepare(`
    INSERT INTO factures (
      clientId, client_type, client_nom_manuel, client_cin_manuel, client_adresse_manuel,
      numero, lieu, date, qte_kg, designation, pu_ttc, pt_ttc, montant_ht, tva,
      calc_type, total_ttc_saisi, mode_paiement, ajustement_arrondi, paid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    type === 'societe' ? clientId : null,
    type,
    type === 'physique' ? client_nom_manuel : null,
    type === 'physique' ? client_cin_manuel : null,
    type === 'physique' ? (client_adresse_manuel || null) : null,
    numero, lieu || null, date || null,
    amounts.qte_kg, designation || null, amounts.pu_ttc, amounts.pt_ttc, amounts.montant_ht, amounts.tva,
    mode, amounts.total_ttc_saisi, mode_paiement || null, amounts.ajustement_arrondi
  );
  res.json(db.prepare('SELECT * FROM factures WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/factures/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const {
    clientId, client_type, client_nom_manuel, client_cin_manuel, client_adresse_manuel,
    numero, lieu, date, designation,
    calc_type, qte_kg, pu_ttc, total_ttc_saisi,
    mode_paiement, paid
  } = req.body;

  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de facture est obligatoire' });
  const existing = db.prepare('SELECT id FROM factures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Facture non trouvee' });

  const type = client_type === 'physique' ? 'physique' : 'societe';

  if (type === 'societe') {
    if (!clientId) return res.status(400).json({ error: 'Le client est obligatoire' });
    const clientExists = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId);
    if (!clientExists) return res.status(400).json({ error: 'Client invalide' });
  } else {
    if (!client_nom_manuel || !String(client_nom_manuel).trim()) return res.status(400).json({ error: 'Le nom de la personne physique est obligatoire' });
    if (!client_cin_manuel || !String(client_cin_manuel).trim()) return res.status(400).json({ error: 'Le CIN est obligatoire' });
  }

  const mode = calc_type === 'total' ? 'total' : 'qte';
  let amounts;
  try {
    amounts = computeFactureAmounts(mode, { qte_kg, pu_ttc, total_ttc_saisi });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  db.prepare(`
    UPDATE factures SET
      clientId=?, client_type=?, client_nom_manuel=?, client_cin_manuel=?, client_adresse_manuel=?,
      numero=?, lieu=?, date=?, qte_kg=?, designation=?, pu_ttc=?, pt_ttc=?, montant_ht=?, tva=?,
      calc_type=?, total_ttc_saisi=?, mode_paiement=?, ajustement_arrondi=?, paid=?
    WHERE id=?
  `).run(
    type === 'societe' ? clientId : null,
    type,
    type === 'physique' ? client_nom_manuel : null,
    type === 'physique' ? client_cin_manuel : null,
    type === 'physique' ? (client_adresse_manuel || null) : null,
    numero, lieu || null, date || null,
    amounts.qte_kg, designation || null, amounts.pu_ttc, amounts.pt_ttc, amounts.montant_ht, amounts.tva,
    mode, amounts.total_ttc_saisi, mode_paiement || null, amounts.ajustement_arrondi,
    paid ? 1 : 0,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id));
}));

app.delete('/api/factures/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  db.prepare('DELETE FROM factures WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Bulk delete factures (used by the "Supprimer selection" button) ─────────
app.delete('/api/factures', safe((req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Aucune facture selectionnee' });
  }
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM factures WHERE id IN (${placeholders})`).run(...ids);
  res.json({ ok: true, deleted: ids.length });
}));

// ── Container routes ───────────────────────────────────────────────────────────

function getContainerDocs(containerId) {
  return db.prepare('SELECT id, original_name, stored_name, mime_type, file_size, uploaded_at FROM container_documents WHERE container_id = ? ORDER BY uploaded_at DESC').all(containerId);
}

app.get('/api/containers', safe((req, res) => {
  const { q, statut, fournisseur, port_depart, port_arrivee } = req.query;
  let sql = 'SELECT * FROM containers WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (numero LIKE ? OR scelle LIKE ? OR fournisseur LIKE ? OR bl LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (statut) { sql += ' AND statut = ?'; params.push(statut); }
  if (fournisseur) { sql += ' AND fournisseur LIKE ?'; params.push(`%${fournisseur}%`); }
  if (port_depart) { sql += ' AND port_depart LIKE ?'; params.push(`%${port_depart}%`); }
  if (port_arrivee) { sql += ' AND port_arrivee LIKE ?'; params.push(`%${port_arrivee}%`); }

  sql += ' ORDER BY date_depart DESC';
  const containers = db.prepare(sql).all(...params);
  const result = containers.map(c => ({
    ...c,
    documents: getContainerDocs(c.id)
  }));
  res.json(result);
}));

app.get('/api/containers/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const row = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Conteneur non trouve' });
  row.documents = getContainerDocs(row.id);
  res.json(row);
}));

app.post('/api/containers', safe((req, res) => {
  const { numero, type, scelle, statut, fournisseur, port_depart, port_arrivee, date_depart, date_arrivee, nb_sacs, poids_total, bl, facture_commerciale } = req.body;
  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de conteneur est obligatoire' });
  const r = db.prepare(`
    INSERT INTO containers (numero, type, scelle, statut, fournisseur, port_depart, port_arrivee, date_depart, date_arrivee, nb_sacs, poids_total, bl, facture_commerciale, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(numero, type || null, scelle || null, statut || 'En transit', fournisseur || null, port_depart || null, port_arrivee || null, date_depart || null, date_arrivee || null, nb_sacs || 0, poids_total || 0, bl || null, facture_commerciale || null);
  const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(r.lastInsertRowid);
  container.documents = [];
  res.json(container);
}));

app.put('/api/containers/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { numero, type, scelle, statut, fournisseur, port_depart, port_arrivee, date_depart, date_arrivee, nb_sacs, poids_total, bl, facture_commerciale } = req.body;
  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de conteneur est obligatoire' });
  const existing = db.prepare('SELECT id FROM containers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Conteneur non trouve' });
  db.prepare(`
    UPDATE containers SET numero=?, type=?, scelle=?, statut=?, fournisseur=?, port_depart=?, port_arrivee=?, date_depart=?, date_arrivee=?, nb_sacs=?, poids_total=?, bl=?, facture_commerciale=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(numero, type || null, scelle || null, statut || 'En transit', fournisseur || null, port_depart || null, port_arrivee || null, date_depart || null, date_arrivee || null, nb_sacs || 0, poids_total || 0, bl || null, facture_commerciale || null, req.params.id);
  const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
  container.documents = getContainerDocs(req.params.id);
  res.json(container);
}));

app.delete('/api/containers/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const docs = getContainerDocs(req.params.id);
  docs.forEach(doc => {
    const filePath = path.join(CONTAINER_DOCS_DIR, req.params.id, doc.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
  const containerDir = path.join(CONTAINER_DOCS_DIR, req.params.id);
  if (fs.existsSync(containerDir)) fs.rmSync(containerDir, { recursive: true, force: true });

  db.prepare('DELETE FROM container_documents WHERE container_id = ?').run(req.params.id);
  db.prepare('DELETE FROM containers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

app.post('/api/containers/:id/documents', (req, res, next) => {
  if (!requireValidId(req, res)) return;
  next();
}, (req, res) => {
  upload.array('documents', 10)(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (max 50MB)' : (err.message || 'Erreur televersement');
      return res.status(400).json({ error: message });
    }
    try {
      const containerId = req.params.id;
      const container = db.prepare('SELECT id FROM containers WHERE id = ?').get(containerId);
      if (!container) return res.status(404).json({ error: 'Conteneur non trouve' });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Aucun fichier televerse' });
      }

      const insert = db.prepare(`
        INSERT INTO container_documents (container_id, original_name, stored_name, mime_type, file_size)
        VALUES (?, ?, ?, ?, ?)
      `);

      const uploaded = [];
      req.files.forEach(file => {
        const result = insert.run(containerId, file.originalname, file.filename, file.mimetype, file.size);
        uploaded.push({
          id: result.lastInsertRowid,
          original_name: file.originalname,
          stored_name: file.filename,
          mime_type: file.mimetype,
          file_size: file.size,
          uploaded_at: new Date().toISOString()
        });
      });

      res.json({ ok: true, documents: uploaded });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
});

app.get('/api/containers/:id/documents/:docId/download', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  if (!isValidId(req.params.docId)) return res.status(400).json({ error: 'Identifiant invalide' });
  const doc = db.prepare('SELECT * FROM container_documents WHERE id = ? AND container_id = ?').get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document non trouve' });

  const filePath = path.join(CONTAINER_DOCS_DIR, req.params.id, doc.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouve' });

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
}));

app.get('/api/containers/:id/documents/:docId/view', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  if (!isValidId(req.params.docId)) return res.status(400).json({ error: 'Identifiant invalide' });
  const doc = db.prepare('SELECT * FROM container_documents WHERE id = ? AND container_id = ?').get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document non trouve' });

  const filePath = path.join(CONTAINER_DOCS_DIR, req.params.id, doc.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouve' });

  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
}));

app.delete('/api/containers/:id/documents/:docId', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  if (!isValidId(req.params.docId)) return res.status(400).json({ error: 'Identifiant invalide' });
  const doc = db.prepare('SELECT * FROM container_documents WHERE id = ? AND container_id = ?').get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document non trouve' });

  const filePath = path.join(CONTAINER_DOCS_DIR, req.params.id, doc.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM container_documents WHERE id = ?').run(req.params.docId);
  res.json({ ok: true });
}));

// ── Multer storage for container documents ───────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const containerDir = path.join(CONTAINER_DOCS_DIR, req.params.id);
    if (!fs.existsSync(containerDir)) fs.mkdirSync(containerDir, { recursive: true });
    cb(null, containerDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/zip'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporte'));
    }
  }
});

// ── Charges routes ─────────────────────────────────────────────────────────────
app.get('/api/charges', safe((req, res) => {
  const { annee, categorie, q } = req.query;
  let sql = 'SELECT * FROM charges WHERE 1=1';
  const params = [];

  if (annee) {
    sql += " AND strftime('%Y', date) = ?";
    params.push(String(annee));
  }
  if (categorie) {
    sql += " AND categorie = ?";
    params.push(categorie);
  }
  if (q) {
    sql += ' AND (libelle LIKE ? OR fournisseur LIKE ? OR reference LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ' ORDER BY date DESC';
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/charges/categories', safe((req, res) => {
  const rows = db.prepare('SELECT DISTINCT categorie FROM charges ORDER BY categorie').all();
  res.json(rows.map(r => r.categorie));
}));

app.get('/api/charges/stats', safe((req, res) => {
  const { annee } = req.query;
  const yearFilter = annee ? "WHERE strftime('%Y', date) = ?" : '';
  const params = annee ? [String(annee)] : [];

  const total = db.prepare(`SELECT SUM(montant_ttc) as total FROM charges ${yearFilter}`).get(...params);
  const byCategory = db.prepare(`
    SELECT categorie, SUM(montant_ht) as montant_ht, SUM(tva) as tva, SUM(montant_ttc) as montant_ttc, COUNT(*) as count
    FROM charges ${yearFilter}
    GROUP BY categorie
    ORDER BY montant_ttc DESC
  `).all(...params);

  const byMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as mois, SUM(montant_ttc) as montant
    FROM charges ${yearFilter ? yearFilter : 'WHERE date >= date("now", "-12 months")'}
    GROUP BY mois
    ORDER BY mois
  `).all(...params);

  res.json({
    total: total.total || 0,
    byCategory,
    byMonth
  });
}));

app.post('/api/charges', safe((req, res) => {
  const { date, categorie, libelle, montant_ht, tva, montant_ttc, fournisseur, mode_paiement, reference, deductible, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'La date est obligatoire' });
  if (!categorie) return res.status(400).json({ error: 'La categorie est obligatoire' });
  if (!libelle || !String(libelle).trim()) return res.status(400).json({ error: 'Le libelle est obligatoire' });
  if (montant_ht === undefined || montant_ht === null || montant_ht === '') return res.status(400).json({ error: 'Le montant HT est obligatoire' });
  const ht = parseFloat(montant_ht);
  const tvaVal = parseFloat(tva) || 0;
  const ttc = montant_ttc !== undefined && montant_ttc !== null && montant_ttc !== '' ? parseFloat(montant_ttc) : ht + tvaVal;
  const r = db.prepare(`
    INSERT INTO charges (date, categorie, libelle, montant_ht, tva, montant_ttc, fournisseur, mode_paiement, reference, deductible, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, categorie, libelle, ht, tvaVal, ttc, fournisseur || null, mode_paiement || 'Virement', reference || null, deductible ? 1 : 0, notes || null);
  res.json(db.prepare('SELECT * FROM charges WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/charges/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { date, categorie, libelle, montant_ht, tva, montant_ttc, fournisseur, mode_paiement, reference, deductible, notes } = req.body;
  if (!libelle || !String(libelle).trim()) return res.status(400).json({ error: 'Le libelle est obligatoire' });
  const existing = db.prepare('SELECT id FROM charges WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Charge non trouvee' });
  db.prepare(`
    UPDATE charges SET date=?, categorie=?, libelle=?, montant_ht=?, tva=?, montant_ttc=?, fournisseur=?, mode_paiement=?, reference=?, deductible=?, notes=? WHERE id=?
  `).run(date, categorie, libelle, montant_ht, tva || 0, montant_ttc, fournisseur || null, mode_paiement || 'Virement', reference || null, deductible ? 1 : 0, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM charges WHERE id = ?').get(req.params.id));
}));

app.delete('/api/charges/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  db.prepare('DELETE FROM charges WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Ordres de virement TVA ──────────────────────────────────────────────────
app.get('/api/ordres-virement-tva', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM ordres_virement_tva ORDER BY date DESC, id DESC').all());
}));

app.post('/api/ordres-virement-tva', safe((req, res) => {
  const { date, montant, reference, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'La date est obligatoire' });
  const m = parseFloat(montant);
  if (isNaN(m) || m <= 0) return res.status(400).json({ error: 'Le montant est obligatoire et doit etre positif' });
  const r = db.prepare(`
    INSERT INTO ordres_virement_tva (date, montant, reference, notes)
    VALUES (?, ?, ?, ?)
  `).run(date, m, reference || null, notes || null);
  res.json(db.prepare('SELECT * FROM ordres_virement_tva WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/ordres-virement-tva/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { date, montant, reference, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'La date est obligatoire' });
  const m = parseFloat(montant);
  if (isNaN(m) || m <= 0) return res.status(400).json({ error: 'Le montant est obligatoire et doit etre positif' });
  const existing = db.prepare('SELECT id FROM ordres_virement_tva WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ordre de virement non trouve' });
  db.prepare('UPDATE ordres_virement_tva SET date=?, montant=?, reference=?, notes=? WHERE id=?')
    .run(date, m, reference || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM ordres_virement_tva WHERE id = ?').get(req.params.id));
}));

app.delete('/api/ordres-virement-tva/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  db.prepare('DELETE FROM ordres_virement_tva WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/ordres-virement-tva/:id/export', (req, res) => {
  if (!requireValidId(req, res)) return;
  const format = req.query.format === 'docx' ? 'docx' : 'pdf';
  const o = db.prepare('SELECT * FROM ordres_virement_tva WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Ordre de virement non trouve' });

  if (!fs.existsSync(TEMPLATE_OV_TVA)) {
    return res.status(500).json({ error: "Le modele template_ordre_virement_TVA.docx est introuvable sur le serveur." });
  }

  const vars = buildOrdreVirementVarsSrv(o);
  let tmpDir;
  try {
    if (format === 'pdf') {
      const pdfOut = path.join(os.tmpdir(), `ordre_virement_tva_${Date.now()}.pdf`);
      const { tmpDir: td } = runFill(vars, pdfOut, TEMPLATE_OV_TVA, 'ordre_virement_tva.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ordre_virement_tva_${o.id}.pdf"` });
      res.send(fs.readFileSync(pdfOut));
      fs.unlinkSync(pdfOut);
    } else {
      const { tmpDir: td, docxOut } = runFill(vars, null, TEMPLATE_OV_TVA, 'ordre_virement_tva.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="ordre_virement_tva_${o.id}.docx"` });
      res.send(fs.readFileSync(docxOut));
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Ordres de virement ZIZI ──────────────────────────────────────────────────
app.get('/api/ordres-virement-zizi', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM ordres_virement_zizi ORDER BY date DESC, id DESC').all());
}));

app.post('/api/ordres-virement-zizi', safe((req, res) => {
  const { date, nom, rib, banque, montant, reference, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'La date est obligatoire' });
  if (!nom || !String(nom).trim()) return res.status(400).json({ error: 'Le nom du beneficiaire est obligatoire' });
  if (!rib || !String(rib).trim()) return res.status(400).json({ error: 'Le RIB / IBAN du beneficiaire est obligatoire' });
  if (!banque || !String(banque).trim()) return res.status(400).json({ error: 'La banque est obligatoire' });
  const m = parseFloat(montant);
  if (isNaN(m) || m <= 0) return res.status(400).json({ error: 'Le montant est obligatoire et doit etre positif' });
  const r = db.prepare(`
    INSERT INTO ordres_virement_zizi (date, nom, rib, banque, montant, reference, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(date, String(nom).trim(), String(rib).trim(), String(banque).trim(), m, reference || null, notes || null);
  res.json(db.prepare('SELECT * FROM ordres_virement_zizi WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/ordres-virement-zizi/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { date, nom, rib, banque, montant, reference, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'La date est obligatoire' });
  if (!nom || !String(nom).trim()) return res.status(400).json({ error: 'Le nom du beneficiaire est obligatoire' });
  if (!rib || !String(rib).trim()) return res.status(400).json({ error: 'Le RIB / IBAN du beneficiaire est obligatoire' });
  if (!banque || !String(banque).trim()) return res.status(400).json({ error: 'La banque est obligatoire' });
  const m = parseFloat(montant);
  if (isNaN(m) || m <= 0) return res.status(400).json({ error: 'Le montant est obligatoire et doit etre positif' });
  const existing = db.prepare('SELECT id FROM ordres_virement_zizi WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ordre de virement non trouve' });
  db.prepare('UPDATE ordres_virement_zizi SET date=?, nom=?, rib=?, banque=?, montant=?, reference=?, notes=? WHERE id=?')
    .run(date, String(nom).trim(), String(rib).trim(), String(banque).trim(), m, reference || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM ordres_virement_zizi WHERE id = ?').get(req.params.id));
}));

app.delete('/api/ordres-virement-zizi/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  db.prepare('DELETE FROM ordres_virement_zizi WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/ordres-virement-zizi/:id/export', (req, res) => {
  if (!requireValidId(req, res)) return;
  const format = req.query.format === 'docx' ? 'docx' : 'pdf';
  const o = db.prepare('SELECT * FROM ordres_virement_zizi WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Ordre de virement non trouve' });

  if (!fs.existsSync(TEMPLATE_OV_ZIZI)) {
    return res.status(500).json({ error: "Le modele template_Ordre_de_virement_zizi.docx est introuvable sur le serveur." });
  }

  const vars = {
    date: fmtDateSrv(o.date),
    nom: o.nom || '',
    RIB: o.rib || '',
    banque: o.banque || '',
    montant: fmtSrv(o.montant),
    montant_lettres: numToWords(Math.round(o.montant)) + ' dirhams'
  };

  let tmpDir;
  try {
    if (format === 'pdf') {
      const pdfOut = path.join(os.tmpdir(), `ordre_virement_zizi_${Date.now()}.pdf`);
      const { tmpDir: td } = runFill(vars, pdfOut, TEMPLATE_OV_ZIZI, 'ordre_virement_zizi.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ordre_virement_zizi_${o.id}.pdf"` });
      res.send(fs.readFileSync(pdfOut));
      fs.unlinkSync(pdfOut);
    } else {
      const { tmpDir: td, docxOut } = runFill(vars, null, TEMPLATE_OV_ZIZI, 'ordre_virement_zizi.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="ordre_virement_zizi_${o.id}.docx"` });
      res.send(fs.readFileSync(docxOut));
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Comptabilite / Dashboard routes ────────────────────────────────────────────
app.get('/api/comptabilite/dashboard', safe((req, res) => {
  const yearParam = parseYear(req.query.annee);
  const yearFilter = "strftime('%Y', date) = ?";

  const ca = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(tva) as tva, SUM(pt_ttc) as ttc, COUNT(*) as count FROM factures WHERE ${yearFilter}`).get(String(yearParam));
  const charges = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(tva) as tva, SUM(montant_ttc) as ttc, COUNT(*) as count FROM charges WHERE ${yearFilter}`).get(String(yearParam));
  const impayees = db.prepare(`SELECT SUM(pt_ttc) as total, COUNT(*) as count FROM factures WHERE paid = 0 AND ${yearFilter}`).get(String(yearParam));

  const caByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as mois, SUM(montant_ht) as ht, SUM(tva) as tva, SUM(pt_ttc) as ttc
    FROM factures WHERE ${yearFilter}
    GROUP BY mois ORDER BY mois
  `).all(String(yearParam));

  const chargesByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as mois, SUM(montant_ht) as ht, SUM(tva) as tva, SUM(montant_ttc) as ttc
    FROM charges WHERE ${yearFilter}
    GROUP BY mois ORDER BY mois
  `).all(String(yearParam));

  const topClients = db.prepare(`
    SELECT c.name, SUM(f.pt_ttc) as total, COUNT(*) as factures
    FROM factures f JOIN clients c ON f.clientId = c.id
    WHERE strftime('%Y', f.date) = ?
    GROUP BY c.id ORDER BY total DESC LIMIT 5
  `).all(String(yearParam));

  const chargesByCategory = db.prepare(`
    SELECT categorie, SUM(montant_ht) as ht, SUM(tva) as tva, SUM(montant_ttc) as ttc, COUNT(*) as count
    FROM charges WHERE ${yearFilter}
    GROUP BY categorie ORDER BY ttc DESC
  `).all(String(yearParam));

  const ca_ht = ca.ht || 0;
  const ca_ttc = ca.ttc || 0;
  const charges_ht = charges.ht || 0;
  const charges_ttc = charges.ttc || 0;
  const resultat_brut = ca_ht - charges_ht;

  let taux_is = 20;
  if (resultat_brut >= 100000000) taux_is = 35;
  const is_du = Math.max(resultat_brut * (taux_is / 100), 0);

  const cm_base = ca_ttc;
  const cm_du = Math.max(cm_base * 0.0025, 3000);

  let css_du = 0;
  if (resultat_brut >= 1000000) {
    if (resultat_brut <= 5000000) css_du = resultat_brut * 0.015;
    else if (resultat_brut <= 10000000) css_du = resultat_brut * 0.025;
    else if (resultat_brut <= 40000000) css_du = resultat_brut * 0.035;
    else css_du = resultat_brut * 0.05;
  }

  const tva_collectee = ca.tva || 0;
  const tva_deductible = (charges.tva || 0);
  const tva_a_payer = Math.max(tva_collectee - tva_deductible, 0);
  const tva_credit = Math.max(tva_deductible - tva_collectee, 0);

  const patente_estimee = ca_ht * 0.005;

  res.json({
    annee: yearParam,
    chiffre_affaires: { ht: ca_ht, tva: ca.tva || 0, ttc: ca_ttc, count: ca.count || 0 },
    charges: { ht: charges_ht, tva: charges.tva || 0, ttc: charges_ttc, count: charges.count || 0 },
    resultat: {
      brut: resultat_brut,
      net: resultat_brut - is_du - css_du,
      marge: ca_ht > 0 ? ((resultat_brut / ca_ht) * 100).toFixed(2) : 0
    },
    impots: {
      taux_is,
      is_du: Math.round(is_du),
      cm_du: Math.round(cm_du),
      css_du: Math.round(css_du),
      total_impots: Math.round(is_du + cm_du + css_du),
      patente_estimee: Math.round(patente_estimee)
    },
    tva: {
      collectee: tva_collectee,
      deductible: tva_deductible,
      a_payer: tva_a_payer,
      credit: tva_credit
    },
    creances: {
      impayees: impayees.total || 0,
      count_impayees: impayees.count || 0
    },
    caByMonth,
    chargesByMonth,
    topClients,
    chargesByCategory
  });
}));

app.get('/api/comptabilite/tva', safe((req, res) => {
  const yearParam = parseYear(req.query.annee);
  const trimestre = parseTrimestre(req.query.trimestre);

  let dateFilter = "strftime('%Y', date) = ?";
  let dateParams = [String(yearParam)];

  if (trimestre) {
    const months = {
      1: ['01', '02', '03'],
      2: ['04', '05', '06'],
      3: ['07', '08', '09'],
      4: ['10', '11', '12']
    };
    const m = months[trimestre];
    dateFilter = "strftime('%Y-%m', date) IN (?, ?, ?)";
    dateParams = [`${yearParam}-${m[0]}`, `${yearParam}-${m[1]}`, `${yearParam}-${m[2]}`];
  }

  const tvaVentes = db.prepare(`
    SELECT strftime('%Y-%m', date) as periode, SUM(tva) as tva, SUM(montant_ht) as ht, SUM(pt_ttc) as ttc, COUNT(*) as count
    FROM factures WHERE ${dateFilter}
    GROUP BY periode ORDER BY periode
  `).all(...dateParams);

  const tvaAchats = db.prepare(`
    SELECT strftime('%Y-%m', date) as periode, SUM(tva) as tva, SUM(montant_ht) as ht, SUM(montant_ttc) as ttc, COUNT(*) as count
    FROM charges WHERE ${dateFilter}
    GROUP BY periode ORDER BY periode
  `).all(...dateParams);

  const totalVentes = db.prepare(`SELECT SUM(tva) as tva, SUM(montant_ht) as ht FROM factures WHERE ${dateFilter}`).get(...dateParams);
  const totalAchats = db.prepare(`SELECT SUM(tva) as tva, SUM(montant_ht) as ht FROM charges WHERE ${dateFilter}`).get(...dateParams);

  const tvaCollectee = totalVentes.tva || 0;
  const tvaDeductible = totalAchats.tva || 0;
  const tvaAPayer = Math.max(tvaCollectee - tvaDeductible, 0);
  const tvaCredit = Math.max(tvaDeductible - tvaCollectee, 0);

  res.json({
    annee: yearParam,
    trimestre,
    tva_ventes: { ht: totalVentes.ht || 0, tva: tvaCollectee },
    tva_achats: { ht: totalAchats.ht || 0, tva: tvaDeductible },
    tva_a_payer: tvaAPayer,
    tva_credit: tvaCredit,
    detail_ventes: tvaVentes,
    detail_achats: tvaAchats
  });
}));

app.get('/api/comptabilite/impots', safe((req, res) => {
  const yearParam = parseYear(req.query.annee);
  const yearFilter = "strftime('%Y', date) = ?";

  const ca = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(pt_ttc) as ttc FROM factures WHERE ${yearFilter}`).get(String(yearParam));
  const charges = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(montant_ttc) as ttc FROM charges WHERE ${yearFilter}`).get(String(yearParam));

  const ca_ht = ca.ht || 0;
  const charges_ht = charges.ht || 0;
  const resultat_brut = ca_ht - charges_ht;

  let taux_is = 20;
  if (resultat_brut >= 100000000) taux_is = 35;
  const is_calcule = resultat_brut * (taux_is / 100);

  const cm_calculee = Math.max((ca.ttc || 0) * 0.0025, 3000);
  const is_du = Math.max(is_calcule, cm_calculee);

  let css_du = 0;
  let taux_css = 0;
  if (resultat_brut >= 1000000) {
    if (resultat_brut <= 5000000) taux_css = 1.5;
    else if (resultat_brut <= 10000000) taux_css = 2.5;
    else if (resultat_brut <= 40000000) taux_css = 3.5;
    else taux_css = 5;
    css_du = resultat_brut * (taux_css / 100);
  }

  const acompte = is_du / 4;

  res.json({
    annee: yearParam,
    resultat_fiscal: Math.round(resultat_brut),
    chiffre_affaires_ht: Math.round(ca_ht),
    charges_deductibles: Math.round(charges_ht),
    is: {
      taux: taux_is,
      calcule: Math.round(is_calcule),
      cm: Math.round(cm_calculee),
      du: Math.round(is_du),
      acomptes: [
        { echeance: '31/03/' + yearParam, montant: Math.round(acompte) },
        { echeance: '30/06/' + yearParam, montant: Math.round(acompte) },
        { echeance: '30/09/' + yearParam, montant: Math.round(acompte) },
        { echeance: '31/12/' + yearParam, montant: Math.round(acompte) }
      ]
    },
    css: {
      taux: taux_css,
      du: Math.round(css_du)
    },
    charge_fiscale_totale: Math.round(is_du + css_du)
  });
}));

app.get('/api/comptabilite/exercices', safe((req, res) => {
  const exercices = db.prepare('SELECT * FROM exercices_comptables ORDER BY annee DESC').all();
  res.json(exercices);
}));

app.post('/api/comptabilite/exercices/:annee/cloturer', safe((req, res) => {
  const annee = parseYear(req.params.annee);
  const yearFilter = "strftime('%Y', date) = ?";

  const ca = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(pt_ttc) as ttc FROM factures WHERE ${yearFilter}`).get(String(annee));
  const charges = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(montant_ttc) as ttc FROM charges WHERE ${yearFilter}`).get(String(annee));

  const ca_ht = ca.ht || 0;
  const charges_ht = charges.ht || 0;
  const resultat_brut = ca_ht - charges_ht;

  let taux_is = 20;
  if (resultat_brut >= 100000000) taux_is = 35;
  const is_calcule = resultat_brut * (taux_is / 100);
  const cm_calculee = Math.max((ca.ttc || 0) * 0.0025, 3000);
  const is_du = Math.max(is_calcule, cm_calculee);

  let css_du = 0;
  if (resultat_brut >= 1000000) {
    if (resultat_brut <= 5000000) css_du = resultat_brut * 0.015;
    else if (resultat_brut <= 10000000) css_du = resultat_brut * 0.025;
    else if (resultat_brut <= 40000000) css_du = resultat_brut * 0.035;
    else css_du = resultat_brut * 0.05;
  }

  const tvaCollectee = db.prepare(`SELECT SUM(tva) as tva FROM factures WHERE ${yearFilter}`).get(String(annee)).tva || 0;
  const tvaDeductible = db.prepare(`SELECT SUM(tva) as tva FROM charges WHERE ${yearFilter}`).get(String(annee)).tva || 0;

  const patente = ca_ht * 0.005;

  const existing = db.prepare('SELECT id FROM exercices_comptables WHERE annee = ?').get(annee);

  if (existing) {
    db.prepare(`
      UPDATE exercices_comptables SET 
        statut = 'Cloture',
        ca_total = ?, charges_totales = ?, resultat_net = ?, 
        is_du = ?, cm_du = ?, css_du = ?,
        tva_collectee = ?, tva_deductible = ?, tva_a_payer = ?,
        patente_du = ?, updated_at = CURRENT_TIMESTAMP
      WHERE annee = ?
    `).run(ca_ht, charges_ht, resultat_brut - is_du - css_du, is_du, cm_calculee, css_du, tvaCollectee, tvaDeductible, Math.max(tvaCollectee - tvaDeductible, 0), patente, annee);
  } else {
    db.prepare(`
      INSERT INTO exercices_comptables (annee, date_debut, date_fin, statut, ca_total, charges_totales, resultat_net, is_du, cm_du, css_du, tva_collectee, tva_deductible, tva_a_payer, patente_du)
      VALUES (?, ?, ?, 'Cloture', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(annee, `${annee}-01-01`, `${annee}-12-31`, ca_ht, charges_ht, resultat_brut - is_du - css_du, is_du, cm_calculee, css_du, tvaCollectee, tvaDeductible, Math.max(tvaCollectee - tvaDeductible, 0), patente);
  }

  res.json({ ok: true, message: `Exercice ${annee} cloture` });
}));

// ── PDF / DOCX export (single invoice) ───────────────────────────────────────
const TEMPLATE = path.join(__dirname, 'template_Tradivia_ajust.docx');
const FILL_SCRIPT = path.join(__dirname, 'fill_template.py');
const TEMPLATE_OV_TVA = path.join(__dirname, 'template_ordre_virement_TVA.docx');
const TEMPLATE_OV_ZIZI = path.join(__dirname, 'template_Ordre_de_virement_zizi.docx');

function getPython() {
  if (process.platform === 'win32') {
    try { execSync('python3 --version', { stdio: 'ignore' }); return 'python3'; } catch {}
    return 'python';
  }
  return 'python3';
}

function runFill(vars, pdfPath = null, template = TEMPLATE, outName = 'facture.docx') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tradivia-'));
  const docxOut = path.join(tmpDir, outName);
  const jsonPath = path.join(tmpDir, 'vars.json');
  fs.writeFileSync(jsonPath, JSON.stringify(vars), 'utf8');
  const args = [FILL_SCRIPT, template, docxOut, jsonPath];
  if (pdfPath) args.push('--pdf', pdfPath);
  execFileSync(getPython(), args, { timeout: 30000 });
  return { tmpDir, docxOut };
}

// Formats the two placeholders used by template_ordre_virement_TVA.docx:
// {{ date }} and {{ montant }}.
function buildOrdreVirementVarsSrv(o) {
  return {
    date: fmtDateSrv(o.date),
    montant: fmtSrv(o.montant)
  };
}

app.post('/api/invoice', (req, res) => {
  let tmpDir;
  try {
    const pdfOut = path.join(os.tmpdir(), `facture_${Date.now()}.pdf`);
    const { tmpDir: td } = runFill(req.body, pdfOut);
    tmpDir = td;
    const num = (req.body.numero || 'export').replace(/\//g, '_');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="facture_${num}.pdf"` });
    res.send(fs.readFileSync(pdfOut));
    fs.unlinkSync(pdfOut);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

app.post('/api/invoice/docx', (req, res) => {
  let tmpDir;
  try {
    const { tmpDir: td, docxOut } = runFill(req.body);
    tmpDir = td;
    const num = (req.body.numero || 'export').replace(/\//g, '_');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="facture_${num}.docx"` });
    res.send(fs.readFileSync(docxOut));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

app.use('/uploads', express.static(UPLOAD_DIR));

// ── PDF / DOCX export (grouped invoices, merged into one file) ──────────────
function runMergeFill(varsList, pdfPath = null) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tradivia-merge-'));
  const docxOut = path.join(tmpDir, 'factures_groupees.docx');
  const jsonPath = path.join(tmpDir, 'vars_list.json');

  fs.writeFileSync(jsonPath, JSON.stringify(varsList), 'utf8');

  const args = [
    path.join(__dirname, 'merge_invoices.py'),
    TEMPLATE,
    jsonPath,
    docxOut,
    '--fill-script', FILL_SCRIPT
  ];

  if (pdfPath) {
    args.push('--pdf', pdfPath);
  }

  execFileSync(getPython(), args, { timeout: 120000 });

  return { tmpDir, docxOut };
}

app.post('/api/factures/export-group', safe((req, res) => {
  const { ids, format } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Aucune facture selectionnee' });

  const placeholders = ids.map(() => '?').join(',');
  const factures = db.prepare(`SELECT * FROM factures WHERE id IN (${placeholders})`).all(...ids);
  if (factures.length === 0) return res.status(404).json({ error: 'Factures non trouvees' });

  const varsList = factures.map(f => {
    const client = f.clientId ? db.prepare('SELECT * FROM clients WHERE id = ?').get(f.clientId) : null;
    return buildInvoiceVarsSrv(f, client);
  });

  let tmpDir;
  try {
    if (format === 'pdf') {
      const pdfOut = path.join(os.tmpdir(), `factures_groupees_${Date.now()}.pdf`);
      const { tmpDir: td } = runMergeFill(varsList, pdfOut);
      tmpDir = td;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="factures_groupees.pdf"' });
      res.send(fs.readFileSync(pdfOut));
    } else {
      const { tmpDir: td, docxOut } = runMergeFill(varsList);
      tmpDir = td;
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="factures_groupees.docx"' });
      res.send(fs.readFileSync(docxOut));
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}));

// ── Global fallback handlers ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvee' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur inattendue' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Tradivia API → http://localhost:${PORT}`));
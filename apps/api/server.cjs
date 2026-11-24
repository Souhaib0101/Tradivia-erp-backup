const express = require('express');
const cors = require('cors');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');
const multer = require('multer');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });


// auth
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-env-var';
const JWT_EXPIRES_IN = '8h';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET doit etre defini avec au moins 32 caracteres en production.');
}




const app = express();
const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean);
app.disable('x-powered-by');
app.use(cors({ origin(origin, callback) {
  if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
  return callback(Object.assign(new Error('Origine CORS non autorisee'), { status: 403 }));
} }));
app.use(express.json({ limit: '1mb' }));

// ── Upload directories ─────────────────────────────────────────────────────────
const configuredUploadPath = process.env.UPLOAD_DIR || './uploads';
const UPLOAD_DIR = path.isAbsolute(configuredUploadPath)
  ? configuredUploadPath
  : path.resolve(__dirname, configuredUploadPath);
const CONTAINER_DOCS_DIR = path.join(UPLOAD_DIR, 'containers');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CONTAINER_DOCS_DIR)) fs.mkdirSync(CONTAINER_DOCS_DIR, { recursive: true });

// ── Small helpers ──────────────────────────────────────────────────────────────

function isValidId(id) {
  return /^[1-9]\d*$/.test(String(id));
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
          handleRouteError(err, res);
        });
      }
    } catch (err) {
      handleRouteError(err, res);
    }
  };
}

function parseYear(input) {
  const y = parseInt(input, 10);
  if (input === undefined || input === null || input === '') return new Date().getFullYear();
  if (!/^\d{4}$/.test(String(input)) || isNaN(y) || y < 2000 || y > 2100) return null;
  return y;
}

function parseTrimestre(input) {
  const t = parseInt(input, 10);
  return [1, 2, 3, 4].includes(t) ? t : null;
}

function requireYear(req, res) {
  const year = parseYear(req.query.annee ?? req.params.annee);
  if (year === null) {
    res.status(400).json({ error: 'Annee invalide (2000-2100)' });
    return null;
  }
  return year;
}

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Facture amount computation ──────────────────────────────────────────────
function computeFactureAmounts(calc_type, input) {
  if (calc_type === 'total') {
    const total_ttc = numberInRange(input.total_ttc_saisi, 'Le total TTC', 0, false);
    const pu_ttc = numberInRange(input.pu_ttc, 'Le prix unitaire TTC', 0, false);

    const tva = round2(total_ttc / 6);
    const montant_ht = round2(total_ttc - tva);
    const qte_kg = Math.floor(total_ttc / pu_ttc);
    const pt_ttc = round2(qte_kg * pu_ttc);
    const ajustement_arrondi = round2(total_ttc - pt_ttc);

    return { qte_kg, pu_ttc, pt_ttc, montant_ht, tva, ajustement_arrondi, total_ttc_saisi: total_ttc };
  }

  // calc_type === 'qte' (par defaut)
  const qte_kg = numberInRange(input.qte_kg, 'La quantite (kg)', 0, false);
  const pu_ttc = numberInRange(input.pu_ttc, 'Le prix unitaire TTC', 0, false);

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

function numToWords(value) {
  const small = ['zero', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const regularTens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
  const underHundred = number => {
    if (number < 20) return small[number];
    if (number < 70) {
      const ten = Math.floor(number / 10);
      const unit = number % 10;
      return regularTens[ten] + (unit === 1 ? ' et un' : unit ? `-${small[unit]}` : '');
    }
    if (number < 80) return `soixante${number === 71 ? ' et ' : '-'}${underHundred(number - 60)}`;
    const remainder = number - 80;
    return `quatre-vingt${remainder === 0 ? 's' : `-${underHundred(remainder)}`}`;
  };
  const underThousand = number => {
    if (number < 100) return underHundred(number);
    const hundreds = Math.floor(number / 100);
    const remainder = number % 100;
    const prefix = hundreds === 1 ? 'cent' : `${small[hundreds]} cent`;
    return prefix + (remainder === 0 ? (hundreds > 1 ? 's' : '') : ` ${underHundred(remainder)}`);
  };

  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 'zero';
  if (parsed === 0) return small[0];
  if (parsed < 0) return `moins ${numToWords(Math.abs(parsed))}`;

  let remaining = parsed;
  const parts = [];
  const scales = [[1_000_000_000, 'milliard'], [1_000_000, 'million'], [1_000, 'mille']];
  for (const [scale, label] of scales) {
    const count = Math.floor(remaining / scale);
    if (!count) continue;
    if (scale === 1_000 && count === 1) parts.push('mille');
    else parts.push(`${underThousand(count)} ${label}${count > 1 && scale !== 1_000 ? 's' : ''}`);
    remaining %= scale;
  }
  if (remaining) parts.push(underThousand(remaining));
  return parts.join(' ');
}

function moneyToWords(value) {
  const rounded = round2(Number(value));
  if (!Number.isFinite(rounded)) return 'zero dirham';
  const negative = rounded < 0;
  const absoluteCentimes = Math.round(Math.abs(rounded) * 100);
  const dirhams = Math.floor(absoluteCentimes / 100);
  const centimes = absoluteCentimes % 100;
  const parts = [`${numToWords(dirhams)} dirham${dirhams === 1 ? '' : 's'}`];
  if (centimes) parts.push(`${numToWords(centimes)} centime${centimes === 1 ? '' : 's'}`);
  return `${negative ? 'moins ' : ''}${parts.join(' et ')}`;
}

function buildInvoiceVarsSrv(f, client) {
  const isPhysique = f.client_type === 'physique';
  const totalTTC = (f.pt_ttc || 0) + (f.ajustement_arrondi || 0);
  const clientName = isPhysique ? (f.client_nom_manuel || client?.name || '-') : (client?.name || '-');
  const clientIce = isPhysique ? (f.client_cin_manuel || client?.cin || '-') : (client?.ice || '-');
  const clientAddress = isPhysique ? (f.client_adresse_manuel || client?.address || '-') : (client?.address || '-');
  return {
    client_nom: clientName,
    client_identity: isPhysique ? `CIN : ${clientIce}` : `ICE : ${clientIce}`,
    client_adresse: clientAddress,
    // Compatibility with template_tradivia.docx, kept as a deliberate fallback.
    client: { name: clientName, ice: clientIce, address: clientAddress },
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
    pt_ttc_letters: moneyToWords(totalTTC),
    mode_paiement: f.mode_paiement || '-',
    ajustement_arrondi: fmtSrv(f.ajustement_arrondi || 0)
  };
}

// ── Database setup ────────────────────────────────────────────────────────────
const configuredDatabasePath = process.env.DATABASE_PATH || './tradivia.db';
const databasePath = path.isAbsolute(configuredDatabasePath)
  ? configuredDatabasePath
  : path.resolve(__dirname, configuredDatabasePath);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    client_type TEXT DEFAULT 'societe',
    ice TEXT,
    cin TEXT,
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
    poids_commande REAL,
    poids_recu REAL,
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
ensureColumn('clients', 'client_type', "TEXT DEFAULT 'societe'");
ensureColumn('clients', 'cin', 'TEXT');
ensureColumn('containers', 'poids_commande', 'REAL');
ensureColumn('containers', 'poids_recu', 'REAL');
ensureColumn('ordres_virement_zizi', 'nom', 'TEXT');
ensureColumn('ordres_virement_zizi', 'rib', 'TEXT');
ensureColumn('exercices_comptables', 'updated_at', 'TEXT');

db.prepare("UPDATE clients SET client_type = 'societe' WHERE client_type IS NULL OR client_type NOT IN ('societe', 'physique')").run();

// Import every legacy manually-entered physical person into the client registry,
// grouping invoices by CIN and linking them to the resulting reusable record.
const migratePhysicalClients = db.transaction(() => {
  const legacyPeople = db.prepare(`
    SELECT client_cin_manuel AS cin,
           MIN(client_nom_manuel) AS name,
           MAX(client_adresse_manuel) AS address
    FROM factures
    WHERE client_type = 'physique'
      AND client_cin_manuel IS NOT NULL AND TRIM(client_cin_manuel) <> ''
    GROUP BY UPPER(TRIM(client_cin_manuel))
  `).all();
  const findPerson = db.prepare("SELECT id FROM clients WHERE client_type = 'physique' AND UPPER(TRIM(cin)) = UPPER(TRIM(?))");
  const insertPerson = db.prepare("INSERT INTO clients (name, client_type, ice, cin, address) VALUES (?, 'physique', NULL, ?, ?)");
  const linkInvoices = db.prepare(`
    UPDATE factures SET clientId = ?
    WHERE client_type = 'physique' AND clientId IS NULL
      AND UPPER(TRIM(client_cin_manuel)) = UPPER(TRIM(?))
  `);
  for (const person of legacyPeople) {
    let registered = findPerson.get(person.cin);
    if (!registered) {
      registered = { id: insertPerson.run(person.name || 'Personne physique', person.cin, person.address || null).lastInsertRowid };
    }
    linkInvoices.run(registered.id, person.cin);
  }
});
migratePhysicalClients();
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cin_physique ON clients(UPPER(TRIM(cin))) WHERE client_type = 'physique' AND cin IS NOT NULL AND TRIM(cin) <> ''");

// Demo records are opt-in. Production/business databases must start empty.
const count = db.prepare('SELECT COUNT(*) as c FROM clients').get();
if (process.env.SEED_DEMO_DATA === 'true' && count.c === 0) {
  const insert = db.prepare('INSERT INTO clients (name, ice, address, phone, email) VALUES (?, ?, ?, ?, ?)');
  insert.run('Grande Surface Atlas', '002345678901234', 'Bd Zerktouni, Casablanca', '+212 6 61 00 00 00', 'achats@atlas.ma');
  insert.run('Cafe Central',         '003456789012345', 'Rue de Fes, Rabat',        '+212 6 62 00 00 00', 'cafe.central@mail.ma');
  insert.run('Hotel Mogador',        '',                'Av Hassan II, Essaouira',  '+212 5 24 00 00 00', 'achats@mogador.com');
}

// Seed sample charges if empty
const chargeCount = db.prepare('SELECT COUNT(*) as c FROM charges').get();
if (process.env.SEED_DEMO_DATA === 'true' && chargeCount.c === 0) {
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
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_DEFAULT_PASSWORD) {
    throw new Error('ADMIN_DEFAULT_PASSWORD doit etre defini lors du premier demarrage en production.');
  }
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
  const hash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('⚠️  Utilisateur admin cree avec mot de passe temporaire — changez-le immediatement.');
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, pwd: user.password_hash.slice(-12) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, active, password_hash FROM users WHERE id = ?').get(payload.id);
    if (!user || !user.active || payload.pwd !== user.password_hash.slice(-12)) return res.status(401).json({ error: 'Session invalide' });
    const { password_hash, ...safeUser } = user;
    req.user = safeUser;
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
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !user.active) return res.status(401).json({ error: 'Identifiants incorrects' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
}));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'tradivia-api' }));

// From here on, every /api/* route requires a valid JWT.
app.use('/api', requireAuth);

const defaultCompany = { name: 'TRADIVIA', ice: '003748656000065', rc: '681839', cnss: '6201633', patente: '34108310', if_number: '66999694', address: 'Ste Tradivia au 26, Rue Mers Sultan, Appartement 3, 1er Etage, 20370 Anfa - Anfa (AR)', phone: '+212 5 21 24 81 48', email: 'tradiviasarl@gmail.com' };
db.exec('CREATE TABLE IF NOT EXISTS company_settings (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');
db.prepare('INSERT OR IGNORE INTO company_settings (id, data) VALUES (1, ?)').run(JSON.stringify(defaultCompany));

app.get('/api/company', safe((req, res) => {
  res.json(JSON.parse(db.prepare('SELECT data FROM company_settings WHERE id = 1').get().data));
}));

app.put('/api/company', requireRole('admin'), safe((req, res) => {
  const company = {};
  for (const field of Object.keys(defaultCompany)) {
    const value = req.body?.[field];
    if (typeof value !== 'string' || value.length > (field === 'address' ? 1000 : 255)) {
      return res.status(400).json({ error: `Champ invalide : ${field}` });
    }
    company[field] = value.trim();
  }
  if (!company.name) return res.status(400).json({ error: 'Le nom de la societe est requis' });
  if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }
  if (company.ice && !/^\d{15}$/.test(company.ice)) {
    return res.status(400).json({ error: 'ICE : 15 chiffres requis' });
  }
  db.prepare('UPDATE company_settings SET data = ? WHERE id = 1').run(JSON.stringify(company));
  res.json(company);
}));

app.get('/api/auth/me', safe((req, res) => {
  res.json({ user: req.user });
}));

app.post('/api/auth/change-password', safe((req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  }
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
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(String(username))) return res.status(400).json({ error: 'Identifiant invalide (3-64 caracteres)' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });

  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(String(username).trim(), hash, role === 'admin' ? 'admin' : 'user');
  res.json(db.prepare('SELECT id, username, role, active FROM users WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/users/:id/deactivate', requireRole('admin'), safe((req, res) => {
  if (!requireValidId(req, res)) return;
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas desactiver votre propre compte' });
  const target = db.prepare('SELECT id, role, active FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur non trouve' });
  if (target.role === 'admin' && target.active) {
    const activeAdmins = db.prepare("SELECT COUNT(*) count FROM users WHERE role = 'admin' AND active = 1").get().count;
    if (activeAdmins <= 1) return res.status(409).json({ error: 'Le dernier administrateur actif ne peut pas etre desactive' });
  }
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Automatic anomaly detection ──────────────────────────────────────────────
app.get('/api/anomalies', safe((req, res) => {
  res.json(buildAnomalyReport({
    factures: db.prepare('SELECT * FROM factures ORDER BY date DESC, id DESC').all(),
    clients: db.prepare('SELECT * FROM clients ORDER BY name').all(),
    containers: db.prepare('SELECT * FROM containers ORDER BY date_depart DESC, id DESC').all(),
    charges: db.prepare('SELECT * FROM charges ORDER BY date DESC, id DESC').all(),
    ordres: db.prepare('SELECT * FROM ordres_virement_zizi ORDER BY date DESC, id DESC').all()
  }));
}));

// ── Client routes ─────────────────────────────────────────────────────────────
app.get('/api/clients', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM clients ORDER BY name').all());
}));

app.post('/api/clients', safe((req, res) => {
  const { name, client_type, ice, cin, address, phone, email } = req.body;
  const nameValue = String(name || '').trim();
  const type = client_type === 'physique' ? 'physique' : 'societe';
  const iceValue = type === 'societe' ? String(ice || '').trim() || null : null;
  const cinValue = type === 'physique' ? String(cin || '').trim() : null;
  if (!nameValue) return res.status(400).json({ error: 'Le nom du client est obligatoire' });
  const r = db.prepare('INSERT INTO clients (name, client_type, ice, cin, address, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(nameValue, type, iceValue, cinValue || null, address || null, phone || null, email || null);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/clients/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { name, client_type, ice, cin, address, phone, email } = req.body;
  const nameValue = String(name || '').trim();
  const type = client_type === 'physique' ? 'physique' : 'societe';
  const iceValue = type === 'societe' ? String(ice || '').trim() || null : null;
  const cinValue = type === 'physique' ? String(cin || '').trim() : null;
  if (!nameValue) return res.status(400).json({ error: 'Le nom du client est obligatoire' });
  const existing = db.prepare('SELECT id, client_type FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client non trouve' });
  if (existing.client_type !== type) {
    const invoiceCount = db.prepare('SELECT COUNT(*) count FROM factures WHERE clientId = ?').get(req.params.id).count;
    if (invoiceCount) return res.status(409).json({ error: 'Le type de ce client ne peut pas changer car il est utilise par des factures' });
  }
  db.prepare('UPDATE clients SET name=?, client_type=?, ice=?, cin=?, address=?, phone=?, email=? WHERE id=?')
    .run(nameValue, type, iceValue, cinValue || null, address || null, phone || null, email || null, req.params.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
}));

app.delete('/api/clients/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client non trouve' });
  const invoiceCount = db.prepare('SELECT COUNT(*) count FROM factures WHERE clientId = ?').get(req.params.id).count;
  if (invoiceCount) return res.status(409).json({ error: 'Ce client est utilise par des factures et ne peut pas etre supprime' });
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Facture routes ────────────────────────────────────────────────────────────
app.get('/api/factures', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM factures ORDER BY date DESC').all());
}));

app.post('/api/factures', safe((req, res) => {
  const {
    clientId, client_type,
    numero, lieu, date, designation,
    calc_type, qte_kg, pu_ttc, total_ttc_saisi,
    mode_paiement
  } = req.body;

  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de facture est obligatoire' });
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date de facture est invalide (AAAA-MM-JJ)' });
  if (!designation || !String(designation).trim()) return res.status(400).json({ error: 'La designation est obligatoire' });

  const type = client_type === 'physique' ? 'physique' : 'societe';

  if (!clientId) return res.status(400).json({ error: type === 'physique' ? 'La personne physique est obligatoire' : 'Le client est obligatoire' });
  const selectedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!selectedClient || selectedClient.client_type !== type) return res.status(400).json({ error: 'Client invalide pour le type de facture selectionne' });

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
    clientId,
    type,
    type === 'physique' ? selectedClient.name : null,
    type === 'physique' ? selectedClient.cin : null,
    type === 'physique' ? (selectedClient.address || null) : null,
    numero, lieu || null, date || null,
    amounts.qte_kg, designation || null, amounts.pu_ttc, amounts.pt_ttc, amounts.montant_ht, amounts.tva,
    mode, amounts.total_ttc_saisi, mode_paiement || null, amounts.ajustement_arrondi
  );
  res.json(db.prepare('SELECT * FROM factures WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/factures/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const {
    clientId, client_type,
    numero, lieu, date, designation,
    calc_type, qte_kg, pu_ttc, total_ttc_saisi,
    mode_paiement, paid
  } = req.body;

  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de facture est obligatoire' });
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date de facture est invalide (AAAA-MM-JJ)' });
  if (!designation || !String(designation).trim()) return res.status(400).json({ error: 'La designation est obligatoire' });
  const existing = db.prepare('SELECT id FROM factures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Facture non trouvee' });

  const type = client_type === 'physique' ? 'physique' : 'societe';

  if (!clientId) return res.status(400).json({ error: type === 'physique' ? 'La personne physique est obligatoire' : 'Le client est obligatoire' });
  const selectedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!selectedClient || selectedClient.client_type !== type) return res.status(400).json({ error: 'Client invalide pour le type de facture selectionne' });

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
    clientId,
    type,
    type === 'physique' ? selectedClient.name : null,
    type === 'physique' ? selectedClient.cin : null,
    type === 'physique' ? (selectedClient.address || null) : null,
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
  const result = db.prepare('DELETE FROM factures WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Facture non trouvee' });
  res.json({ ok: true });
}));

// ── Bulk delete factures (used by the "Supprimer selection" button) ─────────
app.delete('/api/factures', safe((req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Aucune facture selectionnee' });
  }
  const validIds = [...new Set(ids.map(String).filter(isValidId).map(Number))];
  if (validIds.length !== ids.length) return res.status(400).json({ error: 'Liste d’identifiants invalide' });
  const placeholders = validIds.map(() => '?').join(',');
  const existing = db.prepare(`SELECT COUNT(*) count FROM factures WHERE id IN (${placeholders})`).get(...validIds).count;
  if (existing !== validIds.length) return res.status(404).json({ error: 'Une ou plusieurs factures sont introuvables' });
  const result = db.prepare(`DELETE FROM factures WHERE id IN (${placeholders})`).run(...validIds);
  res.json({ ok: true, deleted: result.changes });
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
  const { numero, type, scelle, statut, fournisseur, port_depart, port_arrivee, date_depart, date_arrivee, nb_sacs, poids_total, poids_commande, poids_recu, bl, facture_commerciale } = req.body;
  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de conteneur est obligatoire' });
  const sacs = nb_sacs === undefined || nb_sacs === null || nb_sacs === '' ? 0 : numberInRange(nb_sacs, 'Le nombre de sacs');
  if (!Number.isInteger(sacs)) return res.status(400).json({ error: 'Le nombre de sacs doit etre un entier' });
  const poids = poids_total === undefined || poids_total === null || poids_total === '' ? 0 : numberInRange(poids_total, 'Le poids total');
  const poidsCommande = poids_commande === undefined || poids_commande === null || poids_commande === '' ? null : numberInRange(poids_commande, 'Le poids commande');
  const poidsRecu = poids_recu === undefined || poids_recu === null || poids_recu === '' ? null : numberInRange(poids_recu, 'Le poids recu');
  if (date_depart && !isIsoDate(date_depart)) return res.status(400).json({ error: 'La date de depart est invalide' });
  if (date_arrivee && !isIsoDate(date_arrivee)) return res.status(400).json({ error: 'La date d’arrivee est invalide' });
  if (date_depart && date_arrivee && date_arrivee < date_depart) return res.status(400).json({ error: 'La date d’arrivee ne peut pas preceder la date de depart' });
  const r = db.prepare(`
    INSERT INTO containers (numero, type, scelle, statut, fournisseur, port_depart, port_arrivee, date_depart, date_arrivee, nb_sacs, poids_total, poids_commande, poids_recu, bl, facture_commerciale, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(numero, type || null, scelle || null, statut || 'En transit', fournisseur || null, port_depart || null, port_arrivee || null, date_depart || null, date_arrivee || null, sacs, poids, poidsCommande, poidsRecu, bl || null, facture_commerciale || null);
  const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(r.lastInsertRowid);
  container.documents = [];
  res.json(container);
}));

app.put('/api/containers/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { numero, type, scelle, statut, fournisseur, port_depart, port_arrivee, date_depart, date_arrivee, nb_sacs, poids_total, poids_commande, poids_recu, bl, facture_commerciale } = req.body;
  if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Le numero de conteneur est obligatoire' });
  const sacs = nb_sacs === undefined || nb_sacs === null || nb_sacs === '' ? 0 : numberInRange(nb_sacs, 'Le nombre de sacs');
  if (!Number.isInteger(sacs)) return res.status(400).json({ error: 'Le nombre de sacs doit etre un entier' });
  const poids = poids_total === undefined || poids_total === null || poids_total === '' ? 0 : numberInRange(poids_total, 'Le poids total');
  const poidsCommande = poids_commande === undefined || poids_commande === null || poids_commande === '' ? null : numberInRange(poids_commande, 'Le poids commande');
  const poidsRecu = poids_recu === undefined || poids_recu === null || poids_recu === '' ? null : numberInRange(poids_recu, 'Le poids recu');
  if (date_depart && !isIsoDate(date_depart)) return res.status(400).json({ error: 'La date de depart est invalide' });
  if (date_arrivee && !isIsoDate(date_arrivee)) return res.status(400).json({ error: 'La date d’arrivee est invalide' });
  if (date_depart && date_arrivee && date_arrivee < date_depart) return res.status(400).json({ error: 'La date d’arrivee ne peut pas preceder la date de depart' });
  const existing = db.prepare('SELECT id FROM containers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Conteneur non trouve' });
  db.prepare(`
    UPDATE containers SET numero=?, type=?, scelle=?, statut=?, fournisseur=?, port_depart=?, port_arrivee=?, date_depart=?, date_arrivee=?, nb_sacs=?, poids_total=?, poids_commande=?, poids_recu=?, bl=?, facture_commerciale=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(numero, type || null, scelle || null, statut || 'En transit', fournisseur || null, port_depart || null, port_arrivee || null, date_depart || null, date_arrivee || null, sacs, poids, poidsCommande, poidsRecu, bl || null, facture_commerciale || null, req.params.id);
  const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
  container.documents = getContainerDocs(req.params.id);
  res.json(container);
}));

app.delete('/api/containers/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const container = db.prepare('SELECT id FROM containers WHERE id = ?').get(req.params.id);
  if (!container) return res.status(404).json({ error: 'Conteneur non trouve' });
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
  const container = db.prepare('SELECT id FROM containers WHERE id = ?').get(req.params.id);
  if (!container) return res.status(404).json({ error: 'Conteneur non trouve' });
  next();
}, (req, res) => {
  upload.array('documents', 10)(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (max 50MB)' : (err.message || 'Erreur televersement');
      return res.status(400).json({ error: message });
    }
    try {
      const containerId = req.params.id;
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
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date est invalide (AAAA-MM-JJ)' });
  if (!categorie) return res.status(400).json({ error: 'La categorie est obligatoire' });
  if (!libelle || !String(libelle).trim()) return res.status(400).json({ error: 'Le libelle est obligatoire' });
  if (montant_ht === undefined || montant_ht === null || montant_ht === '') return res.status(400).json({ error: 'Le montant HT est obligatoire' });
  const ht = numberInRange(montant_ht, 'Le montant HT');
  const tvaVal = tva === undefined || tva === null || tva === '' ? 0 : numberInRange(tva, 'La TVA');
  const ttc = montant_ttc !== undefined && montant_ttc !== null && montant_ttc !== '' ? numberInRange(montant_ttc, 'Le montant TTC') : round2(ht + tvaVal);
  if (Math.abs(ttc - round2(ht + tvaVal)) > 0.01) return res.status(400).json({ error: 'Le montant TTC doit etre egal au montant HT plus la TVA' });
  const r = db.prepare(`
    INSERT INTO charges (date, categorie, libelle, montant_ht, tva, montant_ttc, fournisseur, mode_paiement, reference, deductible, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, categorie, libelle, ht, tvaVal, ttc, fournisseur || null, mode_paiement || 'Virement', reference || null, deductible ? 1 : 0, notes || null);
  res.json(db.prepare('SELECT * FROM charges WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/charges/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { date, categorie, libelle, montant_ht, tva, montant_ttc, fournisseur, mode_paiement, reference, deductible, notes } = req.body;
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date est invalide (AAAA-MM-JJ)' });
  if (!categorie || !String(categorie).trim()) return res.status(400).json({ error: 'La categorie est obligatoire' });
  if (!libelle || !String(libelle).trim()) return res.status(400).json({ error: 'Le libelle est obligatoire' });
  const ht = numberInRange(montant_ht, 'Le montant HT');
  const tvaVal = tva === undefined || tva === null || tva === '' ? 0 : numberInRange(tva, 'La TVA');
  const ttc = montant_ttc !== undefined && montant_ttc !== null && montant_ttc !== '' ? numberInRange(montant_ttc, 'Le montant TTC') : round2(ht + tvaVal);
  if (Math.abs(ttc - round2(ht + tvaVal)) > 0.01) return res.status(400).json({ error: 'Le montant TTC doit etre egal au montant HT plus la TVA' });
  const existing = db.prepare('SELECT id FROM charges WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Charge non trouvee' });
  db.prepare(`
    UPDATE charges SET date=?, categorie=?, libelle=?, montant_ht=?, tva=?, montant_ttc=?, fournisseur=?, mode_paiement=?, reference=?, deductible=?, notes=? WHERE id=?
  `).run(date, categorie, libelle, ht, tvaVal, ttc, fournisseur || null, mode_paiement || 'Virement', reference || null, deductible ? 1 : 0, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM charges WHERE id = ?').get(req.params.id));
}));

app.delete('/api/charges/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const result = db.prepare('DELETE FROM charges WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Charge non trouvee' });
  res.json({ ok: true });
}));

// ── Ordres de virement TVA ──────────────────────────────────────────────────
app.get('/api/ordres-virement-tva', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM ordres_virement_tva ORDER BY date DESC, id DESC').all());
}));

app.post('/api/ordres-virement-tva', safe((req, res) => {
  const { date, montant, reference, notes } = req.body;
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date est invalide (AAAA-MM-JJ)' });
  const m = numberInRange(montant, 'Le montant', 0, false);
  const r = db.prepare(`
    INSERT INTO ordres_virement_tva (date, montant, reference, notes)
    VALUES (?, ?, ?, ?)
  `).run(date, m, reference || null, notes || null);
  res.json(db.prepare('SELECT * FROM ordres_virement_tva WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/ordres-virement-tva/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { date, montant, reference, notes } = req.body;
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date est invalide (AAAA-MM-JJ)' });
  const m = numberInRange(montant, 'Le montant', 0, false);
  const existing = db.prepare('SELECT id FROM ordres_virement_tva WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ordre de virement non trouve' });
  db.prepare('UPDATE ordres_virement_tva SET date=?, montant=?, reference=?, notes=? WHERE id=?')
    .run(date, m, reference || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM ordres_virement_tva WHERE id = ?').get(req.params.id));
}));

app.delete('/api/ordres-virement-tva/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const result = db.prepare('DELETE FROM ordres_virement_tva WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Ordre de virement non trouve' });
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
      const { tmpDir: td, pdfOut } = runFill(vars, true, TEMPLATE_OV_TVA, 'ordre_virement_tva.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ordre_virement_tva_${o.id}.pdf"` });
      res.send(fs.readFileSync(pdfOut));
    } else {
      const { tmpDir: td, docxOut } = runFill(vars, false, TEMPLATE_OV_TVA, 'ordre_virement_tva.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="ordre_virement_tva_${o.id}.docx"` });
      res.send(fs.readFileSync(docxOut));
    }
  } catch (err) {
    sendDocumentError(err, res);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Ordres de virement bénéficiaire ──────────────────────────────────────────
app.get('/api/ordres-virement-zizi', safe((req, res) => {
  res.json(db.prepare('SELECT * FROM ordres_virement_zizi ORDER BY date DESC, id DESC').all());
}));

app.post('/api/ordres-virement-zizi', safe((req, res) => {
  const { date, montant, nom, rib, reference, notes } = req.body;
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date est invalide (AAAA-MM-JJ)' });
  const nomValue = String(nom || '').trim();
  const ribValue = String(rib || '').trim();
  if (!nomValue) return res.status(400).json({ error: 'Le nom du beneficiaire est obligatoire' });
  if (!ribValue) return res.status(400).json({ error: 'Le RIB / IBAN du beneficiaire est obligatoire' });
  if (nomValue.length > 200 || ribValue.length > 100) return res.status(400).json({ error: 'Le nom ou le RIB / IBAN est trop long' });
  const m = numberInRange(montant, 'Le montant', 0, false);
  const r = db.prepare(`
    INSERT INTO ordres_virement_zizi (date, montant, nom, rib, reference, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(date, m, nomValue, ribValue, reference || null, notes || null);
  res.json(db.prepare('SELECT * FROM ordres_virement_zizi WHERE id = ?').get(r.lastInsertRowid));
}));

app.put('/api/ordres-virement-zizi/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const { date, montant, nom, rib, reference, notes } = req.body;
  if (!isIsoDate(date)) return res.status(400).json({ error: 'La date est invalide (AAAA-MM-JJ)' });
  const nomValue = String(nom || '').trim();
  const ribValue = String(rib || '').trim();
  if (!nomValue) return res.status(400).json({ error: 'Le nom du beneficiaire est obligatoire' });
  if (!ribValue) return res.status(400).json({ error: 'Le RIB / IBAN du beneficiaire est obligatoire' });
  if (nomValue.length > 200 || ribValue.length > 100) return res.status(400).json({ error: 'Le nom ou le RIB / IBAN est trop long' });
  const m = numberInRange(montant, 'Le montant', 0, false);
  const existing = db.prepare('SELECT id FROM ordres_virement_zizi WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ordre de virement non trouve' });
  db.prepare('UPDATE ordres_virement_zizi SET date=?, montant=?, nom=?, rib=?, reference=?, notes=? WHERE id=?')
    .run(date, m, nomValue, ribValue, reference || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM ordres_virement_zizi WHERE id = ?').get(req.params.id));
}));

app.delete('/api/ordres-virement-zizi/:id', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const result = db.prepare('DELETE FROM ordres_virement_zizi WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Ordre de virement non trouve' });
  res.json({ ok: true });
}));

app.get('/api/ordres-virement-zizi/:id/export', (req, res) => {
  if (!requireValidId(req, res)) return;
  const format = req.query.format === 'docx' ? 'docx' : 'pdf';
  const o = db.prepare('SELECT * FROM ordres_virement_zizi WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Ordre de virement non trouve' });
  if (!o.nom || !o.rib) return res.status(400).json({ error: 'Ajoutez le nom et le RIB / IBAN du beneficiaire avant l export' });

  if (!fs.existsSync(TEMPLATE_OV_ZIZI)) {
    return res.status(500).json({ error: "Le modele d ordre de virement est introuvable sur le serveur." });
  }

  const vars = {
    date: fmtDateSrv(o.date),
    nom: o.nom || '',
    RIB: o.rib || '',
    montant: fmtSrv(o.montant),
    montant_lettres: moneyToWords(o.montant)
  };

  let tmpDir;
  try {
    if (format === 'pdf') {
      const { tmpDir: td, pdfOut } = runFill(vars, true, TEMPLATE_OV_ZIZI, 'ordre_virement.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ordre_virement_${o.id}.pdf"` });
      res.send(fs.readFileSync(pdfOut));
    } else {
      const { tmpDir: td, docxOut } = runFill(vars, false, TEMPLATE_OV_ZIZI, 'ordre_virement.docx');
      tmpDir = td;
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="ordre_virement_${o.id}.docx"` });
      res.send(fs.readFileSync(docxOut));
    }
  } catch (err) {
    sendDocumentError(err, res);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Comptabilite / Dashboard routes ────────────────────────────────────────────
app.get('/api/comptabilite/dashboard', safe((req, res) => {
  const yearParam = requireYear(req, res);
  if (yearParam === null) return;
  const yearFilter = "strftime('%Y', date) = ?";

  const ca = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(tva) as tva, SUM(pt_ttc + COALESCE(ajustement_arrondi, 0)) as ttc, COUNT(*) as count FROM factures WHERE ${yearFilter}`).get(String(yearParam));
  const charges = db.prepare(`SELECT SUM(CASE WHEN deductible = 1 THEN montant_ht ELSE 0 END) as ht_deductible, SUM(CASE WHEN deductible = 1 THEN tva ELSE 0 END) as tva_deductible, SUM(montant_ht) as ht, SUM(tva) as tva, SUM(montant_ttc) as ttc, COUNT(*) as count FROM charges WHERE ${yearFilter}`).get(String(yearParam));
  const impayees = db.prepare(`SELECT SUM(pt_ttc + COALESCE(ajustement_arrondi, 0)) as total, COUNT(*) as count FROM factures WHERE paid = 0 AND ${yearFilter}`).get(String(yearParam));

  const caByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as mois, SUM(montant_ht) as ht, SUM(tva) as tva, SUM(pt_ttc + COALESCE(ajustement_arrondi, 0)) as ttc
    FROM factures WHERE ${yearFilter}
    GROUP BY mois ORDER BY mois
  `).all(String(yearParam));

  const chargesByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as mois, SUM(montant_ht) as ht, SUM(tva) as tva, SUM(montant_ttc) as ttc
    FROM charges WHERE ${yearFilter}
    GROUP BY mois ORDER BY mois
  `).all(String(yearParam));

  const topClients = db.prepare(`
    SELECT c.name, SUM(f.pt_ttc + COALESCE(f.ajustement_arrondi, 0)) as total, COUNT(*) as factures
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
  const charges_ht = charges.ht_deductible || 0;
  const charges_ttc = charges.ttc || 0;
  const resultat_brut = ca_ht - charges_ht;

  const fiscal = fiscalEstimate(ca_ht, resultat_brut);
  const taux_is = fiscal.tauxIs;
  const cm_du = fiscal.cmCalculee;
  const is_du = fiscal.isDu;
  const css_du = fiscal.cssDu;

  const tva_collectee = ca.tva || 0;
  const tva_deductible = charges.tva_deductible || 0;
  const tva_a_payer = Math.max(tva_collectee - tva_deductible, 0);
  const tva_credit = Math.max(tva_deductible - tva_collectee, 0);

  const patente_estimee = ca_ht * 0.005;

  res.json({
    annee: yearParam,
    chiffre_affaires: { ht: ca_ht, tva: ca.tva || 0, ttc: ca_ttc, count: ca.count || 0 },
    charges: { ht: charges_ht, tva: tva_deductible, ttc: charges_ttc, count: charges.count || 0 },
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
      total_impots: Math.round(is_du + css_du),
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
  const yearParam = requireYear(req, res);
  if (yearParam === null) return;
  const trimestre = parseTrimestre(req.query.trimestre);
  if (req.query.trimestre !== undefined && trimestre === null) return res.status(400).json({ error: 'Trimestre invalide (1-4)' });

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
    SELECT strftime('%Y-%m', date) as periode, SUM(tva) as tva, SUM(montant_ht) as ht, SUM(pt_ttc + COALESCE(ajustement_arrondi, 0)) as ttc, COUNT(*) as count
    FROM factures WHERE ${dateFilter}
    GROUP BY periode ORDER BY periode
  `).all(...dateParams);

  const tvaAchats = db.prepare(`
    SELECT strftime('%Y-%m', date) as periode, SUM(tva) as tva, SUM(montant_ht) as ht, SUM(montant_ttc) as ttc, COUNT(*) as count
    FROM charges WHERE deductible = 1 AND ${dateFilter}
    GROUP BY periode ORDER BY periode
  `).all(...dateParams);

  const totalVentes = db.prepare(`SELECT SUM(tva) as tva, SUM(montant_ht) as ht FROM factures WHERE ${dateFilter}`).get(...dateParams);
  const totalAchats = db.prepare(`SELECT SUM(tva) as tva, SUM(montant_ht) as ht FROM charges WHERE deductible = 1 AND ${dateFilter}`).get(...dateParams);

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
  const yearParam = requireYear(req, res);
  if (yearParam === null) return;
  const yearFilter = "strftime('%Y', date) = ?";

  const ca = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(pt_ttc + COALESCE(ajustement_arrondi, 0)) as ttc FROM factures WHERE ${yearFilter}`).get(String(yearParam));
  const charges = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(montant_ttc) as ttc FROM charges WHERE deductible = 1 AND ${yearFilter}`).get(String(yearParam));

  const ca_ht = ca.ht || 0;
  const charges_ht = charges.ht || 0;
  const resultat_brut = ca_ht - charges_ht;

  const fiscal = fiscalEstimate(ca_ht, resultat_brut);
  const taux_is = fiscal.tauxIs;
  const is_calcule = fiscal.isCalcule;
  const cm_calculee = fiscal.cmCalculee;
  const is_du = fiscal.isDu;
  const css_du = fiscal.cssDu;
  const taux_css = fiscal.tauxCss;

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
  const annee = requireYear(req, res);
  if (annee === null) return;
  const yearFilter = "strftime('%Y', date) = ?";

  const ca = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(pt_ttc + COALESCE(ajustement_arrondi, 0)) as ttc FROM factures WHERE ${yearFilter}`).get(String(annee));
  const charges = db.prepare(`SELECT SUM(montant_ht) as ht, SUM(montant_ttc) as ttc FROM charges WHERE deductible = 1 AND ${yearFilter}`).get(String(annee));

  const ca_ht = ca.ht || 0;
  const charges_ht = charges.ht || 0;
  const resultat_brut = ca_ht - charges_ht;

  const fiscal = fiscalEstimate(ca_ht, resultat_brut);
  const cm_calculee = fiscal.cmCalculee;
  const is_du = fiscal.isDu;
  const css_du = fiscal.cssDu;

  const tvaCollectee = db.prepare(`SELECT SUM(tva) as tva FROM factures WHERE ${yearFilter}`).get(String(annee)).tva || 0;
  const tvaDeductible = db.prepare(`SELECT SUM(tva) as tva FROM charges WHERE deductible = 1 AND ${yearFilter}`).get(String(annee)).tva || 0;

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
const configuredDocumentsPath = process.env.DOCUMENT_WORKER_PATH || '../../workers/documents';
const DOCUMENTS_DIR = path.isAbsolute(configuredDocumentsPath)
  ? configuredDocumentsPath
  : path.resolve(__dirname, configuredDocumentsPath);
const TEMPLATES_DIR = path.join(DOCUMENTS_DIR, 'templates');
const TEMPLATE_ADJUSTED = path.join(TEMPLATES_DIR, 'template_Tradivia_ajust.docx');
const TEMPLATE_LEGACY = path.join(TEMPLATES_DIR, 'template_tradivia.docx');
const TEMPLATE = fs.existsSync(TEMPLATE_ADJUSTED) ? TEMPLATE_ADJUSTED : TEMPLATE_LEGACY;
const FILL_SCRIPT = path.join(DOCUMENTS_DIR, 'fill_template.py');
const MERGE_SCRIPT = path.join(DOCUMENTS_DIR, 'merge_invoices.py');
const TEMPLATE_OV_TVA = path.join(TEMPLATES_DIR, 'template_ordre_virement_TVA.docx');
const TEMPLATE_OV_ZIZI = path.join(TEMPLATES_DIR, 'template_Ordre_de_virement_zizi.docx');

let pythonRuntime;
function getPython() {
  if (pythonRuntime) return pythonRuntime;
  const candidates = [
    process.env.PYTHON_EXECUTABLE && { command: process.env.PYTHON_EXECUTABLE, prefix: [] },
    process.platform === 'win32' && { command: path.resolve(__dirname, '../../.python/python.exe'), prefix: [] },
    process.platform === 'win32' && { command: path.resolve(__dirname, '../../.venv/Scripts/python.exe'), prefix: [] },
    process.platform === 'win32' && { command: 'py', prefix: ['-3'] },
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] }
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate.command, [...candidate.prefix, '-c', 'import docx'], { stdio: 'ignore', timeout: 10000 });
      pythonRuntime = candidate;
      return pythonRuntime;
    } catch {}
  }
  const error = new Error('Python 3 avec python-docx est introuvable. Installez les dependances de workers/documents ou configurez PYTHON_EXECUTABLE.');
  error.code = 'PYTHON_NOT_FOUND';
  throw error;
}

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeIdentity(value) {
  return String(value || '').toUpperCase().replace(/[\s.-]+/g, '');
}

function isValidIban(value) {
  const iban = normalizeIdentity(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const numeric = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function buildAnomalyReport({ factures = [], clients = [], containers = [], charges = [], ordres = [] } = {}) {
  const anomalies = [];
  let sequence = 0;
  const add = (anomaly) => anomalies.push({ id: `anomaly-${++sequence}`, ...anomaly });
  const totalTtc = facture => round2(Number(facture.pt_ttc || 0) + Number(facture.ajustement_arrondi || 0));

  // Possible duplicates: same customer, date and total. The invoice number remains unique,
  // so this intentionally detects business duplicates rather than database duplicates.
  const duplicateGroups = new Map();
  for (const facture of factures) {
    const customer = facture.clientId || normalizeIdentity(facture.client_nom_manuel) || 'sans-client';
    const key = `${customer}|${facture.date || ''}|${totalTtc(facture).toFixed(2)}`;
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(facture);
  }
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    add({
      type: 'duplicate_invoice', severity: 'critical', title: 'Factures potentiellement en double',
      message: `${group.length} factures ont le meme client, la meme date et le meme total TTC.`,
      entity_type: 'facture', entity_id: group[0].id,
      entity_label: group.map(item => item.numero).join(', '), action_page: 'factures',
      details: { numeros: group.map(item => item.numero), date: group[0].date, total_ttc: totalTtc(group[0]) }
    });
  }

  // Price outliers are compared with invoices of the same designation. A minimum of
  // three observations prevents a single historical price from becoming the baseline.
  const priceGroups = new Map();
  for (const facture of factures) {
    const key = String(facture.designation || '').trim().toLocaleLowerCase('fr');
    if (!key || !Number.isFinite(Number(facture.pu_ttc)) || Number(facture.pu_ttc) <= 0) continue;
    if (!priceGroups.has(key)) priceGroups.set(key, []);
    priceGroups.get(key).push(facture);
  }
  for (const group of priceGroups.values()) {
    if (group.length < 3) continue;
    const reference = median(group.map(item => item.pu_ttc));
    if (reference <= 0) continue;
    for (const facture of group) {
      const price = Number(facture.pu_ttc);
      const ratio = price / reference;
      if (ratio >= 0.55 && ratio <= 1.45) continue;
      add({
        type: 'price_outlier', severity: 'warning', title: ratio > 1 ? 'Prix anormalement eleve' : 'Prix anormalement bas',
        message: `Le PU TTC de ${price.toFixed(2)} DH differe de la mediane historique de ${reference.toFixed(2)} DH.`,
        entity_type: 'facture', entity_id: facture.id, entity_label: facture.numero,
        action_page: 'factures', details: { prix: price, mediane: round2(reference), ecart_pourcent: round2((ratio - 1) * 100) }
      });
    }
  }

  for (const facture of factures) {
    const expected = round2(totalTtc(facture) / 6);
    const actual = round2(Number(facture.tva || 0));
    if (Math.abs(expected - actual) <= 0.02) continue;
    add({
      type: 'vat_mismatch', severity: 'critical', title: 'TVA incoherente',
      message: `TVA enregistree ${actual.toFixed(2)} DH, valeur attendue ${expected.toFixed(2)} DH pour un taux de 20 %.`,
      entity_type: 'facture', entity_id: facture.id, entity_label: facture.numero,
      action_page: 'factures', details: { tva_enregistree: actual, tva_attendue: expected }
    });
  }

  for (const container of containers) {
    const ordered = Number(container.poids_commande || 0);
    const received = Number(container.poids_recu || 0);
    if (ordered <= 0 || received <= 0) continue;
    const difference = round2(received - ordered);
    const rate = Math.abs(difference) / ordered * 100;
    if (rate <= 1) continue;
    add({
      type: 'weight_mismatch', severity: rate > 5 ? 'critical' : 'warning', title: 'Ecart de poids conteneur',
      message: `${ordered.toFixed(2)} kg commandes contre ${received.toFixed(2)} kg recus (${difference >= 0 ? '+' : ''}${difference.toFixed(2)} kg).`,
      entity_type: 'container', entity_id: container.id, entity_label: container.numero,
      action_page: 'conteneurs', details: { poids_commande: ordered, poids_recu: received, ecart_kg: difference, ecart_pourcent: round2(rate) }
    });
  }

  for (const client of clients) {
    if (client.client_type === 'physique') {
      const cin = normalizeIdentity(client.cin);
      if (cin && !/^[A-Z]{1,3}\d{4,10}$/.test(cin)) add({
        type: 'suspicious_identity', severity: 'warning', title: 'CIN a verifier',
        message: `Le format du CIN « ${client.cin} » semble inhabituel.`, entity_type: 'client',
        entity_id: client.id, entity_label: client.name, action_page: 'clients', details: { champ: 'CIN', valeur: client.cin }
      });
    } else {
      const ice = normalizeIdentity(client.ice);
      if (ice && !/^\d{15}$/.test(ice)) add({
        type: 'suspicious_identity', severity: 'warning', title: 'ICE a verifier',
        message: `L'ICE doit normalement contenir 15 chiffres ; valeur actuelle « ${client.ice} ».`, entity_type: 'client',
        entity_id: client.id, entity_label: client.name, action_page: 'clients', details: { champ: 'ICE', valeur: client.ice }
      });
    }
  }

  for (const ordre of ordres) {
    const rib = normalizeIdentity(ordre.rib);
    const validRib = /^\d{24}$/.test(rib) || isValidIban(rib);
    if (!rib || validRib) continue;
    add({
      type: 'suspicious_bank_account', severity: 'critical', title: 'RIB / IBAN a verifier',
      message: `Le compte « ${ordre.rib} » ne correspond pas a un RIB marocain de 24 chiffres ni a un IBAN valide.`,
      entity_type: 'ordre_virement', entity_id: ordre.id, entity_label: ordre.nom || `Ordre ${ordre.id}`,
      action_page: 'virement_zizi', details: { rib: ordre.rib }
    });
  }

  const chargeGroups = new Map();
  for (const charge of charges) {
    const key = String(charge.categorie || 'Sans categorie').trim().toLocaleLowerCase('fr');
    if (!chargeGroups.has(key)) chargeGroups.set(key, []);
    chargeGroups.get(key).push(charge);
  }
  for (const group of chargeGroups.values()) {
    if (group.length < 3) continue;
    const reference = median(group.map(item => item.montant_ttc));
    if (reference <= 0) continue;
    for (const charge of group) {
      const amount = Number(charge.montant_ttc || 0);
      const ratio = amount / reference;
      if (ratio >= 0.25 && ratio <= 2.5) continue;
      add({
        type: 'unusual_charge', severity: 'warning', title: 'Charge inhabituelle',
        message: `Montant TTC ${amount.toFixed(2)} DH contre une mediane de ${reference.toFixed(2)} DH dans la categorie ${charge.categorie}.`,
        entity_type: 'charge', entity_id: charge.id, entity_label: charge.libelle,
        action_page: 'charges', details: { montant: amount, mediane: round2(reference), categorie: charge.categorie }
      });
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title, 'fr'));
  const byType = anomalies.reduce((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {});
  return {
    generated_at: new Date().toISOString(),
    summary: {
      total: anomalies.length,
      critical: anomalies.filter(item => item.severity === 'critical').length,
      warning: anomalies.filter(item => item.severity === 'warning').length,
      by_type: byType
    },
    anomalies
  };
}

function runPython(args, options) {
  const runtime = getPython();
  return execFileSync(runtime.command, [...runtime.prefix, ...args], options);
}

function runFill(vars, createPdf = false, template = TEMPLATE, outName = 'facture.docx') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tradivia-'));
  const docxOut = path.join(tmpDir, outName);
  const pdfOut = createPdf ? path.join(tmpDir, `${path.parse(outName).name}.pdf`) : null;
  const jsonPath = path.join(tmpDir, 'vars.json');
  fs.writeFileSync(jsonPath, JSON.stringify(vars), 'utf8');
  const args = [FILL_SCRIPT, template, docxOut, jsonPath];
  if (pdfOut) args.push('--pdf', pdfOut);
  try {
    runPython(args, { timeout: 30000 });
    return { tmpDir, docxOut, pdfOut };
  } catch (error) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

// Formats the two placeholders used by template_ordre_virement_TVA.docx:
// {{ date }} and {{ montant }}.
function buildOrdreVirementVarsSrv(o) {
  return {
    date: fmtDateSrv(o.date),
    montant: fmtSrv(o.montant)
  };
}

function fiscalEstimate(caHt, resultatBrut) {
  const tauxIs = resultatBrut >= 100000000 ? 35 : 20;
  const isCalcule = Math.max(resultatBrut * (tauxIs / 100), 0);
  // Article 144 CGI: the minimum contribution base excludes VAT.
  const cmCalculee = caHt > 0 ? Math.max(caHt * 0.0025, 3000) : 0;
  const isDu = Math.max(isCalcule, cmCalculee);
  let tauxCss = 0;
  if (resultatBrut >= 1000000) {
    if (resultatBrut < 5000000) tauxCss = 1.5;
    else if (resultatBrut < 10000000) tauxCss = 2.5;
    else if (resultatBrut < 40000000) tauxCss = 3.5;
    else tauxCss = 5;
  }
  return { tauxIs, isCalcule, cmCalculee, isDu, tauxCss, cssDu: Math.max(resultatBrut, 0) * tauxCss / 100 };
}

function handleRouteError(err, res) {
  if (res.headersSent) return;
  const code = String(err?.code || '');
  if (code.startsWith('SQLITE_CONSTRAINT')) {
    const foreignKey = code.includes('FOREIGNKEY') || /FOREIGN KEY constraint failed/i.test(err.message || '');
    return res.status(409).json({ error: foreignKey
      ? 'Cette ressource est utilisee par un autre enregistrement.'
      : 'Cette valeur existe deja ou ne respecte pas une contrainte.' });
  }
  const status = Number.isInteger(err?.status) ? err.status : 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : err.message });
}

function sendDocumentError(error, res) {
  console.error(error);
  if (res.headersSent) return;
  const detail = [error?.message, error?.stderr, error?.stdout]
    .filter(Boolean).map(value => String(value)).join('\n');
  let message = 'La generation du document a echoue. Verifiez Python, les modeles et Microsoft Word pour les PDF.';
  if (error?.code === 'ENOENT' || /python.+(?:introuvable|not found|not recognized)/i.test(detail)) {
    message = 'Python 3 est introuvable. Installez Python et les dependances du dossier workers/documents.';
  } else if (/ouverture de session.+(?:existe pas|termin)|CoCreateInstanceEx/i.test(detail)) {
    message = 'Microsoft Word ne peut pas demarrer dans cette session Windows. Relancez l API depuis votre terminal utilisateur ou installez LibreOffice.';
  } else if (/pywin32|microsoft word|libreoffice|pdf export|could not create the pdf/i.test(detail)) {
    message = 'La conversion PDF a echoue. Verifiez Microsoft Word, pywin32 ou LibreOffice.';
  } else if (/template.+(?:introuvable|not found)/i.test(detail)) {
    message = 'Le modele Word requis est introuvable ou illisible.';
  } else if (/timed out|etimedout/i.test(detail)) {
    message = 'La generation du document a depasse le delai autorise.';
  }
  res.status(500).json({ error: message });
}

function safeDownloadName(value) {
  return String(value || 'export').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 100) || 'export';
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function numberInRange(value, label, minimum = 0, allowZero = true) {
  const number = Number(value);
  const valid = Number.isFinite(number) && (allowZero ? number >= minimum : number > minimum);
  if (!valid) throw Object.assign(new Error(`${label} doit etre ${allowZero ? 'positif ou nul' : 'positif'}`), { status: 400 });
  return round2(number);
}

app.post('/api/invoice', (req, res) => {
  let tmpDir;
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || !req.body.numero) {
      return res.status(400).json({ error: 'Donnees de facture invalides' });
    }
    const { tmpDir: td, pdfOut } = runFill(req.body, true);
    tmpDir = td;
    const num = safeDownloadName(req.body.numero);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="facture_${num}.pdf"` });
    res.send(fs.readFileSync(pdfOut));
  } catch (err) {
    sendDocumentError(err, res);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

app.post('/api/invoice/docx', (req, res) => {
  let tmpDir;
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || !req.body.numero) {
      return res.status(400).json({ error: 'Donnees de facture invalides' });
    }
    const { tmpDir: td, docxOut } = runFill(req.body);
    tmpDir = td;
    const num = safeDownloadName(req.body.numero);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="facture_${num}.docx"` });
    res.send(fs.readFileSync(docxOut));
  } catch (err) {
    sendDocumentError(err, res);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── PDF / DOCX export (grouped invoices, merged into one file) ──────────────
function runMergeFill(varsList, createPdf = false) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tradivia-merge-'));
  const docxOut = path.join(tmpDir, 'factures_groupees.docx');
  const pdfOut = createPdf ? path.join(tmpDir, 'factures_groupees.pdf') : null;
  const jsonPath = path.join(tmpDir, 'vars_list.json');

  fs.writeFileSync(jsonPath, JSON.stringify(varsList), 'utf8');

  const args = [
    MERGE_SCRIPT,
    TEMPLATE,
    jsonPath,
    docxOut,
    '--fill-script', FILL_SCRIPT
  ];

  if (pdfOut) {
    args.push('--pdf', pdfOut);
  }

  try {
    runPython(args, { timeout: 120000 });
    return { tmpDir, docxOut, pdfOut };
  } catch (error) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

// ── PDF / DOCX export (stored invoice by id, used by the agent) ─────────────
app.get('/api/factures/:id/export', safe((req, res) => {
  if (!requireValidId(req, res)) return;
  const format = req.query.format === 'docx' ? 'docx' : 'pdf';
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
  if (!facture) return res.status(404).json({ error: 'Facture non trouvee' });
  const client = facture.clientId ? db.prepare('SELECT * FROM clients WHERE id = ?').get(facture.clientId) : null;
  const vars = buildInvoiceVarsSrv(facture, client);

  let tmpDir;
  try {
    if (format === 'pdf') {
      const { tmpDir: td, pdfOut } = runFill(vars, true);
      tmpDir = td;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="facture_${safeDownloadName(facture.numero)}.pdf"` });
      res.send(fs.readFileSync(pdfOut));
    } else {
      const { tmpDir: td, docxOut } = runFill(vars, false);
      tmpDir = td;
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="facture_${safeDownloadName(facture.numero)}.docx"` });
      res.send(fs.readFileSync(docxOut));
    }
  } catch (err) {
    sendDocumentError(err, res);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}));

app.post('/api/factures/export-group', safe((req, res) => {
  const { ids, format } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Aucune facture selectionnee' });
  const validIds = [...new Set(ids.map(String).filter(isValidId).map(Number))];
  if (validIds.length !== ids.length) return res.status(400).json({ error: 'Liste d’identifiants invalide' });
  const placeholders = validIds.map(() => '?').join(',');
  const factures = db.prepare(`SELECT * FROM factures WHERE id IN (${placeholders}) ORDER BY date, id`).all(...validIds);
  if (factures.length !== validIds.length) return res.status(404).json({ error: 'Une ou plusieurs factures sont introuvables' });

  const varsList = factures.map(f => {
    const client = f.clientId ? db.prepare('SELECT * FROM clients WHERE id = ?').get(f.clientId) : null;
    return buildInvoiceVarsSrv(f, client);
  });

  let tmpDir;
  try {
    if (format === 'pdf') {
      const { tmpDir: td, pdfOut } = runMergeFill(varsList, true);
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
    sendDocumentError(err, res);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}));

// ── AI agent (chat + tool calling) ──────────────────────────────────────────
const { mountAgentRoutes } = require('./agent/agent.cjs');
mountAgentRoutes({
  app,
  db,
  safe,
  helpers: { round2, computeFactureAmounts, fiscalEstimate, buildAnomalyReport }
});

// ── Global fallback handlers ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvee' });
});

app.use((err, req, res, next) => {
  handleRouteError(err, res);
});

const PORT = process.env.PORT || 3001;
let server;
if (require.main === module) {
server = app.listen(PORT, () => console.log(`Tradivia API → http://localhost:${PORT}`));
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Tradivia API est deja active sur http://localhost:${PORT}. Ne lancez pas une deuxieme instance.`);
    process.exit(0);
  }
  console.error('Impossible de demarrer Tradivia API:', error);
  process.exit(1);
});

process.once('SIGINT', () => shutdown());
process.once('SIGTERM', () => shutdown());
}

function shutdown() {
  if (!server) return;
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

module.exports = { app, db, computeFactureAmounts, buildInvoiceVarsSrv, buildAnomalyReport, fiscalEstimate, moneyToWords, numToWords };

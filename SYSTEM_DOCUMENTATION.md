# Tradivia System — Complete Technical and User Documentation

> This document describes an earlier layout. For the current runtime, including the root `App.jsx` entry and the AI assistant, see the [French technical documentation](./DOCUMENTATION_TECHNIQUE.md).

## 1. Purpose

Tradivia System is a local commercial-management application for TRADIVIA. It combines:

- customer management;
- invoice creation and payment tracking;
- container and shipping tracking;
- document storage for containers;
- expense management;
- TVA and ZIZI transfer orders;
- accounting dashboards and tax estimates;
- accounting-year closure;
- Word and PDF document generation.

The application is designed to run on a Windows laptop. The browser interface runs on port `5173`, and the API runs on port `3001`.

## 2. Current Runtime Architecture

```text
Browser
  |
  | HTTP / JSON + JWT
  v
React + Vite frontend (apps/web, port 5173)
  |
  | /api/*
  v
Express API (apps/api/server.cjs, port 3001)
  |
  +--> SQLite database (apps/api/tradivia.db by default)
  +--> Uploaded files (apps/api/uploads/containers)
  +--> Python document scripts (workers/documents)
  +--> Word templates (workers/documents/templates)
  +--> Microsoft Word automation for PDF conversion
```

### Active entry points

- API: `apps/api/server.cjs`
- Frontend: `apps/web/src/main.jsx`
- Main React application: `apps/web/src/app/App.jsx`
- Database: `apps/api/tradivia.db`

### Legacy files and retained uploads

The following paths are retained from an earlier modular scaffold, but the current npm commands do **not** run them:

- `apps/api/src/**`
- `apps/api/data/tradivia.db`
- `apps/web/src/components/Sidebar.jsx`
- `apps/web/src/pages/DashboardPage.jsx`
- `apps/web/src/services/api.js`

Do not modify these legacy files when changing the live application unless the project is deliberately migrated back to that architecture.

The root `App.jsx`, `index.js`, Python scripts, and Word templates are retained as source uploads/backups. The active frontend and API are under `apps/`; the active document resources are under `workers/documents/`. See `docs/source-layout.md` before changing any duplicated file.

## 3. Project Structure

```text
Tradivia-system-final-structured/
├── apps/
│   ├── api/
│   │   ├── server.cjs                 # Active Express API
│   │   ├── tradivia.db                # Active SQLite database
│   │   ├── uploads/
│   │   │   └── containers/            # Uploaded container documents
│   │   ├── tests/                     # API tests
│   │   ├── src/                       # Legacy modular API scaffold
│   │   └── package.json
│   └── web/
│       ├── index.html
│       ├── vite.config.js
│       ├── package.json
│       └── src/
│           ├── main.jsx               # React bootstrap
│           ├── app/App.jsx            # Active full frontend
│           └── styles/global.css       # Minimal global reset
├── workers/
│   └── documents/
│       ├── fill_template.py           # Fills one Word template
│       ├── merge_invoices.py          # Merges multiple invoices
│       ├── requirements.txt
│       └── templates/
│           ├── template_Tradivia_ajust.docx
│           ├── template_tradivia.docx
│           ├── template_ordre_virement_TVA.docx
│           └── template_Ordre_de_virement_zizi.docx
├── docs/
├── infra/
├── package.json                       # npm workspace commands
├── package-lock.json
├── .env.example
└── SYSTEM_DOCUMENTATION.md
```

## 4. Technology Stack

### Frontend

- React 18
- React DOM
- Vite 6
- `@vitejs/plugin-react`
- Plain CSS embedded in the main React component, plus a minimal global reset

### Backend

- Node.js 20 or newer
- Express 4
- SQLite through `better-sqlite3`
- JWT authentication through `jsonwebtoken`
- Password hashing through `bcryptjs`
- Upload handling through `multer`
- CORS middleware

### Document generation

- Python 3
- `python-docx`
- `pywin32` on Windows for Microsoft Word COM automation
- Microsoft Word for DOCX-to-PDF conversion

## 5. Installation

### Required software

Install the following before running the complete system:

1. Node.js 20 or newer.
2. Python 3.
3. Microsoft Word, if PDF exports are required on Windows.
4. Python packages:

```powershell
python -m pip install -r workers/documents/requirements.txt
```

If `python3` is the available command:

```powershell
python3 -m pip install -r workers/documents/requirements.txt
```

### Install Node dependencies

From the project root:

```powershell
cd C:\Users\sohai\Downloads\Tradivia-system-final-structured
npm install
```

## 6. Running the Application

Use two PowerShell terminals.

### Terminal 1 — API

```powershell
cd C:\Users\sohai\Downloads\Tradivia-system-final-structured
npm run dev:api
```

Expected message:

```text
Tradivia API → http://localhost:3001
```

### Terminal 2 — frontend

```powershell
cd C:\Users\sohai\Downloads\Tradivia-system-final-structured
npm run dev:web
```

Open:

```text
http://127.0.0.1:5173
```

Keep both terminals open. Press `Ctrl+C` in each terminal to stop the system.

### Other commands

```powershell
npm test
npm run lint -w @tradivia/api
npm run build -w @tradivia/web
npm run start -w @tradivia/api
```

- `test`: runs the API unit tests.
- `lint`: performs a Node syntax check on `server.cjs`.
- `build`: creates the frontend production build in `apps/web/dist`.
- `start`: runs the API without watch mode.

## 7. Initial Authentication

On the first start of an empty database, the API creates an administrator account:

```text
Username: admin
Password: ChangeMe123!
Role: admin
```

The password is hashed with bcrypt before storage.

Change the default password immediately in any non-test deployment. The API supports password changes through `POST /api/auth/change-password`, although the current frontend does not expose a dedicated password-management screen.

JWT sessions expire after eight hours. The frontend stores the token and user information in browser `localStorage` using:

- `tradivia_token`
- `tradivia_user`

When the API returns `401`, the frontend automatically logs the user out.

## 8. Configuration

The active server reads these process environment variables directly:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | API listening port | `3001` |
| `JWT_SECRET` | JWT signing secret; at least 32 characters in production | development fallback only |
| `ADMIN_DEFAULT_PASSWORD` | Password used only when seeding the first admin | `ChangeMe123!` |
| `DATABASE_PATH` | SQLite path; relative paths resolve from `apps/api` | `./tradivia.db` |
| `UPLOAD_DIR` | Uploaded-file root; relative paths resolve from `apps/api` | `./uploads` |
| `DOCUMENT_WORKER_PATH` | Python worker/template root; relative paths resolve from `apps/api` | `../../workers/documents` |
| `CORS_ORIGIN` | Comma-separated browser origin allowlist | the two local Vite origins |
| `SEED_DEMO_DATA` | Seed sample clients/charges only when exactly `true` | `false` |
| `VITE_API_URL` | Frontend API base, read by Vite; include `/api` | `http://127.0.0.1:3001/api` |

Example for the current PowerShell session:

```powershell
$env:PORT='3001'
$env:JWT_SECRET='use-a-long-random-secret'
$env:ADMIN_DEFAULT_PASSWORD='use-a-strong-initial-password'
npm run dev:api
```

The API automatically loads `.env` from the project root. Copy `.env.example`
to `.env` and change its secrets for any real deployment. Keep
`DOCUMENT_WORKER_PATH` pointed at a folder containing both the scripts and the
`templates` subfolder.

The frontend reads `VITE_API_URL` through `apps/web/src/services/api.js`. Restart
the Vite server after changing it; production builds embed its value at build
time.

## 9. Frontend Modules

The application uses a single main React component with page state rather than a URL router.

### Login

- Accepts username and password.
- Calls `POST /api/auth/login`.
- Saves the JWT and user data to `localStorage`.
- Validates a restored session through `GET /api/auth/me`.

### Factures

- Create, edit, delete, and list invoices.
- Search and filter by year, month, and client.
- Select multiple invoices.
- Bulk delete selected invoices.
- Export a single invoice as PDF or DOCX.
- Export selected invoices as a merged PDF or DOCX.
- Mark invoices as paid/unpaid.
- Support company customers and manually entered individual customers.
- Calculate from quantity or from a requested total.

Invoice payment methods offered by the frontend:

- Cheque
- Virement bancaire
- Especes

### Clients

- Create, edit, delete, search, and display customers.
- Store name, ICE, address, telephone, and email.
- Customer records can be linked to company invoices.

### Conteneurs

- Create, edit, delete, search, and filter containers.
- Filter by status, supplier, departure port, and arrival port.
- Store container number, seal, type, supplier, ports, dates, bag count, total weight, BL, and commercial-invoice reference.
- Upload, view, download, and delete container documents.

Container types offered by the frontend:

- 20ft
- 40ft
- 40ft HC
- 20ft Reefer
- 40ft Reefer
- Open Top
- Flat Rack

Container statuses include:

- En transit
- Arrivé
- Dédouanement
- Livré
- En attente

### Charges

- Create, edit, delete, list, search, and filter expenses.
- Filter by year and category.
- Track HT, TVA, TTC, supplier, payment mode, reference, deductibility, and notes.
- Show totals grouped by category and month through API statistics.

Available categories:

- Fournitures
- Logistique
- Salaires
- Charges sociales
- Marketing
- Frais bancaires
- Loyer
- Entretien
- Transport
- Autres

Payment methods:

- Virement
- Cheque
- Especes
- Prelevement
- Carte bancaire

### Ordre virement TVA

- Create, edit, delete, and list TVA transfer orders.
- Store date, amount, reference, and notes.
- Export as PDF or DOCX using the TVA Word template.

### Ordre virement ZIZI

- Create, edit, delete, and list ZIZI transfer orders.
- Store date, amount, reference, and notes.
- Export as PDF or DOCX using the ZIZI Word template.

### Comptabilité

Contains four tabs:

1. Tableau de bord
2. TVA
3. Impôts
4. Exercices

It provides revenue, expenses, margins, receivables, monthly trends, top clients, expense categories, TVA balances, tax estimates, quarterly installments, and accounting-year closure.

### Société

Displays the company identity defined in `App.jsx`:

- company name;
- ICE;
- RC;
- CNSS;
- patente;
- IF;
- address;
- telephone;
- email.

These values are currently constants in the frontend and are not editable through the API.

## 10. Invoice Calculation Logic

The system assumes TTC includes 20% TVA and derives included TVA using division by six.

### Quantity mode (`calc_type = qte`)

```text
PT TTC = quantity in kg × unit price TTC
TVA = PT TTC / 6
HT = PT TTC - TVA
Rounding adjustment = 0
```

All financial results are rounded to two decimal places.

### Requested-total mode (`calc_type = total`)

```text
TVA = entered total TTC / 6
HT = entered total TTC - TVA
Quantity = floor(entered total TTC / unit price TTC)
Calculated PT TTC = quantity × unit price TTC
Rounding adjustment = entered total TTC - calculated PT TTC
```

The final displayed/exported total is:

```text
Calculated PT TTC + rounding adjustment
```

## 11. Accounting and Tax Logic

Accounting endpoints accept a year between 2000 and 2100. Invalid or missing years default to the current year.

### Revenue and expenses

- Revenue HT/TVA/TTC comes from invoices.
- Expense HT/TVA/TTC comes from charges.
- Estimated fiscal result = revenue HT − deductible expense HT.
- Margin = gross result / revenue HT × 100.

### TVA

```text
Collected TVA = invoice TVA
Deductible TVA = expense TVA
TVA payable = max(collected − deductible, 0)
TVA credit = max(deductible − collected, 0)
```

TVA can be reported for a full year or a quarter.

### IS and minimum contribution

The current code estimates IS at 20%, or 35% when the gross result is at least 100,000,000. It calculates the minimum contribution as:

```text
max(revenue HT × 0.25%, 3,000)
```

The detailed tax endpoint uses the larger of calculated IS and the minimum contribution as IS due.

### CSS

CSS is zero below 1,000,000 gross result. Current brackets are:

- 1.5% from 1,000,000 (inclusive) to 5,000,000 (exclusive);
- 2.5% from 5,000,000 (inclusive) to 10,000,000 (exclusive);
- 3.5% from 10,000,000 (inclusive) to 40,000,000 (exclusive);
- 5% from 40,000,000 (inclusive).

### Patente estimate

```text
Revenue HT × 0.5%
```

These rules were checked against the Moroccan Ministry of Finance's
[2026 General Tax Code](https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf)
on 14 August 2026. They remain software estimates, not a substitute for review
by a Moroccan accountant or tax professional; the actual tax base can include
adjustments and products that this simplified data model does not store.

## 12. Database

### Active database file

```text
apps/api/tradivia.db
```

This is the default. If `DATABASE_PATH` is configured, back up and restore the
resolved configured file instead. Relative values are resolved from `apps/api`.

SQLite foreign keys are enabled.

### Tables

#### `users`

- `id`
- `username` — unique
- `password_hash`
- `role` — `admin` or `user`
- `active`
- `created_at`
- `last_login`

#### `clients`

- `id`
- `name`
- `ice`
- `address`
- `phone`
- `email`

#### `factures`

- `id`
- `clientId` — optional relation to `clients`
- `numero` — unique
- `lieu`
- `date`
- `qte_kg`
- `designation`
- `pu_ttc`
- `pt_ttc`
- `montant_ht`
- `tva`
- `paid`
- `client_type`
- `client_nom_manuel`
- `client_cin_manuel`
- `client_adresse_manuel`
- `calc_type`
- `total_ttc_saisi`
- `mode_paiement`
- `ajustement_arrondi`

#### `containers`

- `id`
- `numero` — unique
- `type`
- `scelle`
- `statut`
- `fournisseur`
- `port_depart`
- `port_arrivee`
- `date_depart`
- `date_arrivee`
- `nb_sacs`
- `poids_total`
- `bl`
- `facture_commerciale`
- `created_at`
- `updated_at`

#### `container_documents`

- `id`
- `container_id`
- `original_name`
- `stored_name`
- `mime_type`
- `file_size`
- `uploaded_at`

Deleting a container removes its document records and stored files.

#### `charges`

- `id`
- `date`
- `categorie`
- `libelle`
- `montant_ht`
- `tva`
- `montant_ttc`
- `fournisseur`
- `mode_paiement`
- `reference`
- `deductible`
- `notes`
- `created_at`

#### `exercices_comptables`

- `id`
- `annee` — unique
- `date_debut`
- `date_fin`
- `statut`
- `ca_total`
- `charges_totales`
- `resultat_net`
- `is_du`
- `cm_du`
- `css_du`
- `tva_collectee`
- `tva_deductible`
- `tva_a_payer`
- `patente_du`
- `created_at`

#### `ordres_virement_tva`

- `id`
- `date`
- `montant`
- `reference`
- `notes`
- `created_at`

#### `ordres_virement_zizi`

Same fields as `ordres_virement_tva`.

### Initial data

When the users table is empty, the API creates the initial `admin` user. The
three example clients and ten example 2026 charges are now opt-in: they are
inserted only when `SEED_DEMO_DATA=true` and the corresponding table is empty.

## 13. Container Document Uploads

Uploaded files are stored under:

```text
apps/api/uploads/containers/<container-id>/
```

This is the default location. If `UPLOAD_DIR` is configured, use the resolved
configured directory instead; relative values are resolved from `apps/api`.

The database stores metadata while the filesystem stores the actual content.

Rules:

- up to 10 files per request;
- maximum 50 MB per file;
- allowed types: PDF, Word, Excel, JPEG, PNG, GIF, text, and ZIP;
- stored filenames are generated from a timestamp and random suffix;
- original filenames are retained in database metadata.

Both the SQLite database and the `uploads` folder must be backed up together.

## 14. Word and PDF Generation

### Locations

Scripts:

```text
workers/documents/fill_template.py
workers/documents/merge_invoices.py
```

Templates:

```text
workers/documents/templates/template_Tradivia_ajust.docx
workers/documents/templates/template_tradivia.docx
workers/documents/templates/template_ordre_virement_TVA.docx
workers/documents/templates/template_Ordre_de_virement_zizi.docx
```

`template_Tradivia_ajust.docx` is the primary invoice template. If it is missing, the API falls back to `template_tradivia.docx`.

Worker regression tests are available at
`workers/documents/test_documents.py`. After installing the Python requirements,
run them from the worker directory:

```powershell
cd workers/documents
python -m unittest -v test_documents.py
```

The suite validates all four bundled templates, placeholders split across Word
runs, nested tables, headers, formatting retention, and a two-invoice merge.

### Single-document process

1. The frontend builds template variables.
2. The API writes those variables to a temporary JSON file.
3. `fill_template.py` opens the selected `.docx` with `python-docx`.
4. It replaces `{{ variable_name }}` placeholders in paragraphs, nested tables, headers, and footers while retaining surrounding run formatting.
5. It saves the filled DOCX in a temporary directory.
6. For PDF export on Windows, Python opens the DOCX through Microsoft Word COM and saves it as PDF.
7. The API sends the generated file to the browser.
8. Temporary files are removed.

### Grouped invoice process

1. The API loads selected invoices and customer information.
2. It builds one variable object per invoice.
3. `merge_invoices.py` calls `fill_template.py` for each invoice.
4. It combines all filled invoices into one Word document with page breaks.
5. It preserves the final section properties to prevent blank pages.
6. It optionally converts the merged DOCX to PDF through Microsoft Word.

### Invoice placeholders

The primary invoice template can use:

- `{{ client_nom }}`
- `{{ client_identity }}`
- `{{ client_adresse }}`
- `{{ numero }}`
- `{{ lieu }}`
- `{{ date }}`
- `{{ qte_kg }}`
- `{{ designation }}`
- `{{ pu_ttc }}`
- `{{ total_ttc }}`
- `{{ pt_ttc }}`
- `{{ montant_ht }}`
- `{{ tva }}`
- `{{ pt_ttc_letters }}`
- `{{ mode_paiement }}`
- `{{ ajustement_arrondi }}`

The TVA transfer template uses `{{ date }}` and `{{ montant }}`. The ZIZI export also supplies `montant_lettres`.

The legacy invoice fallback uses dotted `{{ client.name }}` and
`{{ client.ice }}` markers. The API and worker support these nested values.

Placeholder text should remain within a normal Word paragraph or table-cell paragraph. The script can combine multiple Word runs before replacement, but complex placeholders inside shapes, text boxes, headers, footers, or embedded objects may require script enhancement.

## 15. API Authentication Rules

Login is the only public `/api` route:

```text
POST /api/auth/login
```

Every route registered after `app.use('/api', requireAuth)` needs a JWT.

Standard header:

```http
Authorization: Bearer <token>
```

Document view/download routes also accept `?token=<token>` because the frontend opens them in a new browser tab.

Only the user-management endpoints enforce the `admin` role. Other authenticated business routes are available to both `admin` and `user` roles.

## 16. API Route Reference

All routes below use the base URL `http://localhost:3001`.

### Authentication and users

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Sign in and receive a JWT |
| GET | `/api/auth/me` | Validate session/current user |
| POST | `/api/auth/change-password` | Change current password |
| GET | `/api/users` | List users; admin only |
| POST | `/api/users` | Create user; admin only |
| PUT | `/api/users/:id/deactivate` | Deactivate user; admin only |

### Clients

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client |

### Invoices

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/factures` | List invoices |
| POST | `/api/factures` | Create invoice |
| PUT | `/api/factures/:id` | Update invoice/payment status |
| DELETE | `/api/factures/:id` | Delete one invoice |
| DELETE | `/api/factures` | Bulk delete using `{ ids: [] }` |
| POST | `/api/invoice` | Generate one invoice PDF from variables |
| POST | `/api/invoice/docx` | Generate one invoice DOCX from variables |
| POST | `/api/factures/export-group` | Generate merged PDF/DOCX from invoice IDs |

### Containers and documents

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/containers` | List/filter containers |
| GET | `/api/containers/:id` | Get one container and its documents |
| POST | `/api/containers` | Create container |
| PUT | `/api/containers/:id` | Update container |
| DELETE | `/api/containers/:id` | Delete container and files |
| POST | `/api/containers/:id/documents` | Upload multipart field `documents` |
| GET | `/api/containers/:id/documents/:docId/download` | Download a file |
| GET | `/api/containers/:id/documents/:docId/view` | Display a file inline |
| DELETE | `/api/containers/:id/documents/:docId` | Delete a file |

Container list filters: `q`, `statut`, `fournisseur`, `port_depart`, and `port_arrivee`.

### Charges

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/charges` | List/filter charges |
| GET | `/api/charges/categories` | List existing categories |
| GET | `/api/charges/stats` | Totals by category/month |
| POST | `/api/charges` | Create charge |
| PUT | `/api/charges/:id` | Update charge |
| DELETE | `/api/charges/:id` | Delete charge |

Charge filters: `annee`, `categorie`, and `q`.

### Transfer orders

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/ordres-virement-tva` | List TVA transfer orders |
| POST | `/api/ordres-virement-tva` | Create TVA order |
| PUT | `/api/ordres-virement-tva/:id` | Update TVA order |
| DELETE | `/api/ordres-virement-tva/:id` | Delete TVA order |
| GET | `/api/ordres-virement-tva/:id/export?format=pdf|docx` | Export TVA order |
| GET | `/api/ordres-virement-zizi` | List ZIZI transfer orders |
| POST | `/api/ordres-virement-zizi` | Create ZIZI order |
| PUT | `/api/ordres-virement-zizi/:id` | Update ZIZI order |
| DELETE | `/api/ordres-virement-zizi/:id` | Delete ZIZI order |
| GET | `/api/ordres-virement-zizi/:id/export?format=pdf|docx` | Export ZIZI order |

### Accounting

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/comptabilite/dashboard?annee=2026` | Annual dashboard |
| GET | `/api/comptabilite/tva?annee=2026&trimestre=1` | TVA report |
| GET | `/api/comptabilite/impots?annee=2026` | Tax estimate |
| GET | `/api/comptabilite/exercices` | List accounting years |
| POST | `/api/comptabilite/exercices/:annee/cloturer` | Close/update an accounting year |

## 17. API Example

### Login

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3001/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"username":"admin","password":"ChangeMe123!"}'

$headers = @{ Authorization = "Bearer $($login.token)" }
```

### List customers

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/clients -Headers $headers
```

### Create a customer

```powershell
$body = @{
  name = 'Example Customer'
  ice = '001234567890123'
  address = 'Casablanca'
  phone = '+212600000000'
  email = 'client@example.com'
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3001/api/clients `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body
```

## 18. Data Backup and Restore

### What to back up

Stop the API first, then copy both:

```text
the database selected by DATABASE_PATH (apps/api/tradivia.db by default)
the directory selected by UPLOAD_DIR (apps/api/uploads by default)
```

Also retain customized templates:

```text
workers/documents/templates/
```

### Restore

1. Stop the API.
2. Replace the database selected by `DATABASE_PATH` with the backup.
3. Restore `apps/api/uploads` to the same path.
4. Restore template files if needed.
5. Restart the API.

Do not edit or copy the SQLite database while writes are actively occurring unless using an SQLite-aware backup method.

## 19. Troubleshooting

### `EADDRINUSE: address already in use :::3001`

Another API process already uses port 3001. Keep only one API terminal open. The current server handles this condition with a friendly message, but older watch processes may still show the raw error.

Check the port:

```powershell
netstat -ano | Select-String ':3001'
```

### White browser screen

1. Confirm Vite is running.
2. Open `http://127.0.0.1:5173`.
3. Refresh with `Ctrl+F5`.
4. Check the frontend terminal for compilation errors.
5. Run `npm run build -w @tradivia/web`.

### Login fails

- Confirm the API is the active `server.cjs` server.
- Confirm port 3001 is reachable.
- Use the current password stored in the active database.
- The default password is only valid until changed.
- Do not confuse `apps/api/tradivia.db` with the inactive `apps/api/data/tradivia.db`.

### DOCX export fails

Verify:

```powershell
python3 --version
python3 -c "import docx; print('python-docx ok')"
```

Confirm the scripts and templates exist under `workers/documents`.

### PDF export fails

PDF export on Windows requires:

- Microsoft Word installed and activatable;
- `pywin32` installed for the Python interpreter used by the API;
- no blocked Word dialog;
- permission to create temporary files.

Test:

```powershell
python3 -c "import win32com.client; print('pywin32 ok')"
```

### Placeholder remains in a generated document

- Check that the placeholder name matches exactly.
- Use the form `{{ variable_name }}`.
- Keep it in a normal paragraph or table cell.
- Avoid putting placeholders in unsupported Word objects such as shapes unless the script is extended.

### Uploaded document is rejected

- Maximum size is 50 MB.
- Verify the MIME type is in the allowed list.
- Upload no more than 10 files at once.

### Build fails with filesystem access errors

This environment may restrict Vite/esbuild traversal. Run the build from a normal local PowerShell window in the project root.

## 20. Security Notes

Before production or shared-network use:

1. Change the default admin password.
2. Set a long random `JWT_SECRET`.
3. Keep `CORS_ORIGIN` restricted to the exact browser origins that need access.
4. Serve the application behind HTTPS.
5. Do not expose port 3001 directly to the public internet.
6. Protect database, uploads, templates, and backups with OS permissions.
7. Add rate limiting to login and sensitive routes.
8. Keep document access authenticated through the `Authorization` header; the frontend fetches blobs and does not put JWTs in URLs.
9. Validate accounting formulas with a qualified professional.
10. Add audit logs for destructive and accounting actions.

## 21. Known Limitations and Maintenance Notes

- The frontend is a large single component; splitting it by domain would improve maintainability.
- The active API is a large `server.cjs` file. The unused `apps/api/src` tree shows a possible future modular architecture but is not currently integrated.
- `VITE_API_URL` is embedded at frontend build time; changing it requires restarting/rebuilding Vite.
- Company information is hard-coded in the frontend.
- User administration and password change exist in the API but have no complete frontend screens.
- Tax figures are estimates encoded in application logic and may need updates when regulations change.
- The active API applies an `updated_at` migration to accounting years at startup; a formal migration/versioning system is still recommended.
- Docker is explicitly unsupported in this release; `infra/docker-compose.yml` is a deprecated empty model and `infra/README.md` explains why.
- Node unit and isolated HTTP integration tests cover the critical API flows,
  and Python regression tests cover every bundled template. Browser-level UI
  automation and broader edge-case coverage are still missing.
- The database is a single local SQLite file and is best suited to local or small-team use, not high-concurrency public deployment.

## 22. Recommended Future Improvements

1. Add a formal SQLite migration system for the active database.
2. Split the API into route/controller/service/repository modules.
3. Split the frontend into page and domain components.
4. Move company settings into a database-backed settings screen.
5. Add frontend user/password administration.
6. Extend API edge-case coverage and add automated browser tests.
7. Add structured logging and audit history.
8. Add secure environment loading and validation.
9. If container deployment is needed, add tested Dockerfiles, persistent volumes, health checks, and a documented non-COM PDF strategy.
10. Add an automatic backup command and restore verification.
11. Add refresh tokens or shorter sessions for shared deployments.
12. Add document-template versioning and validation.

## 23. Operational Checklist

### Before starting

- Node dependencies installed.
- Python dependencies installed.
- Microsoft Word installed for PDF export.
- Templates present under `workers/documents/templates`.
- No stale API already using port 3001.

### After starting

- API terminal displays the port 3001 startup message.
- Vite terminal displays the port 5173 URL.
- Login succeeds.
- Client/invoice lists load.
- A DOCX export downloads correctly.
- A PDF export opens correctly.

### Before closing

- Finish any document generation.
- Stop frontend and API with `Ctrl+C`.
- Back up the database and uploads when important data changed.

---

This document describes the implementation present in the workspace as of August 13, 2026.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const workspace = path.resolve(__dirname, '../../../..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tradivia-integration-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(temporaryRoot, 'tradivia-test.db');
process.env.UPLOAD_DIR = path.join(temporaryRoot, 'uploads');
process.env.DOCUMENT_WORKER_PATH = path.join(workspace, 'workers', 'documents');
process.env.JWT_SECRET = 'integration-only-secret-that-is-never-used-in-production';
process.env.ADMIN_DEFAULT_PASSWORD = 'IntegrationTest123!';
process.env.SEED_DEMO_DATA = 'false';

const { app, db } = require('../../server.cjs');

let server;
let baseUrl;
let token;

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function request(route, options = {}) {
  const response = await fetch(baseUrl + route, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { response, body };
}

async function jsonRequest(route, method = 'GET', body) {
  return request(route, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function expectStatus(result, status) {
  assert.equal(
    result.response.status,
    status,
    `expected HTTP ${status}, got ${result.response.status}: ${JSON.stringify(result.body)}`,
  );
}

function expectDocx(result) {
  expectStatus(result, 200);
  assert.match(result.response.headers.get('content-type') || '', /officedocument/);
  assert.ok(result.body.length > 1_000, 'DOCX response should not be empty');
  assert.equal(result.body.subarray(0, 2).toString('ascii'), 'PK');
}

function expectPdf(result) {
  expectStatus(result, 200);
  assert.match(result.response.headers.get('content-type') || '', /application\/pdf/);
  assert.ok(result.body.length > 1_000, 'PDF response should not be empty');
  assert.equal(result.body.subarray(0, 4).toString('ascii'), '%PDF');
}

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('complete isolated HTTP workflow', { timeout: 180_000 }, async () => {
  let result = await request('/health');
  expectStatus(result, 200);
  assert.equal(result.body.status, 'ok');
  assert.equal(result.response.headers.get('x-powered-by'), null);

  result = await request('/health', { headers: { Origin: 'https://untrusted.example' } });
  expectStatus(result, 403);
  assert.match(result.body.error, /CORS/i);

  result = await request('/api/clients');
  expectStatus(result, 401);

  result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong' }),
  });
  expectStatus(result, 401);

  result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: { invalid: true }, password: ['invalid'] }),
  });
  expectStatus(result, 400);

  result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'IntegrationTest123!' }),
  });
  expectStatus(result, 200);
  token = result.body.token;
  assert.ok(token);
  assert.equal(result.body.user.role, 'admin');

  expectStatus(await request('/api/company'), 401);
  result = await jsonRequest('/api/company');
  expectStatus(result, 200);
  const originalCompany = result.body;
  const updatedCompany = { ...originalCompany, name: ' Nouvelle entreprise ', address: 'Rabat', phone: '', email: 'contact@example.test' };
  result = await jsonRequest('/api/company', 'PUT', updatedCompany);
  expectStatus(result, 200);
  assert.equal(result.body.name, 'Nouvelle entreprise');
  result = await jsonRequest('/api/company');
  assert.equal(result.body.address, 'Rabat');
  assert.equal(result.body.phone, '');
  const storedCompany = JSON.parse(db.prepare('SELECT data FROM company_settings WHERE id = 1').get().data);
  assert.deepEqual(result.body, storedCompany);
  for (const invalid of [{ name: ' ' }, { ice: '123' }, { email: 'invalid' }, { rc: 123 }, { address: 'x'.repeat(1001) }]) {
    expectStatus(await jsonRequest('/api/company', 'PUT', { ...storedCompany, ...invalid }), 400);
  }
  assert.deepEqual((await jsonRequest('/api/company')).body, storedCompany);
  expectStatus(await jsonRequest('/api/users', 'POST', { username: 'company_reader', password: 'ReaderTest123!', role: 'user' }), 200);
  const reader = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'company_reader', password: 'ReaderTest123!' }) });
  expectStatus(reader, 200);
  expectStatus(await request('/api/company', { headers: { Authorization: `Bearer ${reader.body.token}` } }), 200);
  expectStatus(await request('/api/company', { method: 'PUT', headers: { Authorization: `Bearer ${reader.body.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(originalCompany) }), 403);
  expectStatus(await jsonRequest('/api/company', 'PUT', originalCompany), 200);

  result = await jsonRequest('/api/auth/me');
  expectStatus(result, 200);
  assert.equal(result.body.user.username, 'admin');

  result = await jsonRequest('/api/auth/change-password', 'POST', {
    currentPassword: { invalid: true }, newPassword: ['invalid'],
  });
  expectStatus(result, 400);

  result = await jsonRequest('/api/clients', 'POST', { name: '  ' });
  expectStatus(result, 400);

  result = await jsonRequest('/api/clients', 'POST', {
    name: 'Client integration',
    ice: '001122334455667',
    address: 'Casablanca',
    phone: '+212600000000',
    email: 'integration@example.test',
  });
  expectStatus(result, 200);
  const client = result.body;
  assert.equal(client.name, 'Client integration');

  result = await jsonRequest('/api/clients', 'POST', {
    name: 'Personne integration',
    client_type: 'physique',
    address: 'Rabat',
  });
  expectStatus(result, 200);
  const physicalClient = result.body;
  assert.equal(physicalClient.client_type, 'physique');
  assert.equal(physicalClient.cin, null);

  result = await jsonRequest('/api/clients', 'POST', {
    name: 'Personne avec CIN', client_type: 'physique', cin: 'AB123456',
  });
  expectStatus(result, 200);

  result = await jsonRequest('/api/clients', 'POST', {
    name: 'Personne en double', client_type: 'physique', cin: 'ab123456',
  });
  expectStatus(result, 409);

  const quantityInvoiceInput = {
    clientId: client.id,
    client_type: 'societe',
    numero: 'INT-2026-001',
    lieu: 'Casablanca',
    date: '2026-01-15',
    designation: 'Cafe vert',
    calc_type: 'qte',
    qte_kg: 10,
    pu_ttc: 12,
    mode_paiement: 'Virement bancaire',
  };
  result = await jsonRequest('/api/factures', 'POST', quantityInvoiceInput);
  expectStatus(result, 200);
  const quantityInvoice = result.body;
  assert.equal(quantityInvoice.pt_ttc, 120);
  assert.equal(quantityInvoice.montant_ht, 100);
  assert.equal(quantityInvoice.tva, 20);
  assert.equal(quantityInvoice.ajustement_arrondi, 0);

  result = await jsonRequest('/api/factures', 'POST', quantityInvoiceInput);
  expectStatus(result, 409);

  const totalInvoiceInput = {
    clientId: physicalClient.id,
    client_type: 'physique',
    numero: 'INT-2026-002',
    lieu: 'Rabat',
    date: '2026-02-15',
    designation: 'Cafe moulu',
    calc_type: 'total',
    total_ttc_saisi: 100,
    pu_ttc: 9.7,
    mode_paiement: 'Especes',
  };
  result = await jsonRequest('/api/factures', 'POST', totalInvoiceInput);
  expectStatus(result, 200);
  const totalInvoice = result.body;
  assert.equal(totalInvoice.clientId, physicalClient.id);
  assert.equal(totalInvoice.client_nom_manuel, physicalClient.name);
  assert.equal(totalInvoice.client_cin_manuel, null);
  assert.equal(totalInvoice.qte_kg, 10);
  assert.equal(totalInvoice.pt_ttc, 97);
  assert.equal(totalInvoice.ajustement_arrondi, 3);
  assert.equal(totalInvoice.montant_ht, 83.33);
  assert.equal(totalInvoice.tva, 16.67);

  result = await jsonRequest('/api/factures/export-group', 'POST', {
    ids: [quantityInvoice.id, 999999999], format: 'docx',
  });
  expectStatus(result, 404);

  result = await jsonRequest('/api/factures', 'DELETE', {
    ids: [quantityInvoice.id, 999999999],
  });
  expectStatus(result, 404);
  result = await jsonRequest('/api/factures');
  expectStatus(result, 200);
  assert.ok(result.body.some(invoice => invoice.id === quantityInvoice.id));

  result = await jsonRequest(`/api/factures/${quantityInvoice.id}`, 'PUT', {
    ...quantityInvoiceInput,
    paid: true,
  });
  expectStatus(result, 200);
  assert.equal(result.body.paid, 1);

  result = await jsonRequest(`/api/clients/${client.id}`, 'DELETE');
  expectStatus(result, 409);

  result = await jsonRequest('/api/containers', 'POST', {
    numero: 'MSCU1234567',
    type: '40ft',
    statut: 'En transit',
    fournisseur: 'Fournisseur integration',
    port_depart: 'Dakar',
    port_arrivee: 'Casablanca',
    date_depart: '2026-03-10',
    date_arrivee: '2026-03-01',
  });
  expectStatus(result, 400);

  result = await jsonRequest('/api/containers', 'POST', {
    numero: 'MSCU1234567',
    type: '40ft',
    scelle: 'SC-001',
    statut: 'En transit',
    fournisseur: 'Fournisseur integration',
    port_depart: 'Dakar',
    port_arrivee: 'Casablanca',
    date_depart: '2026-03-01',
    date_arrivee: '2026-03-10',
    nb_sacs: 100,
    poids_total: 6000,
    poids_commande: 6000,
    poids_recu: 5700,
    bl: 'BL-INT-001',
  });
  expectStatus(result, 200);
  const container = result.body;
  assert.equal(container.poids_commande, 6000);
  assert.equal(container.poids_recu, 5700);

  result = await jsonRequest('/api/anomalies');
  expectStatus(result, 200);
  assert.ok(result.body.anomalies.some(anomaly => anomaly.type === 'weight_mismatch' && anomaly.entity_id === container.id));

  const form = new FormData();
  form.append('documents', new Blob(['document integration'], { type: 'text/plain' }), 'preuve.txt');
  result = await request(`/api/containers/${container.id}/documents`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  expectStatus(result, 200);
  assert.equal(result.body.documents.length, 1);
  const document = result.body.documents[0];

  result = await request(`/api/containers/${container.id}/documents/${document.id}/view`, {
    headers: authHeaders(),
  });
  expectStatus(result, 200);
  assert.equal(result.body.toString('utf8'), 'document integration');
  assert.match(result.response.headers.get('content-disposition') || '', /^inline/);

  result = await request(`/api/containers/${container.id}/documents/${document.id}/download`, {
    headers: authHeaders(),
  });
  expectStatus(result, 200);
  assert.equal(result.body.toString('utf8'), 'document integration');
  assert.match(result.response.headers.get('content-disposition') || '', /^attachment/);

  result = await jsonRequest(`/api/containers/${container.id}/documents/${document.id}`, 'DELETE');
  expectStatus(result, 200);
  result = await request(`/api/containers/${container.id}/documents/${document.id}/view`, {
    headers: authHeaders(),
  });
  expectStatus(result, 404);

  result = await jsonRequest('/api/charges', 'POST', {
    date: '2026-01-20', categorie: 'Transport', libelle: 'Charge invalide',
    montant_ht: 50, tva: 10, montant_ttc: 99,
  });
  expectStatus(result, 400);

  const chargeInput = {
    date: '2026-01-20',
    categorie: 'Transport',
    libelle: 'Fret integration',
    montant_ht: 50,
    tva: 10,
    montant_ttc: 60,
    fournisseur: 'Transporteur integration',
    mode_paiement: 'Virement',
    reference: 'CH-INT-001',
    deductible: true,
  };
  result = await jsonRequest('/api/charges', 'POST', chargeInput);
  expectStatus(result, 200);
  const charge = result.body;

  result = await jsonRequest('/api/charges/stats?annee=2026');
  expectStatus(result, 200);
  assert.equal(result.body.total, 60);
  assert.equal(result.body.byCategory[0].categorie, 'Transport');

  result = await jsonRequest(`/api/charges/${charge.id}`, 'PUT', {
    ...chargeInput,
    notes: 'Mise a jour integration',
  });
  expectStatus(result, 200);
  assert.equal(result.body.notes, 'Mise a jour integration');

  result = await jsonRequest('/api/ordres-virement-tva', 'POST', {
    date: '2026-02-30', montant: 500,
  });
  expectStatus(result, 400);
  result = await jsonRequest('/api/ordres-virement-tva', 'POST', {
    date: '2026-02-20', montant: 500, reference: 'TVA-INT', notes: 'Integration',
  });
  expectStatus(result, 200);
  const tvaOrder = result.body;

  result = await jsonRequest('/api/ordres-virement-zizi', 'POST', {
    date: '2026-02-21', montant: 750.25, nom: 'Beneficiaire integration',
    rib: '007640001380700000021864', reference: 'OV-INT', notes: 'Integration',
  });
  expectStatus(result, 200);
  const ziziOrder = result.body;
  assert.equal(ziziOrder.nom, 'Beneficiaire integration');
  assert.equal(ziziOrder.rib, '007640001380700000021864');

  result = await jsonRequest('/api/comptabilite/dashboard?annee=invalid');
  expectStatus(result, 400);
  result = await jsonRequest('/api/comptabilite/tva?annee=2026&trimestre=5');
  expectStatus(result, 400);

  result = await jsonRequest('/api/comptabilite/dashboard?annee=2026');
  expectStatus(result, 200);
  assert.equal(result.body.chiffre_affaires.ht, 183.32999999999998);
  assert.equal(result.body.chiffre_affaires.ttc, 220);
  assert.equal(result.body.charges.ht, 50);
  assert.equal(result.body.creances.impayees, 100);

  result = await jsonRequest('/api/comptabilite/tva?annee=2026&trimestre=1');
  expectStatus(result, 200);
  assert.equal(result.body.tva_ventes.tva, 36.67);
  assert.equal(result.body.tva_achats.tva, 10);
  assert.equal(result.body.tva_a_payer, 26.67);

  result = await jsonRequest('/api/comptabilite/impots?annee=2026');
  expectStatus(result, 200);
  assert.equal(result.body.is.du, 3000);
  assert.equal(result.body.charge_fiscale_totale, 3000);

  result = await jsonRequest('/api/comptabilite/exercices/2026/cloturer', 'POST', {});
  expectStatus(result, 200);
  result = await jsonRequest('/api/comptabilite/exercices/2026/cloturer', 'POST', {});
  expectStatus(result, 200);
  result = await jsonRequest('/api/comptabilite/exercices');
  expectStatus(result, 200);
  assert.equal(result.body.length, 1);
  assert.equal(result.body[0].annee, 2026);
  assert.ok(result.body[0].updated_at);

  if (process.env.TEST_DOCUMENT_EXPORTS === '1') {
    result = await request(`/api/ordres-virement-tva/${tvaOrder.id}/export?format=docx`, {
      headers: authHeaders(),
    });
    expectDocx(result);
    result = await request(`/api/ordres-virement-zizi/${ziziOrder.id}/export?format=docx`, {
      headers: authHeaders(),
    });
    expectDocx(result);
    result = await jsonRequest('/api/invoice/docx', 'POST', {
      client_nom: 'Client integration',
      client_identity: 'ICE : 001122334455667',
      client_adresse: 'Casablanca',
      numero: 'INT-2026-001',
      lieu: 'Casablanca',
      date: '15/01/2026',
      qte_kg: '10',
      designation: 'Cafe vert',
      pu_ttc: '12,00',
      total_ttc: '120,00',
      pt_ttc: '120,00',
      montant_ht: '100,00',
      tva: '20,00',
      pt_ttc_letters: 'cent vingt dirhams',
      mode_paiement: 'Virement bancaire',
      ajustement_arrondi: '0,00',
    });
    expectDocx(result);
    result = await jsonRequest('/api/factures/export-group', 'POST', {
      ids: [quantityInvoice.id, totalInvoice.id], format: 'docx',
    });
    expectDocx(result);
  }

  if (process.env.TEST_PDF_EXPORTS === '1') {
    result = await jsonRequest('/api/invoice', 'POST', {
      client_nom: 'Client integration',
      client_identity: 'ICE : 001122334455667',
      client_adresse: 'Casablanca',
      numero: 'INT-2026-001',
      lieu: 'Casablanca',
      date: '15/01/2026',
      qte_kg: '10',
      designation: 'Cafe vert',
      pu_ttc: '12,00',
      total_ttc: '120,00',
      pt_ttc: '120,00',
      montant_ht: '100,00',
      tva: '20,00',
      pt_ttc_letters: 'cent vingt dirhams',
      mode_paiement: 'Virement bancaire',
      ajustement_arrondi: '0,00',
    });
    expectPdf(result);
    result = await jsonRequest('/api/factures/export-group', 'POST', {
      ids: [quantityInvoice.id, totalInvoice.id], format: 'pdf',
    });
    expectPdf(result);
  }

  result = await jsonRequest('/api/not-a-route');
  expectStatus(result, 404);
});

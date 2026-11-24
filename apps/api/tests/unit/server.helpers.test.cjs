const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const databasePath = path.join(os.tmpdir(), `tradivia-api-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = databasePath;
process.env.ADMIN_DEFAULT_PASSWORD = 'TestPassword123!';
process.env.JWT_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';

const {
  computeFactureAmounts,
  buildInvoiceVarsSrv,
  buildAnomalyReport,
  fiscalEstimate,
  moneyToWords,
  numToWords,
  db
} = require('../../server.cjs');

test.after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(databasePath + suffix, { force: true });
});

test('calcul par quantite refuse les nombres partiellement valides', () => {
  assert.throws(() => computeFactureAmounts('qte', { qte_kg: '12abc', pu_ttc: 10 }), /quantite/i);
});

test('calcul par total conserve le TTC saisi avec ajustement', () => {
  assert.deepEqual(computeFactureAmounts('total', { total_ttc_saisi: 125, pu_ttc: 12 }), {
    qte_kg: 10,
    pu_ttc: 12,
    pt_ttc: 120,
    montant_ht: 104.17,
    tva: 20.83,
    ajustement_arrondi: 5,
    total_ttc_saisi: 125
  });
});

test('variables facture incluent les alias du modele legacy', () => {
  const vars = buildInvoiceVarsSrv({
    client_type: 'societe', numero: 'F-1', date: '2026-01-01', pt_ttc: 120,
    ajustement_arrondi: 0, montant_ht: 100, tva: 20, qte_kg: 10, pu_ttc: 12
  }, { name: 'Client Test', ice: '123', address: 'Adresse' });
  assert.deepEqual(vars.client, { name: 'Client Test', ice: '123', address: 'Adresse' });
});

test('montants en lettres respectent les accords et les centimes', () => {
  assert.equal(numToWords(80), 'quatre-vingts');
  assert.equal(numToWords(81), 'quatre-vingt-un');
  assert.equal(numToWords(100), 'cent');
  assert.equal(numToWords(201), 'deux cent un');
  assert.equal(moneyToWords(1200.25), 'mille deux cents dirhams et vingt-cinq centimes');
});

test('estimation fiscale utilise le CA hors taxe et les bornes CSS exactes', () => {
  assert.equal(fiscalEstimate(2_000_000, 0).cmCalculee, 5_000);
  assert.equal(fiscalEstimate(6_000_000, 4_999_999).tauxCss, 1.5);
  assert.equal(fiscalEstimate(6_000_000, 5_000_000).tauxCss, 2.5);
  assert.equal(fiscalEstimate(12_000_000, 10_000_000).tauxCss, 3.5);
  assert.equal(fiscalEstimate(48_000_000, 40_000_000).tauxCss, 5);
});

test('detection des anomalies couvre factures, poids, identifiants, RIB et charges', () => {
  const report = buildAnomalyReport({
    factures: [
      { id: 1, clientId: 1, numero: 'F-1', date: '2026-01-01', designation: 'Cafe A', pu_ttc: 10, pt_ttc: 120, ajustement_arrondi: 0, tva: 20 },
      { id: 2, clientId: 1, numero: 'F-2', date: '2026-01-01', designation: 'Cafe A', pu_ttc: 10, pt_ttc: 120, ajustement_arrondi: 0, tva: 20 },
      { id: 3, clientId: 2, numero: 'F-3', date: '2026-01-02', designation: 'Cafe A', pu_ttc: 30, pt_ttc: 300, ajustement_arrondi: 0, tva: 50 },
      { id: 4, clientId: 3, numero: 'F-4', date: '2026-01-03', designation: 'Cafe B', pu_ttc: 12, pt_ttc: 120, ajustement_arrondi: 0, tva: 10 },
    ],
    clients: [
      { id: 1, name: 'Societe test', client_type: 'societe', ice: '123' },
      { id: 2, name: 'Personne test', client_type: 'physique', cin: '???' },
    ],
    containers: [{ id: 1, numero: 'CONT-1', poids_commande: 1000, poids_recu: 900 }],
    charges: [
      { id: 1, categorie: 'Transport', libelle: 'C1', montant_ttc: 100 },
      { id: 2, categorie: 'Transport', libelle: 'C2', montant_ttc: 110 },
      { id: 3, categorie: 'Transport', libelle: 'C3', montant_ttc: 1000 },
    ],
    ordres: [{ id: 1, nom: 'Beneficiaire', rib: '12345' }],
  });

  const types = new Set(report.anomalies.map(item => item.type));
  for (const type of ['duplicate_invoice', 'price_outlier', 'vat_mismatch', 'weight_mismatch', 'suspicious_identity', 'suspicious_bank_account', 'unusual_charge']) {
    assert.ok(types.has(type), `type manquant: ${type}`);
  }
  assert.equal(report.summary.total, report.anomalies.length);
  assert.ok(report.summary.critical >= 3);
});

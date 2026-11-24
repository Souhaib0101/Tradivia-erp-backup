// Add fictional screenshot data without replacing existing business records.
const fs = require('fs');
const path = require('path');
const { db } = require('../apps/api/server.cjs');
const round = n => Math.round(n * 100) / 100;

async function main() {
  const dir = path.resolve(__dirname, '../output/backups');
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, `before-screenshots-${Date.now()}.db`);
  await db.backup(backup);
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const date = (m, d) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const names = ['Atlas Torréfaction', 'Café des Orangers', 'Riad Andalou', 'Comptoir du Souss', 'Maison du Café', 'Horizon Distribution', 'Les Jardins de Fès', 'Bistro de la Corniche', 'Nour Alimentation', 'Saveurs du Rif', 'Amine Démo', 'Salma Démo'];
  const cities = ['Casablanca', 'Rabat', 'Marrakech', 'Agadir', 'Tanger', 'Fès'];
  db.transaction(() => {
    const ids = names.map((name, i) => {
      const email = `demo${i + 1}@example.com`;
      const existing = db.prepare('SELECT id FROM clients WHERE email = ?').get(email);
      if (existing) return existing.id;
      return db.prepare('INSERT INTO clients (name,client_type,ice,cin,address,phone,email) VALUES (?,?,?,?,?,?,?)').run(
        name, i < 10 ? 'societe' : 'physique', i < 10 ? `00000000000${String(i + 1).padStart(4, '0')}` : null,
        i >= 10 ? `DEMO${i}` : null, `${12 + i * 7}, avenue des Orangers, ${cities[i % 6]}`, '', email
      ).lastInsertRowid;
    });
    for (let m = 1; m <= month; m++) {
      for (let j = 0; j < 6; j++) {
        const i = (m + j) % ids.length;
        const qty = 450 + m * 85 + j * 170;
        const price = [42, 48, 56, 64][j % 4];
        const total = round(qty * price), vat = round(total / 6);
        db.prepare(`INSERT OR IGNORE INTO factures (clientId,numero,lieu,date,qte_kg,designation,pu_ttc,pt_ttc,montant_ht,tva,paid,client_type,calc_type,mode_paiement,ajustement_arrondi)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`).run(ids[i], `DEMO-${year}-${String(m * 100 + j + 1).padStart(4, '0')}`, cities[i % 6], date(m, 2 + j * 2), qty,
          ['Café vert Robusta — Vietnam', 'Café vert Arabica — Brésil', 'Café Arabica — Colombie', 'Café vert Santos — Brésil'][j % 4], price, total, round(total - vat), vat,
          m < month - 1 || j % 3 !== 0 ? 1 : 0, i < 10 ? 'societe' : 'physique', 'qte', ['Virement', 'Chèque', 'Espèces'][j % 3]);
      }
      const expenses = [ ['Fournitures', 'Achat de café vert', 88000 + m * 2200, 'Origines Café Export', .2], ['Logistique', 'Transport et manutention', 14500 + m * 400, 'Atlas Logistique', .2], ['Salaires', 'Salaires du personnel', 28000, 'Personnel', 0], ['Loyer', 'Loyer entrepôt', 9500, 'Immobilier Horizon', .2], ['Charges sociales', 'Cotisations sociales', 7200, 'CNSS', 0] ];
      expenses.forEach(([cat, label, ht, supplier, rate], j) => {
        const ref = `DEMO-CH-${year}-${m}-${j}`;
        if (db.prepare('SELECT id FROM charges WHERE reference=?').get(ref)) return;
        db.prepare('INSERT INTO charges (date,categorie,libelle,montant_ht,tva,montant_ttc,fournisseur,mode_paiement,reference,deductible,notes) VALUES (?,?,?,?,?,?,?,?,?,1,?)').run(date(m, 2 + j * 2),cat,label,ht,round(ht * rate),round(ht * (1 + rate)),supplier,'Virement',ref,'Donnée fictive pour captures d’écran');
      });
    }
    for (let i = 0; i < 8; i++) {
      const status = ['Livré', 'Livré', 'Livré', 'Arrivé', 'Dédouanement', 'En transit', 'En transit', 'En transit'][i];
      const weight = 19200 + i * 300;
      db.prepare(`INSERT OR IGNORE INTO containers (numero,type,scelle,statut,fournisseur,port_depart,port_arrivee,date_depart,date_arrivee,nb_sacs,poids_total,poids_commande,poids_recu,bl,facture_commerciale)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`DEMO${String(i + 1).padStart(7, '0')}`, '40ft', `SC-DEMO-${100 + i}`, status,
        ['Santos Coffee Export', 'Mekong Beans', 'Andes Café'][i % 3], ['Santos', 'Hô Chi Minh', 'Cartagena'][i % 3], i % 2 ? 'Tanger Med' : 'Casablanca', date(Math.max(1, month - 2), 3 + i), date(month, 5 + i * 3), weight / 60, weight, weight, status === 'Livré' ? weight : null, `BL-DEMO-${year}-${i + 1}`, `FC-DEMO-${year}-${i + 1}`);
    }
  })();
  console.log('Backup:', backup);
  for (const table of ['clients', 'factures', 'containers', 'charges']) console.log(table, db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total);
  console.log('Integrity:', db.pragma('integrity_check'));
  console.log('Foreign keys:', db.pragma('foreign_key_check'));
  db.close();
}
main().catch(error => { console.error(error); db.close(); process.exitCode = 1; });

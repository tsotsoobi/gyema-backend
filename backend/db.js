const { Low, JSONFile } = require('lowdb');
const path = require('path');

const adapter = new JSONFile(path.join(__dirname, 'gyema.json'));
const db = new Low(adapter);

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function seedJobs() {
  if (db.data.jobs.length > 0) return;
  db.data.jobs.push(
    { id: 'GYM-00012A', title: 'Documents to Kumasi',    desc: 'A4 envelope, lightweight documents',    from: 'Accra',  to: 'Kumasi',  size: 'Small',  deadline: daysFromNow(7),  pi: 4.5,  status: 'open', sender: 'Kofi.A',  rating: 4.8 },
    { id: 'GYM-00034B', title: 'Clothing Bundle',        desc: 'Medium bag of clothing items',          from: 'Accra',  to: 'Takoradi',size: 'Medium', deadline: daysFromNow(9),  pi: 7.0,  status: 'open', sender: 'Ama.B',   rating: 5.0 },
    { id: 'GYM-00056C', title: 'Electronics — Tamale',   desc: 'Small electronics device (insured)',    from: 'Kumasi', to: 'Tamale',  size: 'Small',  deadline: daysFromNow(12), pi: 12.5, status: 'open', sender: 'Kweku.M', rating: 4.6 }
  );
  console.log('Seeded 3 sample jobs');
}

async function initDb() {
  await db.read();
  db.data = db.data || { payments: [], jobs: [] };
  seedJobs();
  await db.write();
  console.log('JSON database ready → gyema.json');
}

// ── Payment helpers ───────────────────────────────────────────────────────────

const payments = {
  upsert(record) {
    const idx = db.data.payments.findIndex(p => p.payment_id === record.payment_id);
    const now = new Date().toISOString();
    if (idx >= 0) {
      db.data.payments[idx] = { ...db.data.payments[idx], ...record, updated_at: now };
    } else {
      db.data.payments.push({
        id: db.data.payments.length + 1,
        status: 'pending',
        txid: null,
        created_at: now,
        updated_at: now,
        ...record,
      });
    }
  },

  update(payment_id, fields) {
    const idx = db.data.payments.findIndex(p => p.payment_id === payment_id);
    if (idx >= 0) {
      db.data.payments[idx] = {
        ...db.data.payments[idx],
        ...fields,
        updated_at: new Date().toISOString(),
      };
    }
  },

  find(payment_id) {
    return db.data.payments.find(p => p.payment_id === payment_id) || null;
  },
};

module.exports = { db, initDb, payments };

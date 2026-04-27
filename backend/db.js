const { Low, JSONFile } = require('lowdb');
const path = require('path');

const adapter = new JSONFile(path.join(__dirname, 'gyema.json'));
const db = new Low(adapter);

async function initDb() {
  await db.read();
  db.data = db.data || { payments: [], jobs: [] };
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

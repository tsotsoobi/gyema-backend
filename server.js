require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const path    = require('path');
const { db, initDb, payments } = require('./db');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());   // handle preflight for all routes
app.use(express.json());

const PI_API_KEY  = process.env.PI_API_KEY;
const PI_API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com/v2';
const PORT        = process.env.PORT || 3001;

if (!PI_API_KEY || PI_API_KEY === 'your_sandbox_api_key_here') {
  console.warn('WARNING: PI_API_KEY is not set in .env — Pi API calls will fail.');
}

// ── POST /payments/approve ───────────────────────────────────────────────────
// Called by frontend's onReadyForServerApproval(paymentId).
// Stores the payment record then tells Pi to approve it so the SDK can proceed.
app.post('/payments/approve', async (req, res) => {
  const { paymentId, jobId, amount, memo } = req.body;
  if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });

  await db.read();
  payments.upsert({ payment_id: paymentId, job_id: jobId || null, amount: amount || null, memo: memo || null });
  await db.write();

  try {
    const { data } = await axios.post(
      `${PI_API_BASE}/payments/${paymentId}/approve`,
      {},
      { headers: { Authorization: `Key ${PI_API_KEY}` } }
    );

    await db.read();
    payments.update(paymentId, { status: 'approved' });
    await db.write();

    console.log(`[approve] ${paymentId} ✓`);
    res.json({ ok: true, payment: data });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error(`[approve] ${paymentId} failed:`, detail);
    await db.read();
    payments.update(paymentId, { status: 'error' });
    await db.write();
    res.status(502).json({ error: 'Pi approval failed', detail });
  }
});

// ── POST /payments/complete ──────────────────────────────────────────────────
// Called by frontend's onReadyForServerCompletion(paymentId, txid).
// Passes the blockchain txid to Pi so the payment is finalized.
app.post('/payments/complete', async (req, res) => {
  const { paymentId, txid } = req.body;
  if (!paymentId || !txid) {
    return res.status(400).json({ error: 'paymentId and txid are required' });
  }

  try {
    const { data } = await axios.post(
      `${PI_API_BASE}/payments/${paymentId}/complete`,
      { txid },
      { headers: { Authorization: `Key ${PI_API_KEY}` } }
    );

    await db.read();
    payments.update(paymentId, { status: 'completed', txid });
    await db.write();

    console.log(`[complete] ${paymentId} txid=${txid} ✓`);
    res.json({ ok: true, payment: data });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error(`[complete] ${paymentId} failed:`, detail);
    res.status(502).json({ error: 'Pi completion failed', detail });
  }
});

// ── GET /jobs/seed ───────────────────────────────────────────────────────────
// Call this manually once to populate the database with 3 sample jobs.
// No-ops if jobs already exist.
app.get('/jobs/seed', async (req, res) => {
  await db.read();
  if (db.data.jobs.length > 0) {
    return res.json({ ok: true, message: 'Jobs already exist, skipping seed.', count: db.data.jobs.length });
  }
  const daysFromNow = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  db.data.jobs.push(
    { id: 'GYM-00012A', title: 'Documents to Kumasi', desc: 'A4 envelope, lightweight documents', from: 'Accra',  to: 'Kumasi',   size: 'Small',  deadline: daysFromNow(7),  pi: 4.5,  status: 'open', sender: 'Kofi.A',  rating: 4.8 },
    { id: 'GYM-00034B', title: 'Clothing Bundle',      desc: 'Medium bag of clothing items',       from: 'Accra',  to: 'Takoradi', size: 'Medium', deadline: daysFromNow(9),  pi: 7.0,  status: 'open', sender: 'Ama.B',   rating: 5.0 },
    { id: 'GYM-00056C', title: 'Electronics — Tamale', desc: 'Small electronics device (insured)', from: 'Kumasi', to: 'Tamale',   size: 'Small',  deadline: daysFromNow(12), pi: 12.5, status: 'open', sender: 'Kweku.M', rating: 4.6 }
  );
  await db.write();
  console.log('[seed] 3 sample jobs inserted');
  res.json({ ok: true, message: 'Seeded 3 sample jobs.', jobs: db.data.jobs });
});

// ── GET /jobs ────────────────────────────────────────────────────────────────
// Returns all open jobs. Injects a default steps array for any job that was
// seeded without one, so the tracking view always has data to render.
const DEFAULT_STEPS = [
  { label: 'Posted',                done: true,  active: false, time: '' },
  { label: 'Traveller Accepted',    done: false, active: true,  time: '' },
  { label: 'Picked Up',             done: false, active: false, time: '' },
  { label: 'In Transit',            done: false, active: false, time: '' },
  { label: 'Delivered & Confirmed', done: false, active: false, time: '' },
];

app.get('/jobs', async (req, res) => {
  await db.read();
  const open = db.data.jobs
    .filter(j => j.status === 'open')
    .map(j => ({ ...j, steps: j.steps || DEFAULT_STEPS }));
  res.json(open);
});

// ── GET /payments/:paymentId ─────────────────────────────────────────────────
// Convenience endpoint to inspect a stored payment's status.
app.get('/payments/:paymentId', async (req, res) => {
  await db.read();
  const payment = payments.find(req.params.paymentId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
});

// ── GET / ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── GET /validation-key.txt ──────────────────────────────────────────────────
app.get('/validation-key.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'validation-key.txt'));
});

// ── Boot ─────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => console.log(`Gyema backend → http://localhost:${PORT}`));
});

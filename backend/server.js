require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const { db, initDb, payments } = require('./db');

const app = express();
app.use(cors());
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

// ── Boot ─────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => console.log(`Gyema backend → http://localhost:${PORT}`));
});

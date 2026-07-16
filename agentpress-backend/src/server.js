import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { handleIncoming } from './router.js';
import { releaseInvoice } from './skills/invoicing.js';
import { query } from './db.js';
import { runDeployment, getOnboardingStatus, publishServiceListing } from './onboarding.js';
import { generateManifest, getLatestManifest } from './manifest.js';

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Console CRUD routes — creating and configuring an agent before deploy.
// ---------------------------------------------------------------------------

// Master skill catalog, for the console's Skills picker screen.
app.get('/skills', async (req, res) => {
  const skills = await query(`SELECT * FROM skills WHERE active = true ORDER BY category, name`);
  res.json(skills);
});

// Create the business record (first thing the console needs before an agent).
app.post('/businesses', async (req, res) => {
  const { name, business_type, owner_email, owner_phone } = req.body;
  const [business] = await query(
    `INSERT INTO businesses (name, business_type, owner_email, owner_phone) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, business_type || null, owner_email || null, owner_phone || null]
  );
  res.json(business);
});

// Create a draft agent under a business.
app.post('/agents', async (req, res) => {
  const { business_id, template_id, name, description } = req.body;
  const [agent] = await query(
    `INSERT INTO agents (business_id, template_id, name, description) VALUES ($1,$2,$3,$4) RETURNING *`,
    [business_id, template_id || null, name, description || null]
  );
  res.json(agent);
});

// Update name/description on a draft (or already-live) agent.
app.patch('/agents/:id', async (req, res) => {
  const { name, description } = req.body;
  const [agent] = await query(
    `UPDATE agents SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *`,
    [name, description, req.params.id]
  );
  if (!agent) return res.status(404).json({ error: 'agent not found' });
  res.json(agent);
});

// Full detail for the Preview screen and for resuming a build in progress.
app.get('/agents/:id', async (req, res) => {
  const [agent] = await query(`SELECT * FROM agents WHERE id = $1`, [req.params.id]);
  if (!agent) return res.status(404).json({ error: 'agent not found' });

  const skills = await query(
    `SELECT s.id, s.name, s.category, ags.config FROM agent_skills ags
     JOIN skills s ON s.id = ags.skill_id WHERE ags.agent_id = $1 AND ags.status = 'active'`,
    [agent.id]
  );
  const [guardrails] = await query(`SELECT * FROM guardrails WHERE agent_id = $1`, [agent.id]);

  res.json({ ...agent, skills, guardrails: guardrails || null });
});

// Replace the full set of active skills + their config in one call — the
// console sends this once, at "Review deployment".
app.put('/agents/:id/skills', async (req, res) => {
  const { skills } = req.body; // [{ skill_id, config }]
  const agentId = req.params.id;

  await query(`DELETE FROM agent_skills WHERE agent_id = $1`, [agentId]);
  for (const s of skills) {
    await query(
      `INSERT INTO agent_skills (agent_id, skill_id, config) VALUES ($1,$2,$3)`,
      [agentId, s.skill_id, JSON.stringify(s.config || {})]
    );
  }

  const rows = await query(`SELECT skill_id, config FROM agent_skills WHERE agent_id = $1`, [agentId]);
  res.json(rows);
});

// Upsert guardrails for an agent.
app.put('/agents/:id/guardrails', async (req, res) => {
  const agentId = req.params.id;
  const {
    max_spend_per_transaction = 0,
    max_spend_per_day = 0,
    require_approval_above = null,
    allowed_actions = [],
    blocked_actions = [],
  } = req.body;

  const [row] = await query(
    `INSERT INTO guardrails (agent_id, max_spend_per_transaction, max_spend_per_day, require_approval_above, allowed_actions, blocked_actions)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (agent_id) DO UPDATE SET
       max_spend_per_transaction = $2, max_spend_per_day = $3, require_approval_above = $4,
       allowed_actions = $5, blocked_actions = $6, updated_at = now()
     RETURNING *`,
    [agentId, max_spend_per_transaction, max_spend_per_day, require_approval_above, allowed_actions, blocked_actions]
  );
  res.json(row);
});

// Orders for the Live dashboard's ticket list, joined with customer info.
app.get('/agents/:id/orders', async (req, res) => {
  const orders = await query(
    `SELECT o.*, c.display_name AS customer_name, c.contact_value AS customer_contact
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.agent_id = $1 ORDER BY o.created_at DESC`,
    [req.params.id]
  );
  res.json(orders);
});

// ---------------------------------------------------------------------------
// Publish-as-service bridge — turning a private skill into a public,
// priced OKX AI listing. Defaults to A2MCP (flat price, no negotiation)
// per the decision to skip negotiation entirely.
// ---------------------------------------------------------------------------

// List all services published (or drafted) for an agent, with rating summary.
app.get('/agents/:id/services', async (req, res) => {
  const services = await query(
    `SELECT s.*,
            COALESCE(AVG(r.rating), 0) AS rating_avg,
            COUNT(r.id) AS rating_count
     FROM services s LEFT JOIN reviews r ON r.service_id = s.id
     WHERE s.agent_id = $1
     GROUP BY s.id ORDER BY s.created_at DESC`,
    [req.params.id]
  );
  res.json(services);
});

// Create a service from a skill — the actual "Publish as service" action.
app.post('/agents/:id/services', async (req, res) => {
  const {
    source_skill_id,
    name,
    description,
    price,
    currency = 'USDG',
    pricing_model = 'fixed',
    service_type = 'A2MCP',
    category_tags = [],
  } = req.body;

  const [service] = await query(
    `INSERT INTO services (agent_id, source_skill_id, name, description, price, currency, pricing_model, service_type, category_tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.params.id, source_skill_id || null, name, description || null, price, currency, pricing_model, service_type, category_tags]
  );
  res.json(service);
});

// Publish an already-created service to OKX AI (mocked — see onboarding.js
// for the same real-vs-mock caveat as the rest of the deploy flow).
app.post('/services/:id/publish', async (req, res) => {
  try {
    const result = await publishServiceListing(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Reviews for a service — read-only for now; real reviews only come from
// actual OKX AI hires, nothing to mock meaningfully here yet.
app.get('/services/:id/reviews', async (req, res) => {
  const reviews = await query(`SELECT * FROM reviews WHERE service_id = $1 ORDER BY created_at DESC`, [req.params.id]);
  res.json(reviews);
});

// ---------------------------------------------------------------------------
// Runtime routes (unchanged from before)
// ---------------------------------------------------------------------------

// Incoming customer message — called by whatever front-end the customer is
// using (OKX AI Marketplace webhook, or a hosted chat page), and by the
// console's "Simulate incoming order" button for the demo.
app.post('/webhook/message', async (req, res) => {
  const { agentId, customerContact, intentSkillId, payload } = req.body;
  try {
    const result = await handleIncoming({ agentId, customerContact, intentSkillId, payload });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Owner marks an order fulfilled from the console dashboard.
app.post('/orders/:id/fulfill', async (req, res) => {
  const { id } = req.params;
  const { agentId } = req.body;

  const [order] = await query(
    `UPDATE orders SET status='fulfilled', fulfilled_at=now() WHERE id=$1 RETURNING *`,
    [id]
  );
  if (!order) return res.status(404).json({ error: 'order not found' });

  const [invoice] = await query(`SELECT * FROM invoices WHERE order_id = $1`, [id]);
  if (invoice && invoice.status === 'escrowed') {
    await releaseInvoice(invoice.id, agentId);
  }

  res.json({ order, invoiceReleased: !!invoice });
});

// Customer self-service data access — issues a magic-link token, 24h expiry.
app.post('/data-requests', async (req, res) => {
  const { customerId, businessId, requestType } = req.body;
  const token = crypto.randomBytes(24).toString('hex');

  await query(
    `INSERT INTO customer_data_requests (customer_id, business_id, request_type, access_token, token_expires_at)
     VALUES ($1,$2,$3,$4, now() + interval '24 hours')`,
    [customerId, businessId, requestType, token]
  );

  res.json({ link: `${process.env.PUBLIC_URL}/my-data/${token}` });
});

// Resolve a data-access token — view/export/delete, no login required.
app.get('/my-data/:token', async (req, res) => {
  const [request] = await query(
    `SELECT * FROM customer_data_requests WHERE access_token = $1 AND token_expires_at > now() AND status = 'pending'`,
    [req.params.token]
  );
  if (!request) return res.status(404).json({ error: 'invalid or expired link' });

  if (request.request_type === 'delete') {
    await query(`DELETE FROM agent_memory WHERE customer_id = $1`, [request.customer_id]);
    await query(`UPDATE customer_data_requests SET status='fulfilled', fulfilled_at=now() WHERE id=$1`, [request.id]);
    return res.json({ deleted: true });
  }

  const memory = await query(`SELECT * FROM agent_memory WHERE customer_id = $1`, [request.customer_id]);
  const orders = await query(`SELECT * FROM orders WHERE customer_id = $1`, [request.customer_id]);

  await query(`UPDATE customer_data_requests SET status='fulfilled', fulfilled_at=now() WHERE id=$1`, [request.id]);
  res.json({ memory, orders });
});

// Triggered by the console's "Deploy agent" button. Runs the full checklist:
// Onchain OS -> Agentic Wallet -> Identity -> Manifest -> OKX user -> listing.
app.post('/agents/:id/deploy', async (req, res) => {
  try {
    const result = await runDeployment(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Console polls this to render the onboarding checklist (step-by-step status).
app.get('/agents/:id/onboarding', async (req, res) => {
  const steps = await getOnboardingStatus(req.params.id);
  res.json({ steps });
});

// Manually regenerate the manifest — e.g. after the owner edits services or
// guardrails on an already-live agent.
app.post('/agents/:id/manifest', async (req, res) => {
  try {
    const manifest = await generateManifest(req.params.id);
    res.json(manifest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Console's Preview screen renders whatever this returns.
app.get('/agents/:id/manifest', async (req, res) => {
  const manifest = await getLatestManifest(req.params.id);
  if (!manifest) return res.status(404).json({ error: 'no manifest generated yet' });
  res.json(manifest);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AgentPress backend listening on ${port}`));

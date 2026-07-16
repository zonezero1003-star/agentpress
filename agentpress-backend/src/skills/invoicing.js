import { query } from '../db.js';

// --- MOCK — replace with real settlement calls once confirmed. Per OKX's --
// --- actual APP whitepaper (web3.okx.com/whitepaper/okx-app-whitepaper.pdf)
// --- Agent Payments Protocol (APP) is real, with Buyer/Broker/Seller roles -
// --- and a challenge/credential/receipt wire format. APP composes with, ---
// --- rather than replaces, x402 — x402 handles the single HTTP 402 round- -
// --- trip (that's what A2MCP endpoints use, via OKX's Payment API/SDK), ---
// --- while APP extends further for negotiated, escrow-based relationships -
// --- (that's this file — Invoicing is an A2A task, not A2MCP). Settlement -
// --- is on X Layer, in USDT/USDG/USDC. ------------------------------------
async function createAppQuote({ amount, currency }) {
  return { app_reference: `MOCK-QUOTE-${Date.now()}` };
}
async function releaseAppEscrow({ app_reference }) {
  return { released: true };
}
// ---------------------------------------------------------------------------

export async function createInvoice({ agent, business, customer, order, amount, currency, escrow }) {
  const quote = await createAppQuote({ amount, currency });

  const [invoice] = await query(
    `INSERT INTO invoices (order_id, business_id, customer_id, amount, currency, escrow_enabled, status, app_reference)
     VALUES ($1,$2,$3,$4,$5,$6,'sent',$7) RETURNING *`,
    [order?.id || null, business.id, customer.id, amount, currency, escrow, quote.app_reference]
  );

  await query(
    `INSERT INTO escrow_events (agent_id, invoice_id, event_type, payload) VALUES ($1,$2,'quote',$3)`,
    [agent.id, invoice.id, JSON.stringify(quote)]
  );

  return invoice;
}

export async function releaseInvoice(invoiceId, agentId) {
  const [invoice] = await query(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
  if (!invoice) throw new Error('invoice not found');

  await releaseAppEscrow({ app_reference: invoice.app_reference });

  await query(`UPDATE invoices SET status = 'released', released_at = now() WHERE id = $1`, [invoiceId]);
  await query(
    `INSERT INTO escrow_events (agent_id, invoice_id, event_type, payload) VALUES ($1,$2,'settlement_released','{}')`,
    [agentId, invoiceId]
  );
}

// Router entry point for chat messages. Invoicing is mostly triggered by
// order events (see server.js /orders/:id/fulfill), not conversation, so this
// just handles someone asking about their invoice mid-chat.
export async function handle({ payload }) {
  return { reply: "Invoicing runs automatically after your order — nothing to set up here." };
}

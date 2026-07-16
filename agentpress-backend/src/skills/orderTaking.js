import { query } from '../db.js';
import { notifyOwner } from '../notify.js';

// This expects `payload.items` to already be structured (e.g. extracted by an
// LLM tool-call step upstream, or filled via a simple order form). Swapping in
// real NLU/tool-calling later doesn't change anything below this line.
export async function handle({ agent, business, customer, config, payload }) {
  const { items, shippingAddress } = payload;

  if (!items || items.length === 0) {
    const catalogLine = config.catalog ? ` We have: ${config.catalog}` : '';
    return { reply: `What would you like to order?${catalogLine}` };
  }

  const [order] = await query(
    `INSERT INTO orders (business_id, agent_id, customer_id, items, fulfillment_mode, shipping_address, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'notified') RETURNING *`,
    [business.id, agent.id, customer.id, JSON.stringify(items), config.fulfillment || 'manual', shippingAddress || null]
  );

  await query(
    `INSERT INTO audit_log (agent_id, actor, action, details) VALUES ($1, 'agent', 'order_created', $2)`,
    [agent.id, JSON.stringify({ order_id: order.id })]
  );

  await notifyOwner({
    business,
    order,
    channel: config.notifyVia || 'dashboard',
    message: `New order #${order.id.slice(0, 8)} from ${customer.display_name || 'a customer'}: ${items
      .map((i) => `${i.qty}x ${i.name}`)
      .join(', ')}`,
  });

  if (config.fulfillment === 'auto') {
    return {
      reply: 'Order received! Confirming and sending your invoice now.',
      orderId: order.id,
    };
  }

  return {
    reply: `Got it — order #${order.id.slice(0, 8)} sent to the team. They'll be in touch about shipping.`,
    orderId: order.id,
  };
}

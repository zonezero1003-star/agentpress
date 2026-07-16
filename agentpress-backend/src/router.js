import { query } from './db.js';
import * as orderTaking from './skills/orderTaking.js';
import * as invoicing from './skills/invoicing.js';
import * as generic from './skills/generic.js';

const HANDLERS = {
  orders: orderTaking,
  invoicing,
  support: generic,
  books: generic,
  scheduling: generic,
  supplier: generic,
  marketing: generic,
  reputation: generic,
};

// One shared process routes every deployed agent by agent_id — this is the
// "shared, not isolated" decision. Swapping to per-agent isolation later just
// means running N copies of this same function behind a queue; nothing about
// the logic below has to change.
export async function handleIncoming({ agentId, customerContact, intentSkillId, payload }) {
  const [agent] = await query(`SELECT * FROM agents WHERE id = $1 AND status = 'live'`, [agentId]);
  if (!agent) return { error: 'agent not found or not live' };

  const [business] = await query(`SELECT * FROM businesses WHERE id = $1`, [agent.business_id]);

  let [customer] = await query(
    `SELECT * FROM customers WHERE business_id = $1 AND contact_value = $2`,
    [business.id, customerContact]
  );
  if (!customer) {
    [customer] = await query(
      `INSERT INTO customers (business_id, contact_value, contact_channel) VALUES ($1,$2,$3) RETURNING *`,
      [business.id, customerContact, payload.channel || 'whatsapp']
    );
  }

  const activeSkills = await query(
    `SELECT skill_id, config FROM agent_skills WHERE agent_id = $1 AND status = 'active'`,
    [agentId]
  );
  const skillIds = activeSkills.map((s) => s.skill_id);

  if (!skillIds.includes(intentSkillId)) {
    return { reply: "Sorry, that's not something I can help with right now." };
  }

  const [guardrails] = await query(`SELECT * FROM guardrails WHERE agent_id = $1`, [agentId]);
  const skillConfig = activeSkills.find((s) => s.skill_id === intentSkillId)?.config || {};

  // Guardrail check applies only to skills that can move money.
  if (['invoicing', 'supplier'].includes(intentSkillId) && guardrails) {
    const amount = payload.amount || 0;
    const cap = guardrails.max_spend_per_transaction;
    if (amount > 0 && (cap === 0 || amount > cap)) {
      return { reply: "That amount needs the owner's approval before I can go ahead." };
    }
  }

  const handler = HANDLERS[intentSkillId];
  if (!handler) return { reply: "That skill isn't wired up yet." };

  return handler.handle({ agent, business, customer, config: skillConfig, skillId: intentSkillId, payload });
}

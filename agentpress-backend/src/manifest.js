import { query } from './db.js';

// Builds the JSON that gets published to OKX AI. Called once during deploy
// (see onboarding.js) and again any time the owner edits services/guardrails
// after going live — each call adds a new version rather than overwriting.
export async function generateManifest(agentId) {
  const [agent] = await query(`SELECT * FROM agents WHERE id = $1`, [agentId]);
  if (!agent) throw new Error('agent not found');

  const [business] = await query(`SELECT * FROM businesses WHERE id = $1`, [agent.business_id]);

  const skills = await query(
    `SELECT s.id, s.name, s.category, ags.config
     FROM agent_skills ags JOIN skills s ON s.id = ags.skill_id
     WHERE ags.agent_id = $1 AND ags.status = 'active'`,
    [agentId]
  );

  const services = await query(
    `SELECT s.name, s.description, s.price, s.currency, s.pricing_model, s.service_type, s.category_tags, s.sold_count,
            COALESCE(AVG(r.rating), 0) AS rating_avg, COUNT(r.id) AS rating_count
     FROM services s LEFT JOIN reviews r ON r.service_id = s.id
     WHERE s.agent_id = $1 AND s.active = true
     GROUP BY s.id`,
    [agentId]
  );

  const [guardrails] = await query(`SELECT * FROM guardrails WHERE agent_id = $1`, [agentId]);

  const manifest = {
    name: agent.name,
    description: agent.description,
    business: business.name,
    network: agent.network,
    skills: skills.map((s) => ({ id: s.id, name: s.name, category: s.category, config: s.config })),
    services: services.map((s) => ({
      name: s.name,
      description: s.description,
      price: s.price,
      currency: s.currency,
      pricing_model: s.pricing_model,
      service_type: s.service_type,
      tags: s.category_tags,
      sold_count: s.sold_count,
      rating: { avg: Number(s.rating_avg), count: Number(s.rating_count) },
    })),
    guardrails: guardrails
      ? {
          max_spend_per_transaction: guardrails.max_spend_per_transaction,
          max_spend_per_day: guardrails.max_spend_per_day,
          require_approval_above: guardrails.require_approval_above,
          allowed_actions: guardrails.allowed_actions,
          blocked_actions: guardrails.blocked_actions,
        }
      : null,
    endpoints: {
      webhook: `${process.env.PUBLIC_URL}/webhook/message`,
    },
  };

  const [{ next_version }] = await query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM agent_manifests WHERE agent_id = $1`,
    [agentId]
  );

  const [row] = await query(
    `INSERT INTO agent_manifests (agent_id, version, manifest) VALUES ($1, $2, $3) RETURNING *`,
    [agentId, next_version, JSON.stringify(manifest)]
  );

  return row;
}

export async function getLatestManifest(agentId) {
  const [row] = await query(
    `SELECT * FROM agent_manifests WHERE agent_id = $1 ORDER BY version DESC LIMIT 1`,
    [agentId]
  );
  return row;
}

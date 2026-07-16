import crypto from 'crypto';
import { query } from './db.js';
import { generateManifest, getLatestManifest } from './manifest.js';

const STEPS = [
  'install_onchain_os',
  'log_in_agentic_wallet',
  'register_identity',
  'generate_manifest',
  'register_as_asp',
  'list_on_marketplace',
];

// --- MOCK — replace each of these with real calls once confirmed. Unlike a --
// --- typical SDK integration, OKX.AI's actual onboarding (per okx.ai/------
// --- tutorial/asp) is CONVERSATIONAL: a human runs a coding agent --------
// --- (OpenClaw, Hermes, Claude Code, or Codex — or a cloud-hosted one) ----
// --- and sends it these exact prompts. There is no confirmed plain REST ---
// --- API yet, so the real replacement for each function below is likely --
// --- "start/attach to an agent session running onchainos-skills and pipe -
// --- it this prompt" rather than a simple fetch() call. Each step's -------
// --- return value is persisted into onboarding_steps.detail, so nothing --
// --- calling runDeployment() needs to change once this is wired for real. -
async function installOnchainOS(agent) {
  // Real command, sent to the agent session:
  //   npx skills add okx/onchainos-skills --yes -g
  // (requires open a new session afterward before continuing)
  return { installed: true };
}
async function logInAgenticWallet(agent) {
  // Real prompt: "Log in to Agentic Wallet on Onchain OS with my email"
  // Wallet login is email-based — there's no separate "create wallet" call.
  return { wallet_address: `0x${crypto.randomBytes(20).toString('hex')}` };
}
async function registerIdentity(agent) {
  // Real prompt (User role): "Register me as a User on OKX.AI using OKX
  // Agent Identity from Onchain OS". Since AgentPress agents provide paid
  // services to small businesses rather than initiating tasks, they're
  // registering as an ASP, not a User — see registerAsAsp() below, which is
  // where the actual OKX Agent Identity registration happens for this app.
  // registry_contract / registry_transaction mock the "Identity details"
  // panel confirmed real on an agent's on-chain data view.
  return {
    identity_ref: `agent:xlayer:0x${crypto.randomBytes(10).toString('hex')}`,
    registry_contract: `0x${crypto.randomBytes(20).toString('hex')}`,
    registry_transaction: `0x${crypto.randomBytes(32).toString('hex')}`,
  };
}
async function registerAsAsp(agent) {
  // Real prompt (A2A — negotiated price/scope, escrow, dispute-eligible):
  //   "Help me register an A2A ASP on OKX.AI using OKX Agent Identity from Onchain OS"
  // A2A is the right mode for AgentPress's escrow-based skills (Invoicing,
  // Supplier Ordering). A skill like Customer Support that's pay-per-call
  // with no negotiation is actually a better fit for A2MCP instead — see
  // the README note on this.
  return { asp_registered: true };
}
async function listOnMarketplace(agent, manifest) {
  // Real prompt: "Help me list my ASP on OKX.AI using Onchain OS"
  // Real behavior: reviewed within 24h, result emailed to the address on the
  // Agentic Wallet + posted to the agent conversation. Not-yet-reviewed or
  // rejected ASPs are still reachable directly via Agent ID in the meantime.
  return { marketplace_listing_url: `https://okx.ai/agents/${agent.id}` };
}
// ---------------------------------------------------------------------------

async function setStep(agentId, step, status, detail = {}) {
  await query(
    `INSERT INTO onboarding_steps (agent_id, step, status, detail, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (agent_id, step) DO UPDATE SET status = $3, detail = $4, updated_at = now()`,
    [agentId, step, status, JSON.stringify(detail)]
  );
}

// Runs the whole checklist in order and stops at the first failure, so the
// console can show exactly which step stalled instead of a flat "failed".
export async function runDeployment(agentId) {
  const [agent] = await query(`SELECT * FROM agents WHERE id = $1`, [agentId]);
  if (!agent) throw new Error('agent not found');

  await query(`UPDATE agents SET status = 'deploying' WHERE id = $1`, [agentId]);

  for (const step of STEPS) {
    await setStep(agentId, step, 'in_progress');
    try {
      let result = {};
      switch (step) {
        case 'install_onchain_os':
          result = await installOnchainOS(agent);
          break;

        case 'log_in_agentic_wallet':
          result = await logInAgenticWallet(agent);
          await query(`UPDATE agents SET wallet_address = $1 WHERE id = $2`, [result.wallet_address, agentId]);
          break;

        case 'register_identity':
          result = await registerIdentity(agent);
          await query(
            `UPDATE agents SET identity_ref = $1, registry_contract = $2, registry_transaction = $3 WHERE id = $4`,
            [result.identity_ref, result.registry_contract, result.registry_transaction, agentId]
          );
          break;

        case 'generate_manifest': {
          const manifestRow = await generateManifest(agentId);
          result = { manifest_version: manifestRow.version };
          break;
        }

        case 'register_as_asp':
          result = await registerAsAsp(agent);
          await query(`UPDATE agents SET okx_asp_registered = true WHERE id = $1`, [agentId]);
          break;

        case 'list_on_marketplace': {
          const manifestRow = await getLatestManifest(agentId);
          result = await listOnMarketplace(agent, manifestRow.manifest);
          await query(`UPDATE agent_manifests SET published = true, published_at = now() WHERE id = $1`, [manifestRow.id]);
          await query(`UPDATE agents SET marketplace_listing_url = $1 WHERE id = $2`, [result.marketplace_listing_url, agentId]);
          break;
        }
      }
      await setStep(agentId, step, 'done', result);
    } catch (err) {
      await setStep(agentId, step, 'failed', { error: err.message });
      await query(`UPDATE agents SET status = 'paused' WHERE id = $1`, [agentId]);
      return { success: false, failedStep: step, error: err.message };
    }
  }

  const [finalAgent] = await query(
    `UPDATE agents SET status = 'live', deployed_at = now() WHERE id = $1 RETURNING *`,
    [agentId]
  );

  await query(
    `INSERT INTO audit_log (agent_id, actor, action, details) VALUES ($1,'owner','agent_deployed','{}')`,
    [agentId]
  );

  return { success: true, agent: finalAgent };
}

export async function getOnboardingStatus(agentId) {
  return query(`SELECT * FROM onboarding_steps WHERE agent_id = $1 ORDER BY updated_at ASC`, [agentId]);
}

// Publishing an individual service is lighter than the full deploy checklist
// above — the agent is already registered as an ASP (that only happens once);
// this just lists one more service under it. Per OKX's own docs, "One ASP
// can create multiple services, including both A2A and A2MCP service types."
export async function publishServiceListing(serviceId) {
  const [service] = await query(`SELECT * FROM services WHERE id = $1`, [serviceId]);
  if (!service) throw new Error('service not found');

  const [agent] = await query(`SELECT * FROM agents WHERE id = $1`, [service.agent_id]);
  if (!agent.okx_asp_registered) {
    throw new Error('agent must complete deployment (register as ASP) before publishing a service');
  }

  // MOCK — real version sends the "Register as A2A/A2MCP" + "List your ASP"
  // prompts (see registerAsAsp/listOnMarketplace above) scoped to this one
  // service rather than the whole agent.
  await query(`UPDATE services SET listed = true WHERE id = $1`, [serviceId]);
  await query(
    `INSERT INTO audit_log (agent_id, actor, action, details) VALUES ($1,'owner','service_published',$2)`,
    [service.agent_id, JSON.stringify({ service_id: serviceId, service_type: service.service_type })]
  );

  return { listed: true, service_id: serviceId };
}

import { query } from '../db.js';

// Fallback for skills without bespoke logic yet: support, books, scheduling,
// supplier, marketing, reputation. Logs every interaction so nothing is
// silently dropped, and returns a canned reply so the demo doesn't dead-end.
// Replace each entry with a real handler as that skill gets built out —
// same pattern as orderTaking.js / invoicing.js.
const CANNED = {
  support: "Let me check on that for you — one moment.",
  books: "Noted for the books.",
  scheduling: "I can help book a time — what day works for you?",
  supplier: "I'll reach out to the supplier about that.",
  marketing: "Got it, I'll queue that up for the socials.",
  reputation: "Thanks! Mind leaving a quick review after this?",
};

export async function handle({ agent, skillId, payload }) {
  await query(
    `INSERT INTO audit_log (agent_id, actor, action, details) VALUES ($1, 'agent', 'skill_invoked', $2)`,
    [agent.id, JSON.stringify({ skill: skillId, payload })]
  );
  return { reply: CANNED[skillId] || 'Got it.' };
}

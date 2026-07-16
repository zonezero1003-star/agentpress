# AgentPress — Backend

Part of AgentPress. Full architecture, API reference, data model, and the real-vs-mocked breakdown live in the root `README.md` of the combined project — this file is just the quick-start for this repo standalone.

## Quick start

1. Create a Postgres instance, run `agentpress-backend-schema.sql` against it.
2. Set `DATABASE_URL` and `PUBLIC_URL` (see `.env.example`).
3. `npm install && npm start`

Deploy: push to GitHub, import into Railway, add a Postgres plugin, set the env vars, deploy.

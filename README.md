# AgentPress Frontend

Part of AgentPress. Full architecture, API reference, and setup docs live in the root `README.md` of the combined project this file is just the quick-start for this repo standalone.

## Quick start

```
npm install
```

Set `NEXT_PUBLIC_API_URL` (see `.env.example`) to your deployed `agentpress-backend` URL, then:

```
npm run dev    # local
npm run build  # production build, e.g. for Vercel
```

Deploy: push to GitHub, import into Vercel, set the env var, deploy.

# SMITH BUSINESS OS 0.1 — pilot

An owner-controlled, cross-project operations nucleus with server-to-server tenant isolation. Includes 6 scoped projects, verified-source KPI records, profitability calculations that respect currency, proposal-only agent jobs, owner approvals, audit journal and responsive private dashboard.

**This is a working, tested pilot, NOT a production deployment or autonomous agent runtime.** No clients, transactional emails, payments, site publishing or external systems are accessed automatically.

See [Romanian installation guide](docs/DEPLOYMENT_RO.md). Dependencies: Node 22+, no npm packages.

```
cd business-os
npm test
npm run check
# Provide SMITH_OS_KEYS_JSON before starting
node --env-file=.env src/server.mjs
```

Security: 32+ character bearer secrets are server-only, never committed. Data are separated by `projectId` in every route. JSON persistence single-process only; use PostgreSQL and robust auth for production. Owner approves job proposals without executing them. Dashboard tokens are ephemeral in-memory. Local binding by default.

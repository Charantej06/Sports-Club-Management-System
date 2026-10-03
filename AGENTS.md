# Champions Club

Modular Next.js App Router monolith. `src/modules` owns business services; API handlers authenticate, authorize, validate with Zod and delegate. Prisma/PostgreSQL is the source of truth. A separate worker claims durable jobs.

Use strict TypeScript, integer paise, UTC timestamps and Asia/Kolkata club-day rules. Never trust client prices, roles or customer IDs. Scope customer queries to the session user. Critical writes use transactions, database constraints and explicit locks. Keep historical invoices and membership snapshots immutable. Record sensitive mutations without secrets.

Customer pages use black/white/orange; staff workspaces use grey/white/slate. Use local assets, accessible labels, keyboard interactions, reduced motion, responsive layouts and clear pending/empty/error states. Keep stage-two/three actions clearly unavailable until implemented.

Verify with `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration` against real PostgreSQL, and `npm run build`. Verify changed flows in a browser when available. Read SPEC.md and PLAN.md before extending scope. Keep commits focused by feature. Never commit .env, local database files, generated clients or build output.

# {Feature or Page Name}

**Kind:** page | feature
**Status:** built | partial | stub | planned

## Routes
- `METHOD /path` — one line: what triggers it, who can hit it (public / requireAuth / requireSuperAdmin)

## Primary files
- Route handler(s): `server.js:START-END`
- View(s): `views/....js` (exported function name + the props object it receives)
- Lib: `lib/....js` (exported functions this feature owns)
- DB: table name(s) in `portal.db`, key `portal-db.js` accessor functions

## Data flow
Numbered, trigger → compute → persist → render. Keep it to what isn't obvious from reading one file in isolation — the whole point of this doc is to save an agent from reconstructing the cross-file wiring.

1. ...
2. ...

## Key functions
- `functionName(args)` — one line, `file:line`

## Edge cases / gotchas
- Non-obvious behavior, guardrails, known gaps, dead code, feature flags (e.g. "disabled pending X"). If something in this doc could go stale (a line number, a flag default), say so here rather than let a future reader trust it blindly.

## Related docs
- [[other-feature-or-page]] — one line on how they connect

---
*Two variants of this template are in use: `docs/agents/pages/*.md` for the public MPA pages (thin — route, data sources, computed fields), and `docs/agents/features/*.md` for cross-cutting logic spanning multiple routes/views/lib files (fuller — data flow, gotchas). Omit sections that don't apply rather than leaving them as empty headers.*

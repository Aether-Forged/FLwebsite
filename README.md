# Forced Logic Website

This folder is the live website workspace for Forced Logic.

## What is here

- `index.html` - Vite entry
- `src/` - React app source
- `public/forced-logic-logo.png` - brand logo asset
- `.mcp.json` - MCP config for the site workspace
- `mcp/site-bridge.mjs` - MCP server for file access

## Local work

```bash
npm install
npm run dev
```

## MCP

Run the site bridge through:

```bash
npm run mcp:server
```

## Supabase

Copy `.env.example` to `.env` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

For GitHub Pages builds, add the same values as repository secrets named:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Those secrets are used at build time so the deployed site can talk to Supabase.

## GitHub

This folder now has its own git repository.

To connect it to GitHub:

1. Create a repo on GitHub.
2. Add the remote with `git remote add origin <repo-url>`.
3. Push `main` once the remote exists.

## Notes

- The site is intentionally minimal and operational.
- Keep this folder separate from the other projects in `current-projects-C&E`.

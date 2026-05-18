# Forged Logic Website

This folder is the live website workspace for Forged Logic.

## What is here

- `index.html` - Vite entry
- `src/` - React app source
- `public/forged-logic-logo.png` - brand logo asset
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

Apply [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor.
Then add your approved login email to `public.approved_users`.
Set `can_admin = true` for the account that should control the private panel.

If the tables already existed before this update, rerun the schema file so the
`can_admin` column and the workspace-card defaults are added to the existing tables.
The file is now safe to rerun because it drops and recreates the matching policies first.
It also installs the `public.is_admin_user()` helper so admin checks do not recurse through
row-level security.

Example:

```sql
insert into public.approved_users (email, display_name, can_admin)
values ('you@example.com', 'Your Name', true);
```

The private admin panel can add workspace cards and approved users directly from the browser once that account is marked as admin.

## GitHub

This folder now has its own git repository.

To connect it to GitHub:

1. Create a repo on GitHub.
2. Add the remote with `git remote add origin <repo-url>`.
3. Push `main` once the remote exists.

## Notes

- The site is intentionally minimal and operational.
- Keep this folder separate from the other projects in `current-projects-C&E`.

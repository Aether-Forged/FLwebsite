create extension if not exists pgcrypto;

create table if not exists public.approved_users (
  email text primary key,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.approved_users enable row level security;

create policy "Approved users can view their own approval"
on public.approved_users
for select
to authenticated
using (
  active = true
  and lower(email) = lower(auth.jwt() ->> 'email')
);

create table if not exists public.workspace_cards (
  id uuid primary key default gen_random_uuid(),
  badge text not null,
  title text not null,
  body text not null,
  note text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.workspace_cards enable row level security;

create policy "Authenticated users can read active workspace cards"
on public.workspace_cards
for select
to authenticated
using (is_active = true);

insert into public.workspace_cards (badge, title, body, note, order_index) values
  ('Ready', 'Live workspace', 'This private layer is the first authenticated surface for Forced Logic.', 'Swap these defaults out for rows in Supabase when you are ready.', 1),
  ('Next', 'Private modules', 'Add admin tools, content blocks, and project areas here behind login.', 'This section is now wired to accept rows from the database.', 2),
  ('Status', 'Deployment', 'GitHub Pages serves the app and the workflow is already connected.', 'Future pushes will update the live URL automatically.', 3),
  ('Control', 'Supabase data', 'Workspace cards and approved users both live in Supabase tables.', 'Use the schema file to create the tables in the project.', 4)
on conflict do nothing;

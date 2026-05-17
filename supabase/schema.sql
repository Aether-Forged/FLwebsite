create extension if not exists pgcrypto;

create table if not exists public.approved_users (
  email text primary key,
  display_name text,
  can_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.approved_users
  add column if not exists can_admin boolean not null default false;

alter table public.approved_users enable row level security;

create policy "Approved users can view their own approval"
on public.approved_users
for select
to authenticated
using (
  active = true
  and (
    lower(email) = lower(auth.jwt() ->> 'email')
    or exists (
      select 1
      from public.approved_users admin
      where lower(admin.email) = lower(auth.jwt() ->> 'email')
        and admin.active = true
        and admin.can_admin = true
    )
  )
);

create policy "Approved admins can add approved users"
on public.approved_users
for insert
to authenticated
with check (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
);

create policy "Approved admins can update approved users"
on public.approved_users
for update
to authenticated
using (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
)
with check (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
);

create policy "Approved admins can delete approved users"
on public.approved_users
for delete
to authenticated
using (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
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

alter table public.workspace_cards
  add column if not exists note text;

alter table public.workspace_cards
  add column if not exists order_index integer not null default 0;

alter table public.workspace_cards
  add column if not exists is_active boolean not null default true;

alter table public.workspace_cards enable row level security;

create policy "Approved users can read active workspace cards"
on public.workspace_cards
for select
to authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.approved_users approved
    where lower(approved.email) = lower(auth.jwt() ->> 'email')
      and approved.active = true
  )
);

create policy "Approved admins can add cards"
on public.workspace_cards
for insert
to authenticated
with check (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
);

create policy "Approved admins can update cards"
on public.workspace_cards
for update
to authenticated
using (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
)
with check (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
);

create policy "Approved admins can delete cards"
on public.workspace_cards
for delete
to authenticated
using (
  exists (
    select 1
    from public.approved_users admin
    where lower(admin.email) = lower(auth.jwt() ->> 'email')
      and admin.active = true
      and admin.can_admin = true
  )
);

insert into public.workspace_cards (badge, title, body, note, order_index, is_active)
values
  ('Ready', 'Live workspace', 'This private layer is the first authenticated surface for Forced Logic.', 'Swap these defaults out for rows in Supabase when you are ready.', 1, true),
  ('Next', 'Private modules', 'Add admin tools, content blocks, and project areas here behind login.', 'This section is now wired to accept rows from the database.', 2, true),
  ('Status', 'Deployment', 'GitHub Pages serves the app and the workflow is already connected.', 'Future pushes will update the live URL automatically.', 3, true),
  ('Control', 'Supabase data', 'Workspace cards and approved users both live in Supabase tables.', 'Use the schema file to create the tables in the project.', 4, true)
on conflict do nothing;

insert into public.approved_users (email, display_name, can_admin, active)
values
  ('xisdrofresix@gmail.com', 'Michael', true, true)
on conflict (email) do update
set display_name = excluded.display_name,
    can_admin = excluded.can_admin,
    active = excluded.active;

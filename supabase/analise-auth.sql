-- Requires the existing Precificador authorization functions and allowed_emails.
-- Catalog data must be imported through an authenticated administrative connection.
create table if not exists public.analise_catalog (
  id boolean primary key default true check (id),
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  suppliers jsonb not null default '{}'::jsonb,
  row_count integer not null check (row_count > 0),
  updated_at timestamptz not null default now()
);
alter table public.analise_catalog enable row level security;
revoke all on public.analise_catalog from public, anon, authenticated;
grant select on public.analise_catalog to authenticated;
drop policy if exists authorized_analise_read on public.analise_catalog;
create policy authorized_analise_read on public.analise_catalog for select to authenticated
  using ((select precificador_private.can_read_prices()));

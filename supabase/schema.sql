create extension if not exists pgcrypto;

create table if not exists sysadmin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  role text not null check (role in ('owner','operator','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists managed_sites (
  id uuid primary key default gen_random_uuid(),
  site_key text not null unique,
  name text not null,
  category text not null check (category in ('internal_app','client_portal','marketing_site','commerce_app')),
  repo_url text not null,
  github_repo text not null,
  cloudflare_project text,
  maintenance_supported boolean not null default true,
  worker_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists site_environments (
  id uuid primary key default gen_random_uuid(),
  managed_site_id uuid not null references managed_sites(id) on delete cascade,
  env_key text not null,
  label text not null,
  env_type text not null check (env_type in ('production','staging','preview')),
  base_url text,
  health_url text,
  login_url text,
  api_url text,
  is_active boolean not null default true,
  maintenance_enabled boolean not null default false,
  maintenance_title text,
  maintenance_message text,
  maintenance_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (managed_site_id, env_key)
);

create table if not exists site_checks (
  id uuid primary key default gen_random_uuid(),
  site_environment_id uuid not null references site_environments(id) on delete cascade,
  check_type text not null check (check_type in ('http_ok','login_surface_ok','api_ok','worker_ok','dns_resolves','ssl_valid')),
  target_url text,
  latency_ms integer,
  status_code integer,
  ok boolean not null default false,
  rolled_up_status text not null check (rolled_up_status in ('healthy','degraded','down','maintenance','unknown')),
  error_message text,
  checked_at timestamptz not null default now()
);

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  site_environment_id uuid not null references site_environments(id) on delete cascade,
  site_key text not null,
  environment_key text not null,
  title text not null,
  description text,
  status text not null check (status in ('healthy','degraded','down','maintenance','resolved')),
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  actor_name text,
  actor_role text,
  action text not null,
  site_key text,
  environment_key text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_checks_environment on site_checks(site_environment_id, checked_at desc);
create index if not exists idx_incidents_status on incidents(status, created_at desc);
create index if not exists idx_audit_events_created on audit_events(created_at desc);

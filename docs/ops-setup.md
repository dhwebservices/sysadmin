# DH Sysadmin setup

## 1. Frontend env vars

Cloudflare Pages:

- `VITE_ENTRA_CLIENT_ID`
- `VITE_ENTRA_AUTHORITY`
- `VITE_SYSADMIN_API_URL`

## 2. Worker secrets

Cloudflare Worker:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_ALLOWED_DOMAIN=dhwebsiteservices.co.uk`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GITHUB_TOKEN` (optional for richer repo/deploy metadata)

## 3. Supabase

Run:

- `/Users/david/Desktop/sysadmin/supabase/schema.sql`

Then insert at least one sysadmin user:

```sql
insert into sysadmin_users (email, display_name, role)
values ('david@dhwebsiteservices.co.uk', 'David Hooper', 'owner');
```

## 4. Entra

Create a new app registration for Sysadmin.

SPA redirect URIs:

- `https://<your-pages-domain>`
- `http://localhost:5173`

Set:

- `VITE_ENTRA_CLIENT_ID`
- `VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/<tenant-id>`
- `ENTRA_CLIENT_ID`
- `ENTRA_TENANT_ID`

## 5. Per-site maintenance integration

Each managed site should check:

`GET /public/site-config?site=<siteKey>&env=<envKey>&host=<hostname>`

If `maintenanceEnabled` is true:

- render maintenance view
- stop normal app boot
- optionally allow bypass for DH admins later

## 6. Registry

The registry seeds itself from:

- `/Users/david/Desktop/sysadmin/config/managed-sites.js`

This includes:

- DH Staff Portal
- DH Client Portal
- DH Workplace App
- DH Workplace Marketing Site
- DH Website Services
- DH Click & Collect

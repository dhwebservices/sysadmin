# DH Sysadmin

Operations control plane for:

- DH Staff Portal
- DH Client Portal
- DH Workplace app
- DH Workplace marketing site
- DH Website Services site
- DH Click & Collect

## Stack

- Cloudflare Pages frontend
- Cloudflare Worker API
- Dedicated Supabase project
- Microsoft Entra authentication

## Local development

```bash
npm install
npm run dev
```

Worker:

- `/Users/david/Desktop/sysadmin/worker`

Supabase schema:

- `/Users/david/Desktop/sysadmin/supabase/schema.sql`

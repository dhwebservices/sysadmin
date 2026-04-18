import { managedSites } from '../config/managed-sites.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const corsHeaders = buildCorsHeaders(request)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      if (url.pathname === '/public/site-config') {
        const siteKey = url.searchParams.get('site')
        const envKey = url.searchParams.get('env') || 'production'
        if (!siteKey) return json({ error: 'Missing site key' }, 400, corsHeaders)
        await ensureRegistrySeeded(env)
        const envRecord = await loadEnvironmentByKeys(env, siteKey, envKey)
        if (!envRecord) return json({ error: 'Unknown site environment' }, 404, corsHeaders)
        return json({
          siteKey,
          environment: envKey,
          maintenanceEnabled: !!envRecord.maintenance_enabled,
          maintenanceTitle: envRecord.maintenance_title || '',
          maintenanceMessage: envRecord.maintenance_message || '',
          updatedAt: envRecord.maintenance_updated_at || envRecord.updated_at,
        }, 200, corsHeaders)
      }

      if (url.pathname === '/api/me') {
        const viewer = await verifyAdminRequest(request, env)
        return json(viewer, 200, corsHeaders)
      }

      if (url.pathname === '/api/sites') {
        const viewer = await verifyAdminRequest(request, env)
        await ensureRegistrySeeded(env)
        const sites = await listSites(env)
        await writeAudit(env, viewer, 'view_sites', null, null, { count: sites.length })
        return json({ sites }, 200, corsHeaders)
      }

      if (url.pathname.startsWith('/api/sites/')) {
        const viewer = await verifyAdminRequest(request, env)
        await ensureRegistrySeeded(env)
        return await handleSiteRoutes(request, env, viewer, corsHeaders)
      }

      if (url.pathname === '/api/incidents') {
        const viewer = await verifyAdminRequest(request, env)
        if (request.method === 'GET') {
          return json({ incidents: await listIncidents(env) }, 200, corsHeaders)
        }
        if (request.method === 'POST') {
          const payload = await request.json()
          const incident = await createIncident(env, viewer, payload)
          return json({ incident }, 200, corsHeaders)
        }
      }

      if (url.pathname === '/api/audit') {
        await verifyAdminRequest(request, env)
        return json({ events: await listAuditEvents(env) }, 200, corsHeaders)
      }

      if (url.pathname === '/api/checks/run-all' && request.method === 'POST') {
        const viewer = await verifyAdminRequest(request, env)
        await ensureRegistrySeeded(env)
        await runAllChecks(env, viewer)
        return json({ ok: true }, 200, corsHeaders)
      }

      return json({ error: 'Not found' }, 404, corsHeaders)
    } catch (error) {
      console.error(error)
      return json({ error: error.message || 'Unexpected error' }, 500, corsHeaders)
    }
  },

  async scheduled(_controller, env) {
    await ensureRegistrySeeded(env)
    await runAllChecks(env, { email: 'scheduler', role: 'owner', name: 'Cloudflare Scheduler' })
  },
}

async function handleSiteRoutes(request, env, viewer, corsHeaders) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const siteKey = parts[2]
  const envKey = parts[4]

  if (parts.length === 3 && request.method === 'GET') {
    const site = await getSiteWithEnvironments(env, siteKey)
    if (!site) return json({ error: 'Site not found' }, 404, corsHeaders)
    return json({ site }, 200, corsHeaders)
  }

  if (parts.length === 5 && request.method === 'GET') {
    const environment = await loadEnvironmentByKeys(env, siteKey, envKey)
    if (!environment) return json({ error: 'Environment not found' }, 404, corsHeaders)
    return json({ environment }, 200, corsHeaders)
  }

  if (parts.length === 6 && parts[5] === 'maintenance' && request.method === 'POST') {
    if (!['owner', 'operator'].includes(viewer.role)) {
      return json({ error: 'You do not have permission to change maintenance state.' }, 403, corsHeaders)
    }
    const payload = await request.json()
    const result = await setMaintenanceState(env, viewer, siteKey, envKey, payload)
    return json({ environment: result }, 200, corsHeaders)
  }

  if (parts.length === 6 && parts[5] === 'check' && request.method === 'POST') {
    if (!['owner', 'operator'].includes(viewer.role)) {
      return json({ error: 'You do not have permission to run checks.' }, 403, corsHeaders)
    }
    const result = await runChecksForEnvironment(env, viewer, siteKey, envKey)
    return json({ checks: result }, 200, corsHeaders)
  }

  return json({ error: 'Unsupported route' }, 404, corsHeaders)
}

function buildCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  }
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

async function verifyAdminRequest(request, env) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) throw new Error('Missing Entra token')
  const claims = await verifyMicrosoftJwt(token, env)
  const email = String(claims.preferred_username || claims.upn || claims.email || '').toLowerCase()
  const name = claims.name || email
  if (!email) throw new Error('Unable to resolve Microsoft account email')
  const allowedDomain = String(env.ENTRA_ALLOWED_DOMAIN || 'dhwebsiteservices.co.uk').toLowerCase()
  if (!email.endsWith(`@${allowedDomain}`)) throw new Error('Unauthorized admin account')

  const userRow = await sbGetOne(env, 'sysadmin_users', `email=eq.${encodeURIComponent(email)}&select=id,email,role,display_name&limit=1`)
  if (!userRow) throw new Error('Your account is not allowlisted in sysadmin_users')

  return {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    name: userRow.display_name || name,
  }
}

async function verifyMicrosoftJwt(token, env) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('Invalid token')
  const header = JSON.parse(base64UrlDecode(encodedHeader))
  const payload = JSON.parse(base64UrlDecode(encodedPayload))
  const tenantId = String(env.ENTRA_TENANT_ID || '').toLowerCase()
  const tokenTenantId = String(payload.tid || '').toLowerCase()
  const validIssuers = new Set([
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://login.microsoftonline.com/${tenantId}/`,
    `https://sts.windows.net/${tenantId}/`,
  ])
  if (!payload.iss || !validIssuers.has(payload.iss) || (tokenTenantId && tokenTenantId !== tenantId)) {
    throw new Error('Invalid token issuer')
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token expired')

  const keys = await getMicrosoftSigningKeys(env)
  const jwk = keys.find((item) => item.kid === header.kid)
  if (!jwk) throw new Error('Signing key not found')

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg || 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    base64UrlToUint8Array(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )

  if (!verified) throw new Error('Invalid token signature')
  return payload
}

let microsoftKeyCache = null
let microsoftKeyCacheExpiry = 0
async function getMicrosoftSigningKeys(env) {
  if (microsoftKeyCache && Date.now() < microsoftKeyCacheExpiry) return microsoftKeyCache
  const res = await fetch(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`)
  if (!res.ok) throw new Error('Failed to fetch Microsoft signing keys')
  const body = await res.json()
  microsoftKeyCache = body.keys || []
  microsoftKeyCacheExpiry = Date.now() + 60 * 60 * 1000
  return microsoftKeyCache
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

function base64UrlToUint8Array(value) {
  return Uint8Array.from(base64UrlDecode(value), (char) => char.charCodeAt(0))
}

async function ensureRegistrySeeded(env) {
  const existing = await sbGetMany(env, 'managed_sites', 'select=id')
  if (existing.length) return

  for (const site of managedSites) {
    const createdSite = await sbInsert(env, 'managed_sites', {
      site_key: site.siteKey,
      name: site.name,
      category: site.category,
      repo_url: site.repoUrl,
      github_repo: site.githubRepo,
      cloudflare_project: site.cloudflareProject,
      maintenance_supported: !!site.maintenanceSupported,
      worker_url: site.workerUrl || null,
    }, 'representation')

    for (const environment of site.environments) {
      await sbInsert(env, 'site_environments', {
        managed_site_id: createdSite.id,
        env_key: environment.envKey,
        label: environment.label,
        env_type: environment.envType,
        base_url: environment.baseUrl,
        health_url: environment.healthUrl || environment.baseUrl || null,
        login_url: environment.loginUrl || null,
        api_url: environment.apiUrl || null,
        is_active: true,
      }, 'minimal')
    }
  }
}

async function listSites(env) {
  const sites = await sbGetMany(env, 'managed_sites', 'select=*')
  const environments = await sbGetMany(env, 'site_environments', 'select=*')
  const checks = await sbGetMany(env, 'site_checks', 'select=*&order=checked_at.desc')
  const incidents = await sbGetMany(env, 'incidents', 'select=*&order=created_at.desc')

  const siteRows = await Promise.all(sites.map(async (site) => {
    const envs = environments
      .filter((item) => item.managed_site_id === site.id)
      .map((envItem) => {
        const envChecks = checks.filter((check) => check.site_environment_id === envItem.id)
        const latest = envChecks[0] || null
        return {
          ...envItem,
          latest_check: latest,
          rolled_up_status: envItem.maintenance_enabled ? 'maintenance' : latest?.rolled_up_status || 'unknown',
          maintenance: {
            enabled: !!envItem.maintenance_enabled,
            title: envItem.maintenance_title || '',
            message: envItem.maintenance_message || '',
          },
          open_incidents: incidents.filter((incident) => incident.site_environment_id === envItem.id && incident.status !== 'resolved'),
        }
      })
      .sort((a, b) => a.env_key.localeCompare(b.env_key))

    return {
      ...site,
      integrations: await loadSiteIntegrations(env, site),
      environments: envs,
    }
  }))

  return siteRows
}

async function getSiteWithEnvironments(env, siteKey) {
  const sites = await listSites(env)
  return sites.find((site) => site.site_key === siteKey) || null
}

async function loadEnvironmentByKeys(env, siteKey, envKey) {
  const site = await sbGetOne(env, 'managed_sites', `site_key=eq.${encodeURIComponent(siteKey)}&select=id`)
  if (!site) return null
  return await sbGetOne(env, 'site_environments', `managed_site_id=eq.${site.id}&env_key=eq.${encodeURIComponent(envKey)}&select=*`)
}

async function setMaintenanceState(env, viewer, siteKey, envKey, payload) {
  const environment = await loadEnvironmentByKeys(env, siteKey, envKey)
  if (!environment) throw new Error('Site environment not found')
  const now = new Date().toISOString()
  await sbPatch(env, 'site_environments', `id=eq.${environment.id}`, {
    maintenance_enabled: !!payload.enabled,
    maintenance_title: payload.enabled ? (payload.title || `${siteKey} maintenance`) : null,
    maintenance_message: payload.enabled ? (payload.message || '') : null,
    maintenance_updated_at: now,
    updated_at: now,
  })
  await writeAudit(env, viewer, payload.enabled ? 'enable_maintenance' : 'disable_maintenance', siteKey, envKey, payload)
  return await loadEnvironmentByKeys(env, siteKey, envKey)
}

async function runAllChecks(env, viewer) {
  const sites = await listSites(env)
  for (const site of sites) {
    for (const siteEnv of site.environments) {
      await runChecksForEnvironment(env, viewer, site.site_key, siteEnv.env_key)
    }
  }
}

async function runChecksForEnvironment(env, viewer, siteKey, envKey) {
  const site = await getSiteWithEnvironments(env, siteKey)
  const siteEnv = site?.environments?.find((item) => item.env_key === envKey)
  if (!siteEnv) throw new Error('Environment not found')

  const checksToRun = [
    { type: 'http_ok', url: siteEnv.health_url || siteEnv.base_url },
    { type: 'login_surface_ok', url: siteEnv.login_url || siteEnv.base_url },
    { type: 'api_ok', url: siteEnv.api_url || site.worker_url || null },
  ].filter((item) => item.url)

  const results = []
  for (const target of checksToRun) {
    const started = Date.now()
    let ok = false
    let statusCode = null
    let error = null
    try {
      const response = await fetch(target.url, {
        method: 'GET',
        headers: { 'user-agent': 'dh-sysadmin-check/1.0' },
      })
      statusCode = response.status
      ok = response.ok
    } catch (err) {
      error = err.message
    }
    const latency = Date.now() - started
    const rolledUpStatus = siteEnv.maintenance_enabled ? 'maintenance' : ok ? 'healthy' : statusCode ? 'degraded' : 'down'
    const inserted = await sbInsert(env, 'site_checks', {
      site_environment_id: siteEnv.id,
      check_type: target.type,
      target_url: target.url,
      latency_ms: latency,
      status_code: statusCode,
      rolled_up_status: rolledUpStatus,
      ok,
      error_message: error,
      checked_at: new Date().toISOString(),
    }, 'representation')
    results.push(inserted)
  }

  await writeAudit(env, viewer, 'run_check', siteKey, envKey, { count: results.length })
  return results
}

async function createIncident(env, viewer, payload) {
  const environment = await loadEnvironmentByKeys(env, payload.siteKey, payload.environmentKey)
  if (!environment) throw new Error('Site environment not found')
  const incident = await sbInsert(env, 'incidents', {
    site_environment_id: environment.id,
    site_key: payload.siteKey,
    environment_key: payload.environmentKey,
    title: payload.title,
    description: payload.description || null,
    status: payload.status || 'degraded',
    created_by_email: viewer.email,
  }, 'representation')
  await writeAudit(env, viewer, 'create_incident', payload.siteKey, payload.environmentKey, payload)
  return incident
}

async function listIncidents(env) {
  return sbGetMany(env, 'incidents', 'select=*&order=created_at.desc')
}

async function listAuditEvents(env) {
  return sbGetMany(env, 'audit_events', 'select=*&order=created_at.desc&limit=100')
}

async function loadSiteIntegrations(env, site) {
  const [github, cloudflare] = await Promise.all([
    loadGitHubMetadata(env, site.github_repo),
    loadCloudflareMetadata(env, site.cloudflare_project),
  ])

  return {
    github,
    cloudflare,
  }
}

async function loadGitHubMetadata(env, repoSlug) {
  if (!env.GITHUB_TOKEN || !repoSlug) return null
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dh-sysadmin/1.0',
  }

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${repoSlug}`, { headers })
    if (!repoRes.ok) return null
    const repo = await repoRes.json()
    const branch = repo.default_branch || 'main'
    const commitRes = await fetch(`https://api.github.com/repos/${repoSlug}/commits/${branch}`, { headers })
    if (!commitRes.ok) {
      return {
        defaultBranch: branch,
        visibility: repo.private ? 'private' : 'public',
      }
    }
    const commit = await commitRes.json()
    return {
      defaultBranch: branch,
      visibility: repo.private ? 'private' : 'public',
      latestCommitSha: commit.sha,
      latestCommitMessage: commit.commit?.message || '',
      latestCommitAt: commit.commit?.author?.date || commit.commit?.committer?.date || null,
      latestCommitUrl: commit.html_url || null,
    }
  } catch {
    return null
  }
}

async function loadCloudflareMetadata(env, projectName) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID || !projectName) return null
  const headers = {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }

  try {
    const projectRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}`, { headers })
    if (!projectRes.ok) return null
    const projectBody = await projectRes.json()
    const project = projectBody.result

    const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`, { headers })
    const deployBody = deployRes.ok ? await deployRes.json() : { result: [] }
    const latestDeploy = Array.isArray(deployBody.result) ? deployBody.result[0] : null

    return {
      projectName: project?.name || projectName,
      subdomain: project?.subdomain || null,
      productionBranch: project?.production_branch || null,
      latestDeploymentId: latestDeploy?.id || null,
      latestDeploymentUrl: latestDeploy?.url || latestDeploy?.aliases?.[0] || null,
      latestDeploymentStatus: latestDeploy?.latest_stage?.status || latestDeploy?.deployment_trigger?.metadata?.branch || null,
      latestDeploymentAt: latestDeploy?.modified_on || latestDeploy?.created_on || null,
    }
  } catch {
    return null
  }
}

async function writeAudit(env, viewer, action, siteKey, envKey, payload) {
  return sbInsert(env, 'audit_events', {
    actor_email: viewer.email,
    actor_name: viewer.name,
    actor_role: viewer.role,
    action,
    site_key: siteKey,
    environment_key: envKey,
    payload,
  }, 'minimal')
}

async function sbGetMany(env, table, query) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders(env) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function sbGetOne(env, table, query) {
  const rows = await sbGetMany(env, table, query)
  return rows[0] || null
}

async function sbInsert(env, table, payload, returnMode = 'minimal') {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...sbHeaders(env),
      Prefer: returnMode === 'representation' ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  if (returnMode === 'representation') {
    const rows = await res.json()
    return Array.isArray(rows) ? rows[0] : rows
  }
  return true
}

async function sbPatch(env, table, query, payload) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      ...sbHeaders(env),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return true
}

function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

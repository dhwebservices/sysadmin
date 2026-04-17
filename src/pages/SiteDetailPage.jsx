import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { apiGet, apiPost } from '../lib/api'
import SectionHeader from '../components/common/SectionHeader'
import SiteStatusPill from '../components/sites/SiteStatusPill'

export default function SiteDetailPage() {
  const { siteKey } = useParams()
  const { apiToken, viewer } = useAuth()
  const [site, setSite] = useState(null)
  const [error, setError] = useState('')
  const [savingEnv, setSavingEnv] = useState('')

  const canOperate = useMemo(() => ['owner', 'operator'].includes(viewer?.role), [viewer?.role])

  useEffect(() => {
    if (!apiToken || !siteKey) return
    apiGet(`/api/sites/${siteKey}`, apiToken)
      .then((data) => setSite(data.site))
      .catch((err) => setError(err.message))
  }, [apiToken, siteKey])

  const updateMaintenance = async (envKey, enabled) => {
    if (!apiToken) return
    setSavingEnv(envKey)
    try {
      await apiPost(`/api/sites/${siteKey}/environments/${envKey}/maintenance`, apiToken, {
        enabled,
        title: enabled ? `${site.name} is under maintenance` : '',
        message: enabled ? 'A planned maintenance window is active. Please check back shortly.' : '',
      })
      const data = await apiGet(`/api/sites/${siteKey}`, apiToken)
      setSite(data.site)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingEnv('')
    }
  }

  const runCheck = async (envKey) => {
    if (!apiToken) return
    setSavingEnv(envKey)
    try {
      await apiPost(`/api/sites/${siteKey}/environments/${envKey}/check`, apiToken, {})
      const data = await apiGet(`/api/sites/${siteKey}`, apiToken)
      setSite(data.site)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingEnv('')
    }
  }

  if (!site) {
    return <div className="panel">{error ? <div className="alert-card error">{error}</div> : 'Loading site…'}</div>
  }

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Site detail"
        title={site.name}
        description={`Operational control for ${site.github_repo}. Production, staging, and preview environments all live under the same site definition.`}
      />

      {error ? <div className="alert-card error">{error}</div> : null}

      <div className="dashboard-grid narrow">
        <section className="panel">
          <div className="detail-matrix">
            <div>
              <span>Site key</span>
              <strong className="mono">{site.site_key}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{site.category.replace(/_/g, ' ')}</strong>
            </div>
            <div>
              <span>Cloudflare project</span>
              <strong>{site.cloudflare_project || 'Unset'}</strong>
            </div>
            <div>
              <span>Repo</span>
              <a href={site.repo_url} target="_blank" rel="noreferrer">{site.github_repo}</a>
            </div>
            <div>
              <span>Latest commit</span>
              <strong className="mono">
                {site.integrations?.github?.latestCommitSha
                  ? site.integrations.github.latestCommitSha.slice(0, 7)
                  : 'Unavailable'}
              </strong>
            </div>
            <div>
              <span>Last deploy</span>
              <strong>
                {site.integrations?.cloudflare?.latestDeploymentAt
                  ? new Date(site.integrations.cloudflare.latestDeploymentAt).toLocaleString('en-GB')
                  : 'Unavailable'}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Environment</th>
              <th>Base URL</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Maintenance</th>
              <th>Last checked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {site.environments.map((env) => (
              <tr key={env.env_key}>
                <td>{env.label || env.env_key}</td>
                <td className="mono">{env.base_url || 'Not configured'}</td>
                <td><SiteStatusPill status={env.rolled_up_status || 'unknown'} /></td>
                <td>{env.latest_check?.latency_ms ? `${env.latest_check.latency_ms}ms` : '—'}</td>
                <td>{env.maintenance?.enabled ? 'Enabled' : 'Off'}</td>
                <td>{env.latest_check?.checked_at ? new Date(env.latest_check.checked_at).toLocaleString('en-GB') : 'Never'}</td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="ghost-link" onClick={() => runCheck(env.env_key)} disabled={savingEnv === env.env_key}>
                      Check now
                    </button>
                    {canOperate ? (
                      <button
                        type="button"
                        className="ghost-link"
                        onClick={() => updateMaintenance(env.env_key, !env.maintenance?.enabled)}
                        disabled={savingEnv === env.env_key}
                      >
                        {env.maintenance?.enabled ? 'Disable maintenance' : 'Enable maintenance'}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

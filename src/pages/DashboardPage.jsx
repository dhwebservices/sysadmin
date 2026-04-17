import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, ShieldAlert, TimerReset } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { apiGet, apiPost } from '../lib/api'
import SectionHeader from '../components/common/SectionHeader'
import SiteCard from '../components/sites/SiteCard'
import SiteStatusPill from '../components/sites/SiteStatusPill'

export default function DashboardPage() {
  const { apiToken } = useAuth()
  const [sites, setSites] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!apiToken) return
      setLoading(true)
      try {
        const [siteRes, incidentRes] = await Promise.all([
          apiGet('/api/sites', apiToken),
          apiGet('/api/incidents', apiToken),
        ])
        if (!active) return
        setSites(siteRes.sites || [])
        setIncidents(incidentRes.incidents || [])
        setError('')
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [apiToken])

  const summary = useMemo(() => {
    const envs = sites.flatMap((site) => site.environments || [])
    return {
      totalSites: sites.length,
      degraded: envs.filter((env) => ['degraded', 'down'].includes(env.rolled_up_status)).length,
      maintenance: envs.filter((env) => env.maintenance?.enabled).length,
      activeIncidents: incidents.filter((incident) => incident.status !== 'resolved').length,
    }
  }, [incidents, sites])

  const runSweep = async () => {
    if (!apiToken) return
    setLoading(true)
    try {
      await apiPost('/api/checks/run-all', apiToken, {})
      const siteRes = await apiGet('/api/sites', apiToken)
      setSites(siteRes.sites || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Live operations"
        title="All DH systems"
        description="Production and preview visibility across the DH estate, with maintenance state and last-check health rolled into one view."
        action={
          <button type="button" className="secondary-button" onClick={runSweep} disabled={loading}>
            Run full check sweep
          </button>
        }
      />

      {error ? <div className="alert-card error">{error}</div> : null}

      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-label">Managed sites</div>
          <div className="metric-value">{summary.totalSites}</div>
          <div className="metric-sub">All six DH systems are registered here.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Degraded environments</div>
          <div className="metric-value">{summary.degraded}</div>
          <div className="metric-sub">Production and preview issues that need attention.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Maintenance active</div>
          <div className="metric-value">{summary.maintenance}</div>
          <div className="metric-sub">Environment-level maintenance states from Sysadmin.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open incidents</div>
          <div className="metric-value">{summary.activeIncidents}</div>
          <div className="metric-sub">Operational issues not yet resolved.</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <SectionHeader
            eyebrow="Systems"
            title="Site estate"
            description="Every managed app and public site, with real environment state."
          />
          <div className="site-grid">
            {sites.map((site) => (
              <SiteCard key={site.site_key} site={site} />
            ))}
            {!sites.length && !loading ? <div className="empty-panel">No sites loaded from the registry yet.</div> : null}
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            eyebrow="Operations"
            title="Open incidents"
            description="Current issues being tracked across the six systems."
          />
          <div className="list-stack">
            {incidents.slice(0, 6).map((incident) => (
              <div className="list-row" key={incident.id}>
                <div>
                  <div className="list-title">{incident.title}</div>
                  <div className="list-meta">{incident.site_key} · {incident.environment_key} · {new Date(incident.created_at).toLocaleString('en-GB')}</div>
                </div>
                <SiteStatusPill status={incident.status || 'degraded'} />
              </div>
            ))}
            {!incidents.length && !loading ? <div className="empty-panel">No open incidents.</div> : null}
          </div>
        </section>
      </div>

      <div className="dashboard-grid narrow">
        <section className="panel">
          <SectionHeader eyebrow="Control principles" title="What Sysadmin governs" />
          <div className="capability-grid">
            <div className="capability-card">
              <ShieldAlert size={18} />
              <strong>Maintenance source of truth</strong>
              <p>One central maintenance state per site and environment, exposed through a shared public config endpoint.</p>
            </div>
            <div className="capability-card">
              <Clock3 size={18} />
              <strong>Real check history</strong>
              <p>Latency, status code, and health outcomes are stored from actual executed Worker checks.</p>
            </div>
            <div className="capability-card">
              <TimerReset size={18} />
              <strong>Audit-backed actions</strong>
              <p>Every state change and check run is attached to a DH admin identity and written to audit history.</p>
            </div>
            <div className="capability-card">
              <AlertTriangle size={18} />
              <strong>Preview awareness</strong>
              <p>Preview environments live in the same registry model as production so you can track both from one place.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

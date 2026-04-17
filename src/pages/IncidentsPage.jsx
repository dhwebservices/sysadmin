import { useEffect, useState } from 'react'
import { useAuth } from '../context/auth-context'
import { apiGet } from '../lib/api'
import SectionHeader from '../components/common/SectionHeader'
import SiteStatusPill from '../components/sites/SiteStatusPill'

export default function IncidentsPage() {
  const { apiToken } = useAuth()
  const [incidents, setIncidents] = useState([])

  useEffect(() => {
    if (!apiToken) return
    apiGet('/api/incidents', apiToken).then((data) => setIncidents(data.incidents || []))
  }, [apiToken])

  return (
    <div className="page-stack">
      <SectionHeader eyebrow="Incident desk" title="Operational incidents" description="Tracked issues across the DH estate. This view is intentionally sparse until real incidents exist." />
      <div className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Site</th>
              <th>Environment</th>
              <th>Status</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id}>
                <td>{incident.title}</td>
                <td>{incident.site_key}</td>
                <td>{incident.environment_key}</td>
                <td><SiteStatusPill status={incident.status || 'degraded'} /></td>
                <td>{new Date(incident.created_at).toLocaleString('en-GB')}</td>
              </tr>
            ))}
            {!incidents.length ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-panel">No incidents recorded yet.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

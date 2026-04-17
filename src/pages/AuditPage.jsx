import { useEffect, useState } from 'react'
import { useAuth } from '../context/auth-context'
import { apiGet } from '../lib/api'
import SectionHeader from '../components/common/SectionHeader'

export default function AuditPage() {
  const { apiToken } = useAuth()
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (!apiToken) return
    apiGet('/api/audit', apiToken).then((data) => setEvents(data.events || []))
  }, [apiToken])

  return (
    <div className="page-stack">
      <SectionHeader eyebrow="Audit" title="Control history" description="Every maintenance change, check trigger, and privileged action written by Sysadmin." />
      <div className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Site</th>
              <th>Environment</th>
              <th>Actor</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.action}</td>
                <td>{event.site_key || '—'}</td>
                <td>{event.environment_key || '—'}</td>
                <td>{event.actor_email || 'unknown'}</td>
                <td>{new Date(event.created_at).toLocaleString('en-GB')}</td>
              </tr>
            ))}
            {!events.length ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-panel">No audit events written yet.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

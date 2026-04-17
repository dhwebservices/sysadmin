import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/auth-context'
import { apiGet } from '../lib/api'
import SectionHeader from '../components/common/SectionHeader'
import SiteStatusPill from '../components/sites/SiteStatusPill'
import { Link } from 'react-router-dom'

export default function SitesPage() {
  const { apiToken } = useAuth()
  const [sites, setSites] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!apiToken) return
    apiGet('/api/sites', apiToken).then((data) => setSites(data.sites || []))
  }, [apiToken])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sites
    return sites.filter((site) =>
      [site.name, site.site_key, site.github_repo, site.category].filter(Boolean).some((value) => value.toLowerCase().includes(q)),
    )
  }, [query, sites])

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Inventory"
        title="Managed sites"
        description="The sysadmin registry across production, staging, and preview environments."
      />

      <div className="toolbar-card">
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by site name, repo, or key"
        />
      </div>

      <div className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Category</th>
              <th>Production</th>
              <th>Environments</th>
              <th>Latest deploy</th>
              <th>Repo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((site) => {
              const production = site.environments?.find((env) => env.env_key === 'production') || site.environments?.[0]
              return (
                <tr key={site.site_key}>
                  <td>
                    <div className="table-strong">{site.name}</div>
                    <div className="table-meta mono">{site.site_key}</div>
                  </td>
                  <td>{site.category.replace(/_/g, ' ')}</td>
                  <td><SiteStatusPill status={production?.rolled_up_status || 'unknown'} /></td>
                  <td>{site.environments?.length || 0}</td>
                  <td>{site.integrations?.cloudflare?.latestDeploymentAt ? new Date(site.integrations.cloudflare.latestDeploymentAt).toLocaleString('en-GB') : 'Unavailable'}</td>
                  <td className="mono">{site.github_repo}</td>
                  <td><Link className="inline-link" to={`/sites/${site.site_key}`}>Open</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

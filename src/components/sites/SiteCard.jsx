import { Link } from 'react-router-dom'
import SiteStatusPill from './SiteStatusPill'

export default function SiteCard({ site }) {
  const production = site.environments?.find((env) => env.env_key === 'production') || site.environments?.[0]
  const latestCheck = production?.latest_check || null
  const responseTime = latestCheck?.latency_ms ? `${latestCheck.latency_ms}ms` : 'No check'
  const latestCommit = site.integrations?.github?.latestCommitSha
    ? site.integrations.github.latestCommitSha.slice(0, 7)
    : 'Unavailable'
  const latestDeploy = site.integrations?.cloudflare?.latestDeploymentAt
    ? new Date(site.integrations.cloudflare.latestDeploymentAt).toLocaleString('en-GB')
    : 'Unavailable'

  return (
    <Link to={`/sites/${site.site_key}`} className="site-card">
      <div className="site-card-top">
        <div>
          <div className="site-card-eyebrow">{site.category.replace(/_/g, ' ')}</div>
          <h3>{site.name}</h3>
        </div>
        <SiteStatusPill status={production?.rolled_up_status || 'unknown'} />
      </div>
      <div className="site-card-grid">
        <div>
          <span>Production</span>
          <strong>{production?.base_url || 'Unset'}</strong>
        </div>
        <div>
          <span>Latency</span>
          <strong>{responseTime}</strong>
        </div>
        <div>
          <span>Last checked</span>
          <strong>{latestCheck?.checked_at ? new Date(latestCheck.checked_at).toLocaleString('en-GB') : 'Pending'}</strong>
        </div>
        <div>
          <span>Repo</span>
          <strong>{site.github_repo}</strong>
        </div>
        <div>
          <span>Latest commit</span>
          <strong className="mono">{latestCommit}</strong>
        </div>
        <div>
          <span>Last deploy</span>
          <strong>{latestDeploy}</strong>
        </div>
      </div>
    </Link>
  )
}

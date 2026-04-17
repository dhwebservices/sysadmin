export default function SiteStatusPill({ status }) {
  const normalized = status || 'unknown'
  return <span className={`status-pill tone-${normalized}`}>{normalized}</span>
}

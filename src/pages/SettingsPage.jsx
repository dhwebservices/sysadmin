import SectionHeader from '../components/common/SectionHeader'

export default function SettingsPage() {
  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Setup"
        title="Sysadmin integrations"
        description="This control plane expects a dedicated Supabase project, Entra app registration, Worker secrets, and per-site maintenance integration."
      />
      <div className="dashboard-grid narrow">
        <section className="panel">
          <h3 className="panel-title">Required environment values</h3>
          <div className="detail-matrix">
            <div><span>Frontend</span><strong className="mono">VITE_ENTRA_CLIENT_ID / VITE_ENTRA_AUTHORITY / VITE_SYSADMIN_API_URL</strong></div>
            <div><span>Worker</span><strong className="mono">SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ENTRA_TENANT_ID / ENTRA_CLIENT_ID</strong></div>
            <div><span>Cloudflare</span><strong className="mono">CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID</strong></div>
            <div><span>GitHub</span><strong className="mono">GITHUB_TOKEN (optional but recommended)</strong></div>
          </div>
        </section>
      </div>
    </div>
  )
}

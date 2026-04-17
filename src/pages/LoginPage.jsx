import { Shield } from 'lucide-react'
import { useAuth } from '../context/auth-context'

export default function LoginPage() {
  const { signIn, loading, error, isConfigured } = useAuth()

  return (
    <div className="login-shell">
      <section className="login-panel login-panel-dark">
        <div className="login-badge">DH operations</div>
        <h1>Control every DH system from one place.</h1>
        <p>
          Sysadmin gives DH admins one surface for maintenance state, uptime, incidents, deploy context,
          and shared site controls across your live apps and public sites.
        </p>
        <div className="login-notes">
          <div>Six production systems in scope</div>
          <div>Cloudflare + GitHub + Supabase aware</div>
          <div>Audited maintenance and incident actions</div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-head">
          <Shield size={18} />
          <span>Microsoft Entra sign-in</span>
        </div>
        <h2>Sign in to Sysadmin</h2>
        <p>Use your DH admin Microsoft account. Browser access alone does not grant control actions.</p>
        {!isConfigured ? <div className="alert-card error">Entra environment values are missing.</div> : null}
        {error ? <div className="alert-card error">{error}</div> : null}
        <button type="button" className="primary-button" onClick={signIn} disabled={!isConfigured || loading}>
          Continue with Microsoft
        </button>
      </section>
    </div>
  )
}

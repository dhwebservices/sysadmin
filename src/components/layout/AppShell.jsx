import { Link, NavLink, Outlet } from 'react-router-dom'
import { Activity, AlertTriangle, Cog, LayoutGrid, Server, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/auth-context'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/sites', label: 'Sites', icon: Server },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/audit', label: 'Audit', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Cog },
]

export default function AppShell() {
  const { viewer, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand-lockup">
          <div className="brand-mark">DH</div>
          <div>
            <div className="brand-eyebrow">Sysadmin</div>
            <div className="brand-title">Control Plane</div>
          </div>
        </div>

        <div className="side-section">
          {navItems.map((item) => {
            const IconComponent = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <IconComponent size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>

        <div className="side-callout">
          <div className="callout-title">
            <ShieldCheck size={16} />
            <span>Protected by Entra</span>
          </div>
          <p>All maintenance actions, health checks, and control changes are audited against your DH admin identity.</p>
        </div>

        <div className="side-footer">
          <div>
            <div className="viewer-name">{viewer?.name || viewer?.email || 'DH Admin'}</div>
            <div className="viewer-role">{viewer?.role || 'viewer'}</div>
          </div>
          <button type="button" className="ghost-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="top-bar">
          <div>
            <div className="top-bar-label">Operations</div>
            <h1 className="top-bar-title">DH systems control</h1>
          </div>
          <div className="top-bar-actions">
            <a className="top-link" href="https://dash.cloudflare.com" target="_blank" rel="noreferrer">
              Cloudflare
            </a>
            <a className="top-link" href="https://github.com/dhwebservices" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link className="top-link primary" to="/sites">
              Open sites
            </Link>
          </div>
        </header>
        <main className="page-frame">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

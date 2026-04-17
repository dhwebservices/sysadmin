import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'

export default function RequireAuth({ children }) {
  const { loading, account, isConfigured } = useAuth()

  if (loading) {
    return (
      <div className="screen-state">
        <div className="screen-state-mark">DH</div>
        <h1>Loading Sysadmin</h1>
        <p>Verifying your Microsoft session and loading live operations data.</p>
      </div>
    )
  }

  if (!isConfigured) {
    return (
      <div className="screen-state">
        <div className="screen-state-mark">DH</div>
        <h1>Entra configuration missing</h1>
        <p>Add the Sysadmin Entra environment values before using the control plane.</p>
      </div>
    )
  }

  if (!account) {
    return <Navigate to="/login" replace />
  }

  return children
}

import { useEffect, useMemo, useState } from 'react'
import { PublicClientApplication } from '@azure/msal-browser'
import { acquireApiToken, createMsalConfig, loginRequest } from '../lib/msal'
import { apiGet } from '../lib/api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [msalApp, setMsalApp] = useState(null)
  const [account, setAccount] = useState(null)
  const [apiToken, setApiToken] = useState(null)
  const [viewer, setViewer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const config = createMsalConfig()
      if (!config) {
        setLoading(false)
        return
      }
      const app = new PublicClientApplication(config)
      await app.initialize()
      const redirectResult = await app.handleRedirectPromise().catch(() => null)
      const active = redirectResult?.account || app.getActiveAccount() || app.getAllAccounts()[0] || null
      if (active) app.setActiveAccount(active)
      if (!cancelled) {
        setMsalApp(app)
        setAccount(active)
      }
    }
    init().catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Failed to initialize Microsoft login.')
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadViewer = async () => {
      if (!msalApp || !account) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const token = await acquireApiToken(msalApp, account)
        if (cancelled) return
        setApiToken(token)
        const me = await apiGet('/api/me', token)
        if (!cancelled) {
          setViewer(me)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load sysadmin session.')
          setViewer(null)
          setApiToken(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadViewer()
    return () => {
      cancelled = true
    }
  }, [msalApp, account])

  const value = useMemo(
    () => ({
      msalApp,
      account,
      apiToken,
      viewer,
      loading,
      error,
      isConfigured: !!createMsalConfig(),
      signIn: async () => {
        if (!msalApp) return
        const result = await msalApp.loginPopup(loginRequest)
        msalApp.setActiveAccount(result.account)
        setAccount(result.account)
      },
      signOut: async () => {
        if (!msalApp) return
        await msalApp.logoutPopup({ account: account || undefined })
        setAccount(null)
        setApiToken(null)
        setViewer(null)
      },
      refreshViewer: async () => {
        if (!apiToken) return null
        const me = await apiGet('/api/me', apiToken)
        setViewer(me)
        return me
      },
    }),
    [account, apiToken, error, loading, msalApp, viewer],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

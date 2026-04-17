const CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID
const AUTHORITY = import.meta.env.VITE_ENTRA_AUTHORITY

export function createMsalConfig() {
  if (!CLIENT_ID || !AUTHORITY) return null
  return {
    auth: {
      clientId: CLIENT_ID,
      authority: AUTHORITY,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'localStorage',
      temporaryCacheLocation: 'localStorage',
      storeAuthStateInCookie: true,
    },
  }
}

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
}

export async function acquireApiToken(msalApp, account) {
  const result = await msalApp.acquireTokenSilent({
    ...loginRequest,
    account,
  }).catch(() => msalApp.acquireTokenPopup(loginRequest))
  return result.idToken
}

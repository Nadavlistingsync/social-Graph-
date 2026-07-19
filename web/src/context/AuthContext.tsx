import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  changePassword as storeChangePassword,
  getCurrentAccount,
  hasAnyAccounts,
  logIn as storeLogIn,
  logOut as storeLogOut,
  signUp as storeSignUp,
  updateAccountName,
  type PublicAccount,
} from '../data/authStore'
import { claimLegacyWorkspaceIfNeeded } from '../data/graphStore'

type AuthContextValue = {
  version: number
  account: PublicAccount | null
  isLoggedIn: boolean
  hasAccounts: boolean
  signUp: (input: {
    name: string
    email: string
    password: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  logIn: (input: {
    email: string
    password: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  logOut: () => void
  updateName: (name: string) => void
  changePassword: (input: {
    currentPassword: string
    newPassword: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const value = useMemo<AuthContextValue>(() => {
    void version
    const account = getCurrentAccount()
    return {
      version,
      account,
      isLoggedIn: Boolean(account),
      hasAccounts: hasAnyAccounts(),
      signUp: async (input) => {
        const result = await storeSignUp(input)
        if (!result.ok) return result
        claimLegacyWorkspaceIfNeeded()
        bump()
        return { ok: true }
      },
      logIn: async (input) => {
        const result = await storeLogIn(input)
        if (!result.ok) return result
        claimLegacyWorkspaceIfNeeded()
        bump()
        return { ok: true }
      },
      logOut: () => {
        storeLogOut()
        bump()
      },
      updateName: (name) => {
        if (!account) return
        updateAccountName(account.id, name)
        bump()
      },
      changePassword: async (input) => {
        if (!account) return { ok: false, error: 'Not signed in' }
        const result = await storeChangePassword({ accountId: account.id, ...input })
        return result
      },
    }
  }, [version, bump])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

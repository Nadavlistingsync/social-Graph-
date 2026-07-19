import {
  hashPassword,
  normalizeEmail,
  validateEmail,
  validatePassword,
  verifyPassword,
} from '../lib/password'

const ACCOUNTS_KEY = 'sg-accounts-v1'
const SESSION_KEY = 'sg-session-v1'

export type AccountRecord = {
  id: string
  email: string
  name: string
  passwordSalt: string
  passwordHash: string
  createdAt: string
}

export type Session = {
  accountId: string
  email: string
}

export type PublicAccount = {
  id: string
  email: string
  name: string
  createdAt: string
}

function readAccounts(): AccountRecord[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AccountRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAccounts(accounts: AccountRecord[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    /* ignore */
  }
}

function toPublic(account: AccountRecord): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    createdAt: account.createdAt,
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.accountId || !parsed?.email) return null
    const account = readAccounts().find((a) => a.id === parsed.accountId)
    if (!account) return null
    return { accountId: account.id, email: account.email }
  } catch {
    return null
  }
}

export function setSession(session: Session | null): void {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function getCurrentAccount(): PublicAccount | null {
  const session = getSession()
  if (!session) return null
  const account = readAccounts().find((a) => a.id === session.accountId)
  return account ? toPublic(account) : null
}

export function hasAnyAccounts(): boolean {
  return readAccounts().length > 0
}

function newAccountId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function signUp(input: {
  name: string
  email: string
  password: string
}): Promise<{ ok: true; account: PublicAccount } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required' }

  const emailError = validateEmail(input.email)
  if (emailError) return { ok: false, error: emailError }

  const passwordError = validatePassword(input.password)
  if (passwordError) return { ok: false, error: passwordError }

  const email = normalizeEmail(input.email)
  const accounts = readAccounts()
  if (accounts.some((a) => a.email === email)) {
    return { ok: false, error: 'An account with this email already exists' }
  }

  const { salt, hash } = await hashPassword(input.password)
  const account: AccountRecord = {
    id: newAccountId(),
    email,
    name,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  }
  writeAccounts([...accounts, account])
  setSession({ accountId: account.id, email: account.email })
  return { ok: true, account: toPublic(account) }
}

export async function logIn(input: {
  email: string
  password: string
}): Promise<{ ok: true; account: PublicAccount } | { ok: false; error: string }> {
  const emailError = validateEmail(input.email)
  if (emailError) return { ok: false, error: emailError }

  const email = normalizeEmail(input.email)
  const account = readAccounts().find((a) => a.email === email)
  if (!account) return { ok: false, error: 'Incorrect email or password' }

  const valid = await verifyPassword(input.password, account.passwordSalt, account.passwordHash)
  if (!valid) return { ok: false, error: 'Incorrect email or password' }

  setSession({ accountId: account.id, email: account.email })
  return { ok: true, account: toPublic(account) }
}

export function logOut(): void {
  setSession(null)
}

export function updateAccountName(accountId: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  const accounts = readAccounts()
  const next = accounts.map((a) => (a.id === accountId ? { ...a, name: trimmed } : a))
  writeAccounts(next)
}

export async function changePassword(input: {
  accountId: string
  currentPassword: string
  newPassword: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const passwordError = validatePassword(input.newPassword)
  if (passwordError) return { ok: false, error: passwordError }

  const accounts = readAccounts()
  const account = accounts.find((a) => a.id === input.accountId)
  if (!account) return { ok: false, error: 'Account not found' }

  const valid = await verifyPassword(
    input.currentPassword,
    account.passwordSalt,
    account.passwordHash,
  )
  if (!valid) return { ok: false, error: 'Current password is incorrect' }

  const { salt, hash } = await hashPassword(input.newPassword)
  const next = accounts.map((a) =>
    a.id === input.accountId ? { ...a, passwordSalt: salt, passwordHash: hash } : a,
  )
  writeAccounts(next)
  return { ok: true }
}

/** Active account id for scoped storage keys. */
export function getActiveAccountId(): string | null {
  return getSession()?.accountId ?? null
}

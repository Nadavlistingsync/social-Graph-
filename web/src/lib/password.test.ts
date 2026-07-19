import { beforeEach, describe, expect, it } from 'vitest'
import { getCurrentAccount, getSession, logIn, logOut, signUp } from '../data/authStore'
import { completeOnboarding, getProfile, isOnboarded, resetWorkspace } from '../data/graphStore'
import { hashPassword, validateEmail, validatePassword, verifyPassword } from './password'

beforeEach(() => {
  localStorage.clear()
  resetWorkspace()
})

describe('password helpers', () => {
  it('validates email and password rules', () => {
    expect(validateEmail('')).toBeTruthy()
    expect(validateEmail('bad')).toBeTruthy()
    expect(validateEmail('you@example.com')).toBeNull()
    expect(validatePassword('short')).toBeTruthy()
    expect(validatePassword('longenough')).toBeNull()
  })

  it('hashes and verifies passwords', async () => {
    const { salt, hash } = await hashPassword('secretpass')
    expect(await verifyPassword('secretpass', salt, hash)).toBe(true)
    expect(await verifyPassword('wrongpass', salt, hash)).toBe(false)
  })
})

describe('authStore', () => {
  it('signs up, logs out, and logs back in', async () => {
    const created = await signUp({
      name: 'Alex Chen',
      email: 'Alex@Example.com',
      password: 'password1',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.account.email).toBe('alex@example.com')
    expect(getSession()?.accountId).toBe(created.account.id)
    expect(getCurrentAccount()?.name).toBe('Alex Chen')

    completeOnboarding('Alex Chen', true)
    expect(isOnboarded()).toBe(true)
    expect(getProfile().name).toBe('Alex Chen')

    logOut()
    expect(getSession()).toBeNull()
    expect(isOnboarded()).toBe(false)

    const again = await logIn({ email: 'alex@example.com', password: 'password1' })
    expect(again.ok).toBe(true)
    expect(isOnboarded()).toBe(true)
    expect(getProfile().name).toBe('Alex Chen')
  })

  it('rejects duplicate email and bad passwords', async () => {
    const first = await signUp({
      name: 'Alex',
      email: 'alex@example.com',
      password: 'password1',
    })
    expect(first.ok).toBe(true)

    const dup = await signUp({
      name: 'Other',
      email: 'alex@example.com',
      password: 'password2',
    })
    expect(dup.ok).toBe(false)

    const bad = await logIn({ email: 'alex@example.com', password: 'wrongpass' })
    expect(bad.ok).toBe(false)
  })
})

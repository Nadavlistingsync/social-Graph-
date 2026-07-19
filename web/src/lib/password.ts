const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BITS = 256

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(bytes)
  return bufferToBase64(bytes.buffer)
}

async function deriveHash(password: string, saltBase64: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltBase64) as BufferSource,
      iterations: ITERATIONS,
    },
    keyMaterial,
    HASH_BITS,
  )
  return bufferToBase64(bits)
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomSalt()
  const hash = await deriveHash(password, salt)
  return { salt, hash }
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await deriveHash(password, salt)
  if (hash.length !== expectedHash.length) return false
  let mismatch = 0
  for (let i = 0; i < hash.length; i++) {
    mismatch |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  }
  return mismatch === 0
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email)
  if (!normalized) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'Enter a valid email'
  return null
}

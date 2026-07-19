const CONTACT_STEP_KEY = 'sg-awaiting-contacts'

/** True while the post-signup “connect contacts” step should stay on screen. */
export function isAwaitingContactStep(): boolean {
  try {
    return sessionStorage.getItem(CONTACT_STEP_KEY) === '1'
  } catch {
    return false
  }
}

export function markAwaitingContactStep(): void {
  try {
    sessionStorage.setItem(CONTACT_STEP_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearAwaitingContactStep(): void {
  try {
    sessionStorage.removeItem(CONTACT_STEP_KEY)
  } catch {
    /* ignore */
  }
}

const FIRST_RUN_KEY = 'sg-first-run-v1'

export function isFirstRunPending(): boolean {
  try {
    return sessionStorage.getItem(FIRST_RUN_KEY) === '1'
  } catch {
    return false
  }
}

export function markFirstRunPending(): void {
  try {
    sessionStorage.setItem(FIRST_RUN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearFirstRunPending(): void {
  try {
    sessionStorage.removeItem(FIRST_RUN_KEY)
  } catch {
    /* ignore */
  }
}

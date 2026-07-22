import { completeOnboarding } from './graphStore'
import { ensureMegaGraph } from './megaGraph'
import { saveWarmthOverride } from './preferences'
import { bestFirstHop, findPaths } from './paths'
import type { RankedPath } from './types'

export const DEMO_TARGET_ID = 'donald-trump'
export const DEMO_BRIDGE_ID = 'jay-neveloff'
export const DEMO_MODE_KEY = 'sg-demo-mode'
export const DEMO_STEP_KEY = 'sg-demo-step'
export const DEMO_STEP_EVENT = 'sg-demo-step'
export const DEMO_EXTENDED_EVENT = 'sg-demo-extended'

export type DemoStep = 1 | 2 | 3 | 4 | 5

export const DEMO_STEPS: Record<
  DemoStep,
  { title: string; body: string; cta?: string; route?: string }
> = {
  1: {
    title: '50,000 people on your map',
    body: 'This demo loads a synthetic network of 50,000 people with 100k+ connections. You’re at the center — not a CRM, a warm-intro engine.',
    cta: 'Next',
    route: '/',
  },
  2: {
    title: 'People you actually know',
    body: 'Jay Neveloff is one of 49 people you know directly — your warmest first hop in this 50k demo.',
    cta: 'Next',
    route: '/?focus=jay-neveloff',
  },
  3: {
    title: 'Their network',
    body: 'Toggle to Their network to see who your contacts know — second and third degree paths.',
    cta: 'Show their network',
    route: '/?focus=jay-neveloff',
  },
  4: {
    title: 'Find the warm intro',
    body: 'We rank who you should ask. Jay Neveloff is your best first hop to Donald Trump — watch the path build.',
    cta: 'See intro path',
    route: '/find?to=donald-trump',
  },
  5: {
    title: 'That’s the product',
    body: 'Import your real contacts next. We link coworkers, expand their network, and score who to ask.',
    cta: 'Try with my contacts',
  },
}

export function isDemoMode(): boolean {
  try {
    return sessionStorage.getItem(DEMO_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function getDemoStep(): DemoStep {
  try {
    const n = Number(sessionStorage.getItem(DEMO_STEP_KEY) || '1')
    if (n >= 1 && n <= 5) return n as DemoStep
  } catch {
    /* ignore */
  }
  return 1
}

export function setDemoStep(step: DemoStep) {
  try {
    sessionStorage.setItem(DEMO_STEP_KEY, String(step))
    window.dispatchEvent(new Event(DEMO_STEP_EVENT))
  } catch {
    /* ignore */
  }
}

export function getDemoShowcasePath(): RankedPath | null {
  const paths = findPaths(DEMO_TARGET_ID, { maxDepth: 5, maxPaths: 3, minStrength: 0.35 })
  return bestFirstHop(paths)?.path ?? paths[0] ?? null
}

export function getDemoSpotlightIds(step: DemoStep): Set<string> {
  const path = getDemoShowcasePath()
  const ids = new Set<string>()
  if (step === 1) {
    ids.add('you')
    if (path) ids.add(path.firstHopId)
    return ids
  }
  if (step === 2) {
    ids.add(DEMO_BRIDGE_ID)
    ids.add('you')
    return ids
  }
  if (step === 3) {
    ids.add(DEMO_BRIDGE_ID)
    ids.add('you')
    ids.add(DEMO_TARGET_ID)
    return ids
  }
  if (path) {
    for (const id of path.nodeIds) ids.add(id)
  }
  return ids
}

export function configureDemoWorkspace(name = 'Alex Chen') {
  completeOnboarding(name, true, 'Donald Trump', true)
  saveWarmthOverride(DEMO_BRIDGE_ID, {
    knownByUser: true,
    warmth: 0.85,
    score: 8,
    reason: 'Demo — you know Jay well',
    source: 'user',
    confirmed: true,
    ratedAt: new Date().toISOString(),
  })
}

export function markDemoSessionActive() {
  try {
    sessionStorage.setItem(DEMO_MODE_KEY, '1')
    sessionStorage.setItem(DEMO_STEP_KEY, '1')
    sessionStorage.removeItem('sg-pending-contacts')
    sessionStorage.removeItem('sg-onboarding-step')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(DEMO_STEP_EVENT))
}

export function startInvestorDemo(name = 'Alex Chen') {
  configureDemoWorkspace(name)
  ensureMegaGraph()
  markDemoSessionActive()
  window.dispatchEvent(new Event('sg-data-reloaded'))
}

/** After the walkthrough, drop into real contact import. */
export function startOwnContactsFromDemo() {
  exitDemoMode()
  try {
    sessionStorage.setItem('sg-pending-contacts', '1')
    sessionStorage.setItem('sg-onboarding-step', 'contacts')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('sg-contacts-gate'))
}

export function exitDemoMode() {
  try {
    sessionStorage.removeItem(DEMO_MODE_KEY)
    sessionStorage.removeItem(DEMO_STEP_KEY)
    window.dispatchEvent(new Event(DEMO_STEP_EVENT))
  } catch {
    /* ignore */
  }
}

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { bestFirstHop, findPaths, searchNodes } from './paths'
import { saveConnectionPreference } from './preferences'

const storage = new Map<string, string>()

vi.stubGlobal('localStorage', {
  get length() {
    return storage.size
  },
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  key: (index: number) => [...storage.keys()][index] ?? null,
  removeItem: (key: string) => storage.delete(key),
  setItem: (key: string, value: string) => storage.set(key, value),
})

beforeEach(() => storage.clear())
afterAll(() => vi.unstubAllGlobals())

describe('findPaths', () => {
  it('ranks a warm, connected first hop for the default target', () => {
    const paths = findPaths('donald-trump', { maxDepth: 5, maxPaths: 5, minStrength: 0.35 })
    const best = bestFirstHop(paths)

    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0].nodeIds[0]).toBe('nadav')
    expect(paths[0].nodeIds.at(-1)).toBe('donald-trump')
    expect(best?.node.id).toBe('jay-neveloff')
  })

  it('respects depth and strength constraints', () => {
    expect(findPaths('donald-trump', { maxDepth: 2, minStrength: 0.35 })).toEqual([])
    expect(findPaths('article-nyc-web', { maxDepth: 5, minStrength: 0.35 })).toEqual([])
    expect(findPaths('article-nyc-web', { maxDepth: 5, minStrength: 0.15 }).length).toBeGreaterThan(0)
  })

  it('returns no path when source and target are identical', () => {
    expect(findPaths('nadav')).toEqual([])
  })

  it('uses a user-confirmed contact as a direct first hop', () => {
    saveConnectionPreference('gil-dezer', { known: true, warmth: 0.95 })

    const best = bestFirstHop(
      findPaths('donald-trump', { maxDepth: 2, maxPaths: 5, minStrength: 0.35 }),
    )

    expect(best?.node.id).toBe('gil-dezer')
    expect(best?.path.nodeIds).toEqual(['nadav', 'gil-dezer', 'donald-trump'])
  })
})

describe('searchNodes', () => {
  it('matches names, summaries, and tags without case sensitivity', () => {
    expect(searchNodes('KUSHNER').map((node) => node.id)).toContain('jared-kushner')
    expect(searchNodes('podcast target').map((node) => node.id)).toContain('gil-dezer')
    expect(searchNodes('high-trust bridge').map((node) => node.id)).toContain('jay-neveloff')
  })

  it('returns people for an empty query', () => {
    expect(searchNodes('')).not.toHaveLength(0)
    expect(searchNodes('').every((node) => node.type === 'person')).toBe(true)
  })
})

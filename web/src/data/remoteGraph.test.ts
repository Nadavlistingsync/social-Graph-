import { describe, expect, it } from 'vitest'
import { __test } from './remoteGraph'
import type { UserDataBlob } from './userDataBlob'

const { blobTimestamp, remoteHasContent } = __test

function blob(partial: Partial<UserDataBlob> & { workspace: UserDataBlob['workspace'] }): UserDataBlob {
  return {
    version: 2,
    warmth: {},
    awkwardEdges: [],
    notes: {},
    ...partial,
  }
}

describe('remoteGraph reconcile helpers', () => {
  it('parses exportedAt timestamps', () => {
    expect(blobTimestamp(blob({ workspace: { profile: { name: '', summary: '', onboarded: false, loadSample: false }, customNodes: [], customEdges: [] }, exportedAt: '2026-01-01T00:00:00.000Z' }))).toBe(
      Date.parse('2026-01-01T00:00:00.000Z'),
    )
    expect(blobTimestamp(blob({ workspace: { profile: { name: '', summary: '', onboarded: false, loadSample: false }, customNodes: [], customEdges: [] } }))).toBe(0)
  })

  it('detects remote content from onboarded profile or customs', () => {
    expect(
      remoteHasContent(
        blob({
          workspace: {
            profile: { name: 'A', summary: '', onboarded: true, loadSample: false },
            customNodes: [],
            customEdges: [],
          },
        }),
      ),
    ).toBe(true)
    expect(
      remoteHasContent(
        blob({
          workspace: {
            profile: { name: '', summary: '', onboarded: false, loadSample: false },
            customNodes: [],
            customEdges: [],
          },
        }),
      ),
    ).toBe(false)
  })
})

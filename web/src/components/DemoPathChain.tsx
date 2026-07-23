import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNode } from '../data/paths'
import type { RankedPath } from '../data/types'

export function DemoPathChain({ path, reveal = true }: { path: RankedPath; reveal?: boolean }) {
  const navigate = useNavigate()
  const [shown, setShown] = useState(reveal ? 0 : path.nodeIds.length)

  useEffect(() => {
    if (!reveal) {
      setShown(path.nodeIds.length)
      return
    }
    setShown(0)
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setShown(i)
      if (i >= path.nodeIds.length) window.clearInterval(timer)
    }, 380)
    return () => window.clearInterval(timer)
  }, [path.id, path.nodeIds.length, reveal])

  return (
    <div className="demo-path-reveal">
      <div className="path-chain demo-path-chain">
        {path.nodeIds.map((nid, i) => {
          const n = getNode(nid)
          const visible = i < shown
          return (
            <span key={nid} className={`demo-path-segment ${visible ? 'in' : ''}`}>
              {i > 0 && <span className="arrow">→</span>}
              <button
                type="button"
                className={`node-pill ${i === 1 ? 'first' : ''} ${i === path.nodeIds.length - 1 ? 'target' : ''}`}
                onClick={() => navigate(i === 0 ? '/' : `/person/${nid}`)}
              >
                {n?.name ?? nid}
              </button>
            </span>
          )
        })}
      </div>
      <div className="demo-path-meta">
        <span>{path.hops.length} hops</span>
        <span>·</span>
        <span>{Math.round(path.scores.total * 100)}% match</span>
        {path.scores.warmth >= 0.7 && (
          <>
            <span>·</span>
            <span className="demo-warm-tag">Warm first hop</span>
          </>
        )}
      </div>
    </div>
  )
}

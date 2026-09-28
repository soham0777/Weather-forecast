import { useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { EDGES, LAYERS, NODES, connectedNodes } from '../data/architecture'

const STYLE = {
  rest: { idle: 'border-indigo-200 bg-white', active: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500', icon: 'text-indigo-600' },
  soap: { idle: 'border-violet-200 bg-white', active: 'border-violet-500 bg-violet-50 ring-2 ring-violet-500', icon: 'text-violet-600' },
  core: { idle: 'border-emerald-200 bg-white', active: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500', icon: 'text-emerald-600' },
}
const EDGE_COLOR = { rest: '#6366f1', soap: '#8b5cf6', core: '#10b981' }

/**
 * Four-layer architecture diagram. Clicking a node highlights every node
 * and connection on its request path; connector lines are measured from the
 * DOM so they stay correct at any screen width.
 */
export default function ArchitectureDiagram({ selected, onSelect }) {
  const containerRef = useRef(null)
  const nodeRefs = useRef({})
  const [lines, setLines] = useState([])
  const highlighted = connectedNodes(selected)

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = () => {
      const box = container.getBoundingClientRect()
      setLines(EDGES.map(([from, to]) => {
        const a = nodeRefs.current[from].getBoundingClientRect()
        const b = nodeRefs.current[to].getBoundingClientRect()
        const x1 = a.left + a.width / 2 - box.left
        const y1 = a.bottom - box.top
        const x2 = b.left + b.width / 2 - box.left
        const y2 = b.top - box.top
        const mid = (y1 + y2) / 2
        return { from, to, d: `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2 - 6}` }
      }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          {Object.entries(EDGE_COLOR).map(([key, color]) => (
            <marker key={key} id={`arrow-${key}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
          <marker id="arrow-idle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
          </marker>
        </defs>
        {lines.map(({ from, to, d }) => {
          const active = highlighted.has(from) && highlighted.has(to)
          const style = NODES[from].style === 'core' ? 'core' : NODES[from].style
          return (
            <path key={`${from}-${to}`} d={d} fill="none"
              stroke={active ? EDGE_COLOR[style] : '#cbd5e1'} strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={active || !selected ? undefined : '4 4'}
              markerEnd={`url(#arrow-${active ? style : 'idle'})`} />
          )
        })}
      </svg>

      <div className="relative space-y-10">
        {LAYERS.map((layer) => (
          <div key={layer.id}>
            <p className="mb-2 text-center">
              <span className="inline-block rounded bg-white px-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                {layer.number} · {layer.name} <span className="font-normal normal-case">— {layer.hint}</span>
              </span>
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {Object.entries(NODES).filter(([, n]) => n.layer === layer.id).map(([id, node]) => {
                const style = STYLE[node.style]
                const isSelected = selected === id
                const dimmed = selected && !highlighted.has(id)
                return (
                  <button key={id} ref={(el) => { nodeRefs.current[id] = el }} type="button" onClick={() => onSelect(id)}
                    aria-pressed={isSelected}
                    className={`relative flex items-center gap-2 rounded-xl border-2 py-2 text-left shadow-sm transition-all hover:shadow-md ${
                      node.layer === 'channel' ? 'px-2.5' : 'min-w-40 px-3'} ${
                      isSelected || (highlighted.has(id) && selected) ? style.active : dimmed ? 'border-slate-200 bg-white' : style.idle}`}>
                    <Icon name={node.icon} className={`h-4 w-4 shrink-0 ${style.icon} ${dimmed ? 'opacity-40' : ''}`} />
                    <span className={dimmed ? 'opacity-40' : ''}>
                      <span className={`block font-semibold whitespace-nowrap text-slate-900 ${node.layer === 'channel' ? 'text-[13px]' : 'text-sm'}`}>{node.label}</span>
                      {node.sublabel && <span className="block font-mono text-[11px] text-slate-500">{node.sublabel}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

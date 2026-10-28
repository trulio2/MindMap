import { useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import type { TopicFlowNode } from '../types'
import NodeHandles from './NodeHandles'

export default function TopicNode({ id, data, selected }: NodeProps<TopicFlowNode>) {
  const editing = useUi((s) => s.editingNodeId === id)
  const setEditing = useUi((s) => s.setEditing)
  const updateNodeData = useMindMap((s) => s.updateNodeData)
  const [draft, setDraft] = useState(data.label)
  const inputRef = useRef<HTMLInputElement>(null)

  // New nodes stay hidden until React Flow measures them, which defeats
  // autoFocus, so keep trying for a few frames.
  useEffect(() => {
    if (!editing) return
    let frame = 0
    let tries = 0
    const focus = () => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      if (document.activeElement === input) input.select()
      else if (++tries < 30) frame = requestAnimationFrame(focus)
    }
    focus()
    return () => cancelAnimationFrame(frame)
  }, [editing])

  function startEditing() {
    setDraft(data.label)
    setEditing(id)
  }

  function finishEditing(commit: boolean) {
    const label = draft.trim()
    if (commit && label) updateNodeData(id, { label })
    setEditing(null)
  }

  return (
    <div
      className={`topic-node${selected ? ' selected' : ''}`}
      onDoubleClick={startEditing}
    >
      <NodeHandles />
      {editing ? (
        <input
          className="topic-input nodrag"
          value={draft}
          size={Math.max(draft.length, 4)}
          ref={inputRef}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finishEditing(true)
            if (e.key === 'Escape') finishEditing(false)
          }}
        />
      ) : (
        <span className="topic-label">{data.label}</span>
      )}
    </div>
  )
}

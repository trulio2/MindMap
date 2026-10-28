import { NodeResizer } from '@xyflow/react'
import { renderBlocks } from '@/lib/markdown'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import InlineInput from '../InlineInput'
import type { MapNodeProps } from '../types'
import AreaBadge from './AreaBadge'
import NodeHandles from './NodeHandles'
import NodeMenu from './NodeMenu'

export default function StickyNode({ id, data, selected }: MapNodeProps) {
  const editing = useUi((s) => s.editingId === id)
  const setEditing = useUi((s) => s.setEditing)
  const updateNodeData = useMindMap((s) => s.updateNodeData)
  const deleteNodes = useMindMap((s) => s.deleteNodes)
  const checkpoint = useMindMap((s) => s.checkpoint)

  function finishEditing(text: string | null) {
    if (text) updateNodeData(id, { text })
    else if (text === '' && data.text) deleteNodes([id])
    setEditing(null)
  }

  return (
    <div
      className={`mm-node sticky-node${selected ? ' selected' : ''}`}
      data-color={data.color}
      onDoubleClick={() => setEditing(id)}
    >
      <NodeMenu id={id} selected={selected} color={data.color} />
      <NodeHandles />
      <AreaBadge id={id} count={data.childCount} />
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={120}
        minHeight={100}
        onResizeStart={checkpoint}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      {editing ? (
        <InlineInput
          initial={data.text ?? ''}
          placeholder="Write a note…"
          multiline
          formatting
          onDone={finishEditing}
        />
      ) : (
        <div className="sticky-body md nowheel">
          {renderBlocks(data.text ?? '')}
        </div>
      )}
    </div>
  )
}

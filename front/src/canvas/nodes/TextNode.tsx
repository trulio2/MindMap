import { NodeResizeControl } from '@xyflow/react'
import { renderBlocks } from '@/lib/markdown'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import InlineInput from '../InlineInput'
import type { MapNodeProps } from '../types'
import AreaBadge from './AreaBadge'
import NodeHandles from './NodeHandles'
import NodeMenu from './NodeMenu'

export default function TextNode({ id, data, selected }: MapNodeProps) {
  const editing = useUi((s) => s.editingId === id)
  const setEditing = useUi((s) => s.setEditing)
  const updateNodeData = useMindMap((s) => s.updateNodeData)
  const deleteNodes = useMindMap((s) => s.deleteNodes)
  const checkpoint = useMindMap((s) => s.checkpoint)

  function finishEditing(text: string | null) {
    if (text) updateNodeData(id, { text })
    // Clearing the text of a bubble removes it. A new bubble left empty is
    // removed by the store once editing ends.
    else if (text === '' && data.text) deleteNodes([id])
    setEditing(null)
  }

  return (
    <div
      className={`mm-node text-node${selected ? ' selected' : ''}`}
      data-color={data.color}
      onDoubleClick={() => setEditing(id)}
    >
      <NodeMenu id={id} color={data.color} />
      <NodeHandles />
      <AreaBadge id={id} count={data.childCount} />
      {selected && (
        <NodeResizeControl
          position="right"
          resizeDirection="horizontal"
          minWidth={120}
          onResizeStart={checkpoint}
          className="width-handle"
        />
      )}
      {editing ? (
        <InlineInput
          initial={data.text ?? ''}
          placeholder="Write something…"
          multiline
          formatting
          onDone={finishEditing}
        />
      ) : (
        <div className="text-body md">{renderBlocks(data.text ?? '')}</div>
      )}
    </div>
  )
}

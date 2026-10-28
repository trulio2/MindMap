import { NodeResizeControl } from '@xyflow/react'
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

  // Saving or cancelling a bubble with no text removes it.
  function finishEditing(text: string | null) {
    setEditing(null)
    if (text) updateNodeData(id, { text })
    else if (text === '' || !data.text) deleteNodes([id])
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
          className="width-handle"
        />
      )}
      {editing ? (
        <InlineInput
          initial={data.text ?? ''}
          placeholder="Write something…"
          multiline
          onDone={finishEditing}
        />
      ) : (
        <p className="text-body">{data.text}</p>
      )}
    </div>
  )
}

import { renderInline } from '@/lib/markdown'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import InlineInput from '../InlineInput'
import type { MapNodeProps } from '../types'
import AreaBadge from './AreaBadge'
import NodeHandles from './NodeHandles'
import NodeMenu from './NodeMenu'

export default function TopicNode({ id, data, selected }: MapNodeProps) {
  const editing = useUi((s) => s.editingId === id)
  const setEditing = useUi((s) => s.setEditing)
  const updateNodeData = useMindMap((s) => s.updateNodeData)

  function finishEditing(label: string | null) {
    if (label) updateNodeData(id, { label })
    setEditing(null)
  }

  return (
    <div
      className={`mm-node topic-node${selected ? ' selected' : ''}`}
      data-color={data.color}
      onDoubleClick={() => setEditing(id)}
    >
      <NodeMenu id={id} selected={selected} color={data.color} />
      <NodeHandles />
      <AreaBadge id={id} count={data.childCount} />
      {editing ? (
        <InlineInput
          initial={data.label ?? ''}
          formatting
          onDone={finishEditing}
        />
      ) : (
        <span className="topic-label md">{renderInline(data.label ?? '')}</span>
      )}
    </div>
  )
}

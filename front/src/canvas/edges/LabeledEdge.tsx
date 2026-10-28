import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps
} from '@xyflow/react'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import InlineInput from '../InlineInput'
import type { FlowEdge } from '../types'

export default function LabeledEdge({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  style
}: EdgeProps<FlowEdge>) {
  const editing = useUi((s) => s.editingId === id)
  const setEditing = useUi((s) => s.setEditing)
  const setEdgeLabel = useMindMap((s) => s.setEdgeLabel)
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  })
  const label = data?.label

  function finishEditing(value: string | null) {
    if (value !== null) setEdgeLabel(id, value)
    setEditing(null)
  }

  return (
    <>
      <BaseEdge id={id} path={path} style={style} interactionWidth={24} />
      {(editing || label) && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label nodrag nopan${selected ? ' selected' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
            }}
            onDoubleClick={() => setEditing(id)}
          >
            {editing ? (
              <InlineInput
                initial={label ?? ''}
                placeholder="Label"
                onDone={finishEditing}
              />
            ) : (
              label
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

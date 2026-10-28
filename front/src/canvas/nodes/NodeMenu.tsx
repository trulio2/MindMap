import { NodeToolbar, Position } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { areaPath } from '@/lib/areas'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import { NODE_COLORS, type NodeColor } from '@/types'

type Props = {
  id: string
  color?: NodeColor
  children?: React.ReactNode
}

export default function NodeMenu({ id, color, children }: Props) {
  const updateNodeData = useMindMap((s) => s.updateNodeData)
  const navigate = useNavigate()
  const editing = useUi((s) => s.editingId === id)

  return (
    <NodeToolbar
      position={Position.Top}
      className="node-menu"
      isVisible={editing ? false : undefined}
    >
      <button
        type="button"
        className={`swatch swatch-none${color ? '' : ' active'}`}
        title="No color"
        aria-label="No color"
        onClick={() => updateNodeData(id, { color: undefined })}
      />
      {NODE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch${c === color ? ' active' : ''}`}
          data-color={c}
          title={c}
          aria-label={`Color ${c}`}
          onClick={() => updateNodeData(id, { color: c })}
        />
      ))}
      <span className="node-menu-sep" />
      {children}
      <button
        type="button"
        className="menu-btn"
        title="Open this node as its own map"
        onClick={() => navigate(areaPath(id))}
      >
        Open ↘
      </button>
    </NodeToolbar>
  )
}

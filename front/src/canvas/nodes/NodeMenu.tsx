import { NodeToolbar, Position } from '@xyflow/react'
import { useMindMap } from '@/store/mindmap.store'
import { NODE_COLORS, type NodeColor } from '@/types'

type Props = {
  id: string
  color?: NodeColor
  children?: React.ReactNode
}

/** Floating menu above a single selected node: color swatches plus extra actions. */
export default function NodeMenu({ id, color, children }: Props) {
  const updateNodeData = useMindMap((s) => s.updateNodeData)

  return (
    <NodeToolbar position={Position.Top} className="node-menu">
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
      {children && <span className="node-menu-sep" />}
      {children}
    </NodeToolbar>
  )
}

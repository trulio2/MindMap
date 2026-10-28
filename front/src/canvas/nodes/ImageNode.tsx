import { NodeResizer } from '@xyflow/react'
import { safeImageSrc } from '@/lib/url'
import { useMindMap } from '@/store/mindmap.store'
import type { MapNodeProps } from '../types'
import AreaBadge from './AreaBadge'
import NodeHandles from './NodeHandles'
import NodeMenu from './NodeMenu'

export default function ImageNode({ id, data, selected }: MapNodeProps) {
  const src = safeImageSrc(data.src)
  const checkpoint = useMindMap((s) => s.checkpoint)

  return (
    <div
      className={`mm-node image-node${selected ? ' selected' : ''}`}
      data-color={data.color}
    >
      <NodeMenu id={id} selected={selected} color={data.color} />
      <NodeHandles />
      <AreaBadge id={id} count={data.childCount} />
      <NodeResizer
        isVisible={selected}
        keepAspectRatio
        minWidth={40}
        onResizeStart={checkpoint}
        minHeight={40}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      {src ? (
        <img src={src} alt={data.label ?? ''} draggable={false} />
      ) : (
        <span className="image-missing">Image unavailable</span>
      )}
    </div>
  )
}

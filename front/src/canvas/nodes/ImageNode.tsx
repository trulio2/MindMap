import { NodeResizer } from '@xyflow/react'
import { safeImageSrc } from '@/lib/url'
import type { MapNodeProps } from '../types'
import NodeHandles from './NodeHandles'
import NodeMenu from './NodeMenu'

export default function ImageNode({ id, data, selected }: MapNodeProps) {
  const src = safeImageSrc(data.src)

  return (
    <div
      className={`mm-node image-node${selected ? ' selected' : ''}`}
      data-color={data.color}
    >
      <NodeMenu id={id} color={data.color} />
      <NodeHandles />
      <NodeResizer
        isVisible={selected}
        keepAspectRatio
        minWidth={40}
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

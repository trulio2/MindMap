import { useState } from 'react'
import { displayHost, normalizeUrl, safeHref } from '@/lib/url'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import { useAutoFocus } from '../useAutoFocus'
import type { MapNodeProps } from '../types'
import AreaBadge from './AreaBadge'
import NodeHandles from './NodeHandles'
import NodeMenu from './NodeMenu'

type LinkValue = { label: string; url: string }

type EditorProps = LinkValue & {
  onDone: (value: LinkValue | null) => void
}

function LinkEditor({ label, url, onDone }: EditorProps) {
  const [draftUrl, setDraftUrl] = useState(url)
  const [draftLabel, setDraftLabel] = useState(label)
  const urlRef = useAutoFocus<HTMLInputElement>(true)
  const invalid = draftUrl.trim() !== '' && !normalizeUrl(draftUrl)

  function save() {
    const normalized = normalizeUrl(draftUrl)
    onDone(normalized ? { label: draftLabel.trim(), url: normalized } : null)
  }

  return (
    <form
      className="link-editor nodrag"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone(null)
      }}
    >
      <input
        ref={urlRef}
        className="inline-input"
        value={draftUrl}
        placeholder="https://example.com"
        aria-label="Link address"
        aria-invalid={invalid}
        onChange={(e) => setDraftUrl(e.target.value)}
      />
      <input
        className="inline-input"
        value={draftLabel}
        placeholder="Title (optional)"
        aria-label="Link title"
        onChange={(e) => setDraftLabel(e.target.value)}
      />
      <button type="submit" hidden />
    </form>
  )
}

export default function LinkNode({ id, data, selected }: MapNodeProps) {
  const editing = useUi((s) => s.editingId === id)
  const setEditing = useUi((s) => s.setEditing)
  const updateNodeData = useMindMap((s) => s.updateNodeData)
  const href = safeHref(data.url)

  function finishEditing(value: LinkValue | null) {
    if (value) updateNodeData(id, value)
    setEditing(null)
  }

  return (
    <div
      className={`mm-node link-node${selected ? ' selected' : ''}`}
      data-color={data.color}
      onDoubleClick={() => setEditing(id)}
    >
      <NodeMenu id={id} color={data.color}>
        <button
          type="button"
          className="menu-btn"
          onClick={() => setEditing(id)}
        >
          Edit
        </button>
      </NodeMenu>
      <NodeHandles />
      <AreaBadge id={id} count={data.childCount} />
      {editing ? (
        <LinkEditor
          label={data.label ?? ''}
          url={data.url ?? ''}
          onDone={finishEditing}
        />
      ) : (
        <>
          <span className="link-icon" aria-hidden="true">
            ↗
          </span>
          <span className="link-text">
            {href ? (
              <a
                className="link-title nodrag"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {data.label || displayHost(href)}
              </a>
            ) : (
              <span className="link-title">{data.label || 'Invalid link'}</span>
            )}
            {href && data.label && (
              <span className="link-host">{displayHost(href)}</span>
            )}
          </span>
        </>
      )}
    </div>
  )
}

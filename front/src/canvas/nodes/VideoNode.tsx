import { useState } from 'react'
import { NodeResizeControl } from '@xyflow/react'
import { renderBlocks } from '@/lib/markdown'
import { embedUrl, parseYouTube, thumbnailUrl, watchUrl } from '@/lib/video'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import { useAutoFocus } from '../useAutoFocus'
import type { MapNodeProps } from '../types'
import AreaBadge from './AreaBadge'
import NodeHandles from './NodeHandles'
import NodeMenu from './NodeMenu'

type VideoValue = { url: string; label: string; text: string }

type EditorProps = VideoValue & {
  onDone: (value: VideoValue | null) => void
}

function VideoEditor({ url, label, text, onDone }: EditorProps) {
  const [draft, setDraft] = useState({ url, label, text })
  const urlRef = useAutoFocus<HTMLInputElement>(true)
  const video = parseYouTube(draft.url)
  const invalid = draft.url.trim() !== '' && !video

  function save() {
    onDone(
      video
        ? {
            url: watchUrl(video),
            label: draft.label.trim(),
            text: draft.text.trim()
          }
        : null
    )
  }

  const field =
    (key: keyof VideoValue) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }))

  return (
    <form
      className="node-editor video-editor nodrag nowheel"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      // Save once focus leaves the form, not when moving between its fields.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone(null)
        // Ctrl/Cmd+Enter saves from the description too.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
      }}
    >
      <input
        ref={urlRef}
        className="inline-input"
        value={draft.url}
        placeholder="YouTube link"
        aria-label="YouTube link"
        aria-invalid={invalid}
        onChange={field('url')}
      />
      {invalid && (
        <span className="field-error">That isn't a YouTube video link.</span>
      )}
      <input
        className="inline-input"
        value={draft.label}
        placeholder="Title (optional)"
        aria-label="Video title"
        onChange={field('label')}
      />
      <textarea
        className="inline-input"
        value={draft.text}
        placeholder="Description (optional, supports **formatting**)"
        aria-label="Video description"
        rows={Math.max(draft.text.split('\n').length, 2)}
        onChange={field('text')}
      />
      <button type="submit" hidden />
    </form>
  )
}

export default function VideoNode({ id, data, selected }: MapNodeProps) {
  const editing = useUi((s) => s.editingId === id)
  const setEditing = useUi((s) => s.setEditing)
  const updateNodeData = useMindMap((s) => s.updateNodeData)
  const checkpoint = useMindMap((s) => s.checkpoint)
  // The YouTube player only loads once you press play; until then only
  // the thumbnail image comes from YouTube.
  const [playing, setPlaying] = useState(false)
  const [thumbFailed, setThumbFailed] = useState(false)
  const video = parseYouTube(data.url)

  function finishEditing(value: VideoValue | null) {
    // Save first: a video still without a link when editing ends is
    // removed by the store.
    if (value) {
      if (value.url !== data.url) {
        setPlaying(false)
        setThumbFailed(false)
      }
      updateNodeData(id, value)
    }
    setEditing(null)
  }

  return (
    <div
      className={`mm-node video-node${selected ? ' selected' : ''}`}
      data-color={data.color}
    >
      <NodeMenu id={id} color={data.color}>
        <button
          type="button"
          className="menu-btn"
          onClick={() => setEditing(id)}
        >
          Edit
        </button>
        {video && (
          <a
            className="menu-btn"
            href={watchUrl(video)}
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube ↗
          </a>
        )}
      </NodeMenu>
      <NodeHandles />
      <AreaBadge id={id} count={data.childCount} />
      {selected && (
        <NodeResizeControl
          position="right"
          resizeDirection="horizontal"
          minWidth={240}
          onResizeStart={checkpoint}
          className="width-handle"
        />
      )}
      {editing ? (
        <VideoEditor
          url={data.url ?? ''}
          label={data.label ?? ''}
          text={data.text ?? ''}
          onDone={finishEditing}
        />
      ) : (
        <>
          {/* Title and description are the drag area; the player is not. */}
          <div className="video-head" onDoubleClick={() => setEditing(id)}>
            {data.label && <span className="video-title">{data.label}</span>}
          </div>
          <div className="video-frame nodrag nowheel">
            {!video ? (
              <span className="video-missing">Not a YouTube link</span>
            ) : playing ? (
              <iframe
                src={embedUrl(video)}
                title={data.label || 'YouTube video'}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              />
            ) : (
              <button
                type="button"
                className="video-play"
                aria-label={`Play ${data.label || 'video'}`}
                onClick={() => setPlaying(true)}
              >
                {!thumbFailed && (
                  <img
                    className="video-thumb"
                    src={thumbnailUrl(video)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onError={() => setThumbFailed(true)}
                  />
                )}
                <span className="video-play-icon" aria-hidden="true">
                  ▶
                </span>
              </button>
            )}
          </div>
          {data.text && (
            <div className="video-desc md" onDoubleClick={() => setEditing(id)}>
              {renderBlocks(data.text)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

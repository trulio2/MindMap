import { useEffect } from 'react'
import { useUi } from '@/store/ui.store'

const INFO_TIMEOUT_MS = 5000

export default function NoticeBar() {
  const notice = useUi((s) => s.notice)
  const setNotice = useUi((s) => s.setNotice)

  useEffect(() => {
    if (notice?.kind !== 'info') return
    const timer = setTimeout(() => setNotice(null), INFO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  if (!notice) return null

  return (
    <div
      className={`banner notice-${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <span>{notice.text}</span>
      <button
        type="button"
        className="banner-close"
        aria-label="Dismiss"
        onClick={() => setNotice(null)}
      >
        ×
      </button>
    </div>
  )
}

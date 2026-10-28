import { useEffect, useRef } from 'react'

export function useAutoFocus<T extends HTMLInputElement | HTMLTextAreaElement>(
  active: boolean
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    let frame = 0
    let tries = 0
    const focus = () => {
      const el = ref.current
      if (!el) return
      el.focus()
      if (document.activeElement === el) el.select()
      else if (++tries < 30) frame = requestAnimationFrame(focus)
    }
    focus()
    return () => cancelAnimationFrame(frame)
  }, [active])

  return ref
}

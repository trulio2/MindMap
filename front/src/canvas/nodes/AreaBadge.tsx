import { useNavigate } from 'react-router-dom'
import { useAreaLink } from '../useAreaLink'

type Props = { id: string; count?: number }

export default function AreaBadge({ id, count }: Props) {
  const navigate = useNavigate()
  const areaPath = useAreaLink()
  if (!count) return null

  return (
    <button
      type="button"
      className="area-badge nodrag"
      title={`Open (${count} inside)`}
      aria-label={`Open, ${count} ${count === 1 ? 'item' : 'items'} inside`}
      onClick={() => navigate(areaPath(id))}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {count}
    </button>
  )
}

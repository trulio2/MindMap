import { Link } from 'react-router-dom'
import { areaPath, areaTrail, nodeTitle } from '@/lib/areas'
import { useMindMap } from '@/store/mindmap.store'
import { ROOT_AREA } from '@/types'

type Props = { areaId: string }

export default function Breadcrumbs({ areaId }: Props) {
  const nodes = useMindMap((s) => s.nodes)
  if (areaId === ROOT_AREA) return null

  const trail = areaTrail(nodes, areaId)
  const parentId = trail.at(-2)?.id ?? ROOT_AREA

  return (
    <nav className="breadcrumbs" aria-label="Location in map">
      <Link
        to={areaPath(parentId)}
        className="crumb-up"
        title="Up one level"
        aria-label="Up one level"
      >
        ↑
      </Link>
      <ol>
        <li>
          <Link to={areaPath(ROOT_AREA)}>Map</Link>
        </li>
        {trail.map((node, i) =>
          i === trail.length - 1 ? (
            <li key={node.id} aria-current="page">
              {nodeTitle(node)}
            </li>
          ) : (
            <li key={node.id}>
              <Link to={areaPath(node.id)}>{nodeTitle(node)}</Link>
            </li>
          )
        )}
      </ol>
    </nav>
  )
}

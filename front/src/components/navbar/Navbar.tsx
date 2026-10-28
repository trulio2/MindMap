import { Link } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/changelog', label: 'Changelog' }
]

export default function Navbar() {
  return (
    <nav className="navbar" aria-label="Primary">
      <Link to="/" className="navbar-brand">
        MindMap
      </Link>
      <ul className="navbar-links">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className={`navbar-link${isLinkActive(link.to) ? ' active' : ''}`}
              aria-current={isLinkActive(link.to) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

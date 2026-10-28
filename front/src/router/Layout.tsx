import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

function RootLayout() {
  return (
    <main className="app">
      <Outlet />
    </main>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="spinner" role="status" aria-label="Loading"></div>
      }
    >
      {children}
    </Suspense>
  )
}

export { LazyPage, RootLayout }

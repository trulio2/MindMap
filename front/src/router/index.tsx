import { createHashRouter, Navigate } from 'react-router-dom'
import { LazyPage, RootLayout } from './Layout'

import { ErrorPage, MapPage } from '@/views/pages'
import StartPage from '@/views/pages/start/StartPage'

const mapPage = (
  <LazyPage>
    <MapPage />
  </LazyPage>
)

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <StartPage /> },
      { path: 'map/:mapId', element: mapPage },
      { path: 'map/:mapId/area/:areaId', element: mapPage },
      { path: 'area/:areaId', element: <StartPage /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])

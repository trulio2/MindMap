import { createHashRouter, Navigate } from 'react-router-dom'
import { LazyPage, RootLayout } from './Layout'

import { ErrorPage, MapPage } from '@/views/pages'

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
      { index: true, element: mapPage },
      { path: 'area/:areaId', element: mapPage },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])

import { lazy } from 'react'
import ErrorPage from './error/ErrorPage'

const MapPage = lazy(() => import('./map/MapPage'))

export { ErrorPage, MapPage }

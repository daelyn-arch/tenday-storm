import { createHashRouter, Navigate } from 'react-router-dom'
import { Landing } from './views/Landing'
import { SetupWizard } from './views/SetupWizard'
import { DmView } from './views/DmView'
import { PlayerView } from './views/PlayerView'
import { JoinCampaign } from './views/JoinCampaign'
import { AuthGate } from './views/AuthGate'
import { MapPreview } from './views/MapPreview'
import { MapLab } from './views/MapLab'

// Hash router: paths live in the URL fragment (e.g. /#/c/abc/dm) so GitHub
// Pages — which only serves static files — never 404s on a deep link.
export const router = createHashRouter([
  // Auth-free preview route — see Pita's example maps and our procedural
  // generator side-by-side without going through the campaign flow.
  { path: '/preview', element: <MapPreview /> },
  { path: '/lab', element: <MapLab /> },
  {
    path: '/',
    element: <AuthGate />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'c/new', element: <SetupWizard /> },
      { path: 'c/:id/dm', element: <DmView /> },
      { path: 'c/:id/play', element: <PlayerView /> },
      { path: 'c/:id/join', element: <JoinCampaign /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

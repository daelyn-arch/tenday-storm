import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Landing } from './views/Landing'
import { SetupWizard } from './views/SetupWizard'
import { DmView } from './views/DmView'
import { PlayerView } from './views/PlayerView'
import { JoinCampaign } from './views/JoinCampaign'
import { AuthGate } from './views/AuthGate'

export const router = createBrowserRouter([
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

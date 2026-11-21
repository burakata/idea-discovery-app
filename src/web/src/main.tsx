import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startupSignInToken } from './screens/signInLink'
import './styles/base.css'
import './styles/app.css'

// The sign-in link's token leaves the address before anything else runs.
startupSignInToken(import.meta.env.BASE_URL.replace(/\/$/, ''))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import Index from './pages/Index'
import './index.css'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const app = googleClientId
  ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Index />
    </GoogleOAuthProvider>
  )
  : <Index />

ReactDOM.createRoot(document.getElementById('root')).render(app)

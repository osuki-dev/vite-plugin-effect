import { renderToString } from 'react-dom/server'
import { StrictMode } from 'react'
import App from './App.tsx'
import './index.css'

export function render() {
  const html = renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  return { html }
}

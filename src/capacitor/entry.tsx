import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@renderer/App'
import '@renderer/index.css'
import { installBridge } from './bridge'

function renderError(err: unknown) {
  const msg = err instanceof Error ? err.message + '\n' + err.stack : String(err)
  document.getElementById('root')!.innerHTML =
    `<pre style="color:red;padding:16px;white-space:pre-wrap;font-size:12px">${msg}</pre>`
  console.error('[Taskify bridge error]', err)
}

installBridge()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
  .catch(renderError)

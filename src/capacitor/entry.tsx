import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@renderer/App'
import '@renderer/index.css'
import { installBridge } from './bridge'

// Read Android status bar height synchronously before React renders so there
// is no layout flash. The value comes from the JavascriptInterface added in
// MainActivity.onCreate(). On iOS/desktop the object is absent — no-op.
declare const AndroidInsets: { getStatusBarHeight(): number } | undefined
if (typeof AndroidInsets !== 'undefined') {
  const h = AndroidInsets.getStatusBarHeight()
  if (h > 0) document.documentElement.style.setProperty('--status-bar-height', h + 'px')
}

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

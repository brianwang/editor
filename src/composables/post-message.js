/**
 * usePostMessage — postMessage bridge between Umo Editor (iframe) and parent page.
 *
 * Parent → Editor:
 *   { type: 'load-content',    html: string }
 *   { type: 'replace-content', html: string }
 *   { type: 'set-readonly',    readonly: boolean }
 *
 * Editor → Parent:
 *   { type: 'editor-ready' }
 *   { type: 'content-changed', html: string }   (debounced 1000ms)
 *   { type: 'content-saved',   html: string }
 *   { type: 'ai-generate-requested' }
 */

export const isIframeMode = () => window.parent !== window

/**
 * Post a message to the parent page (no-op when not in iframe).
 */
export function postToParent(data) {
  if (isIframeMode()) {
    window.parent.postMessage(data, '*')
  }
}

/**
 * Set up inbound message listener.
 * editorRef: Vue ref whose .value exposes setContent() and setEditable().
 * Returns cleanup function.
 */
export function setupPostMessageListener(editorRef) {
  const handler = (event) => {
    const { type, html, readonly } = event.data ?? {}

    if (type === 'load-content' && html != null) {
      editorRef.value?.setContent(html)
    }
    if (type === 'replace-content' && html != null) {
      editorRef.value?.setContent(html)
    }
    if (type === 'set-readonly') {
      editorRef.value?.setEditable(!readonly)
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

/**
 * Composable for use inside setup().
 * Registers listener on mount, cleans up on unmount, announces editor-ready.
 */
export function usePostMessage(editorRef) {
  let cleanup = null

  onMounted(() => {
    cleanup = setupPostMessageListener(editorRef)
    postToParent({ type: 'editor-ready' })
  })

  onBeforeUnmount(() => {
    cleanup?.()
  })

  return { postToParent, isIframeMode }
}

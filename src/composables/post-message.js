/**
 * usePostMessage — postMessage bridge between Umo Editor (iframe) and parent page.
 *
 * Parent → Editor:
 *   { type: 'load-content',    html: string }
 *   { type: 'replace-content', html: string }
 *   { type: 'set-readonly',    readonly: boolean }
 *   { type: 'ai-action-result', selectionId: string, result: string, mode: 'insert'|'replace' }
 *   { type: 'icon-library-result', icons: Array<{ name, svg, category? }> }
 *
 * Editor → Parent:
 *   { type: 'editor-ready' }
 *   { type: 'content-changed', html: string }   (debounced 1000ms)
 *   { type: 'content-saved',   html: string }
 *   { type: 'ai-generate-requested' }
 *   { type: 'ai-action-requested', action: string, text: string, selectionId: string }
 *   { type: 'icon-library-requested', query?: string }
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
    if (type === 'ai-action-result') {
      const { selectionId, result, mode } = event.data
      window.dispatchEvent(new CustomEvent('umo-ai-result', { detail: { selectionId, result, mode } }))
    }
    if (type === 'icon-library-result') {
      const { icons } = event.data
      window.dispatchEvent(new CustomEvent('umo-icon-library-result', { detail: { icons } }))
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

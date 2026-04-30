import { postToParent } from './post-message'

export function useAiActions(editor) {
  const pendingActions = new Map()

  function requestAiAction(action, mode = 'replace') {
    if (!editor.value) return
    const selectionId = crypto.randomUUID()
    const { from, to } = editor.value.state.selection
    const text = editor.value.state.doc.textBetween(from, to, ' ')
    pendingActions.set(selectionId, { mode, from, to })
    postToParent({ type: 'ai-action-requested', action, text, selectionId })
  }

  function handleResult(e) {
    const { selectionId, result, mode } = e.detail
    const pending = pendingActions.get(selectionId)
    if (!pending || !result || !editor.value) return
    pendingActions.delete(selectionId)
    if (mode === 'replace') {
      editor.value.chain().focus()
        .setTextSelection({ from: pending.from, to: pending.to })
        .insertContent(result)
        .run()
    } else {
      editor.value.chain().focus()
        .setTextSelection({ from: pending.to, to: pending.to })
        .insertContent('\n' + result)
        .run()
    }
  }

  onMounted(() => window.addEventListener('umo-ai-result', handleResult))
  onBeforeUnmount(() => window.removeEventListener('umo-ai-result', handleResult))

  return { requestAiAction }
}

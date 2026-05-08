import { generateJSON } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'

import {
  applyGeneratedContent,
  getAiContext,
  runContextAction,
} from './ai-assistant'

const normalizeContent = (result) => result?.json || result?.content || result?.html || result?.text || ''

const selectionToHtml = (editorInstance, from, to) => {
  if (!editorInstance || from === to) return ''
  const fragment = editorInstance.state.doc.slice(from, to).content
  const container = document.createElement('div')
  const serializer = DOMSerializer.fromSchema(editorInstance.schema)
  container.appendChild(serializer.serializeFragment(fragment))
  return container.innerHTML
}

const getSelectionTarget = (editorInstance) => {
  if (!editorInstance) return null
  const { from, to, empty } = editorInstance.state.selection
  if (empty) return null
  const text = editorInstance.state.doc.textBetween(from, to, ' ').trim()
  if (!text) return null
  return {
    from,
    to,
    text,
    html: selectionToHtml(editorInstance, from, to),
    source: 'selection',
  }
}

export const getActionTarget = (editorInstance, action) => {
  if (action === 'write') return null
  return getSelectionTarget(editorInstance)
}

const escapeHtml = (content) => content
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const textToHtml = (content) => content
  .split(/\n{2,}/)
  .map((item) => `<p>${escapeHtml(item).replace(/\n/g, '<br>')}</p>`)
  .join('')

const contentToTypewriterJson = (editorInstance, content) => {
  if (!editorInstance || !content) return null
  if (typeof content === 'object') return content
  const html = /<\/?[a-z][\s\S]*>/i.test(content) ? content : textToHtml(content)
  try {
    return generateJSON(html, editorInstance.extensionManager.extensions)
  } catch {
    return null
  }
}

export function useAiActions(editor, options) {
  const loading = ref(false)
  const progressVisible = ref(false)
  const progress = ref(0)
  const progressAction = ref('write')
  let requestId = 0

  const resetProgress = () => {
    progressVisible.value = false
    progress.value = 0
  }

  const startProgress = (action) => {
    progressAction.value = action
    progress.value = 8
    progressVisible.value = true
  }

  const finishProgress = () => {
    progress.value = 100
    setTimeout(resetProgress, 300)
  }

  const insertWithTypewriter = (editorInstance, content, range = null) => {
    const selection = range || {
      from: editorInstance.state.selection.to,
      to: editorInstance.state.selection.to,
    }
    const isReplacing = !!range
    editorInstance.chain().focus().setTextSelection(selection).run()
    const typewriterContent = contentToTypewriterJson(editorInstance, content)
    if (typewriterContent && editorInstance.commands.startTypewriter) {
      editorInstance.commands.startTypewriter(typewriterContent, {
        focus: isReplacing ? null : 'end',
        speed: 12,
        step: 1,
        onProgress(value) {
          progress.value = Math.min(99, Math.max(20, 20 + Math.round(value * 79)))
        },
        onComplete() {
          finishProgress()
        },
      })
      return
    }
    applyGeneratedContent(editor, content)
    finishProgress()
  }

  async function requestAiAction(action) {
    const editorInstance = editor.value
    if (!editorInstance || options.value.ai?.enabled === false || loading.value) return

    const currentRequestId = ++requestId
    const target = getActionTarget(editorInstance, action)
    if (action !== 'write' && !target) {
      useMessage('warning', `请先选择需要${t(`tools.aiActions.${action}`)}的文本`)
      return
    }

    loading.value = true
    startProgress(action)
    try {
      const context = getAiContext(editor, options)
      if (target) {
        context.selection = {
          from: target.from,
          to: target.to,
          empty: false,
          text: target.text,
          html: target.html,
          source: target.source,
        }
      }
      const result = await runContextAction(options, {
        action,
        prompt: '',
        context,
      })
      if (currentRequestId !== requestId) return
      progress.value = 20
      const content = normalizeContent(result)
      if (!content) {
        resetProgress()
        useMessage('warning', 'AI 未返回可插入内容')
        return
      }
      if (action === 'write') {
        insertWithTypewriter(editorInstance, content)
        return
      }
      insertWithTypewriter(editorInstance, content, target)
    } catch (error) {
      resetProgress()
      useMessage('error', error?.message || t('aiAssistant.generateFailed'))
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false
      }
    }
  }

  function stopAiAction() {
    requestId++
    loading.value = false
    editor.value?.commands.stopTypewriter?.()
    resetProgress()
  }

  return {
    loading,
    progressVisible,
    progress,
    progressAction,
    requestAiAction,
    stopAiAction,
  }
}

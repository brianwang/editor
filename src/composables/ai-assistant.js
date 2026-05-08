import { DOMSerializer } from '@tiptap/pm/model'

import { isIframeMode, postToParent } from './post-message'

const EXTERNAL_TIMEOUT = 120000

const FIELD_PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g
const AI_PLACEHOLDER_REGEX = /\[AI:([^\]]+)\]/g

const requestExternal = (type, payload) => {
  if (!isIframeMode()) {
    return Promise.reject(new Error('AI service is not configured.'))
  }
  const requestId = crypto.randomUUID()
  const resultType = type.replace('-requested', '-result')

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error(`Request "${type}" timed out.`))
    }, EXTERNAL_TIMEOUT)

    const handleMessage = (event) => {
      const data = event.data ?? {}
      if (data.type !== resultType || data.requestId !== requestId) {
        return
      }
      window.clearTimeout(timer)
      window.removeEventListener('message', handleMessage)
      if (data.error) {
        reject(new Error(data.error))
        return
      }
      resolve(data.result ?? data)
    }

    window.addEventListener('message', handleMessage)
    postToParent({ type, requestId, payload })
  })
}

const selectionToHtml = (editor, from, to) => {
  if (!editor || from === to) return ''
  const fragment = editor.state.doc.slice(from, to).content
  const container = document.createElement('div')
  const serializer = DOMSerializer.fromSchema(editor.schema)
  container.appendChild(serializer.serializeFragment(fragment))
  return container.innerHTML
}

const currentBlockToHtml = (editor) => {
  if (!editor) return ''
  const { $from } = editor.state.selection
  const start = $from.start($from.depth)
  const end = $from.end($from.depth)
  return selectionToHtml(editor, start, end)
}

const extractHeadings = (editor) => {
  const headings = []
  editor?.state.doc.descendants((node) => {
    if (node.type.name !== 'heading') return
    headings.push({
      level: node.attrs.level,
      text: node.textContent,
    })
  })
  return headings
}

export const extractTemplatePlaceholders = (content = '') => {
  const fields = []
  const ai = []
  let match
  while ((match = FIELD_PLACEHOLDER_REGEX.exec(content)) !== null) {
    if (!fields.includes(match[1])) fields.push(match[1])
  }
  while ((match = AI_PLACEHOLDER_REGEX.exec(content)) !== null) {
    if (!ai.includes(match[1])) ai.push(match[1])
  }
  return { fields, ai }
}

export const getAiContext = (editorRef, optionsRef) => {
  const editor = editorRef.value
  if (!editor) return {}
  const { from, to, empty } = editor.state.selection
  return {
    title: optionsRef.value.document?.title || '',
    toc: extractHeadings(editor),
    currentHtml: editor.getHTML(),
    currentText: editor.getText(),
    selection: {
      from,
      to,
      empty,
      html: empty ? '' : selectionToHtml(editor, from, to),
      text: empty ? '' : editor.state.doc.textBetween(from, to, ' '),
    },
    currentBlock: {
      html: currentBlockToHtml(editor),
      text: editor.state.selection.$from.parent.textContent,
    },
  }
}

const callConfigured = async (fn, messageType, payload) => {
  if (typeof fn === 'function') {
    return await fn(payload)
  }
  return await requestExternal(messageType, payload)
}

export const generateTemplateContent = async (optionsRef, payload) => {
  return await callConfigured(
    optionsRef.value.ai?.onGenerateTemplate,
    'ai-template-generate-requested',
    payload,
  )
}

export const polishContent = async (optionsRef, payload) => {
  return await callConfigured(
    optionsRef.value.ai?.onPolish,
    'ai-polish-requested',
    payload,
  )
}

export const chatGenerateContent = async (optionsRef, payload) => {
  return await callConfigured(
    optionsRef.value.ai?.onChatGenerate,
    'ai-chat-generate-requested',
    payload,
  )
}

export const runContextAction = async (optionsRef, payload) => {
  return await callConfigured(
    optionsRef.value.ai?.onContextAction,
    'ai-context-action-requested',
    payload,
  )
}

export const listTemplates = async (optionsRef, params = {}) => {
  const store = optionsRef.value.templateStore
  if (typeof store?.list === 'function') {
    return await store.list(params)
  }
  return optionsRef.value.documentTemplates || []
}

export const listStyleTemplates = async (optionsRef) => {
  const store = optionsRef.value.templateStore
  if (typeof store?.listStyleTemplates === 'function') {
    return await store.listStyleTemplates()
  }
  if (typeof store?.list === 'function') {
    return await store.list({ type: 'style', status: 'published' })
  }
  return await requestExternal('style-template-list-requested', {
    type: 'style',
    status: 'published',
  })
}

export const applyStyleTemplate = async (optionsRef, payload) => {
  const store = optionsRef.value.templateStore
  return await callConfigured(
    store?.applyStyleTemplate,
    'style-template-apply-requested',
    payload,
  )
}

export const saveTemplate = async (optionsRef, payload) => {
  const store = optionsRef.value.templateStore
  return await callConfigured(
    store?.save,
    'template-save-requested',
    payload,
  )
}

export const listTemplateVersions = async (optionsRef, templateId) => {
  const store = optionsRef.value.templateStore
  if (typeof store?.versions === 'function') {
    return await store.versions(templateId)
  }
  return await requestExternal('template-versions-requested', { templateId })
}

export const rollbackTemplate = async (optionsRef, payload) => {
  const store = optionsRef.value.templateStore
  return await callConfigured(
    store?.rollback,
    'template-rollback-requested',
    payload,
  )
}

export const applyGeneratedContent = (editorRef, content, range) => {
  const editor = editorRef.value
  if (!editor || !content) return
  if (range?.from !== undefined && range?.to !== undefined) {
    editor.chain().focus()
      .setTextSelection({ from: range.from, to: range.to })
      .insertContent(content)
      .run()
    return
  }
  editor.chain().focus().insertContent(content).run()
}

export const replaceDocumentContent = (editorRef, content) => {
  if (!editorRef.value || !content) return
  editorRef.value.commands.setContent(content)
}

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8100'

const backendBaseUrl = () => {
  return (
    import.meta.env.VITE_BACKEND_BASE_URL ||
    DEFAULT_BACKEND_BASE_URL
  ).replace(/\/$/, '')
}

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `请求失败：${response.status}`)
  }
  return data
}

const normalizePayload = (scene, payload = {}) => {
  const context = payload.context || {}
  const action = payload.action || (scene === 'polish' ? 'polish' : undefined)
  const html = action === 'write'
    ? context.currentHtml || ''
    : payload.html || context.selection?.html || context.currentHtml || ''
  return {
    scene,
    action,
    prompt: payload.prompt || '',
    context,
    template: payload.template || {},
    placeholders: payload.placeholders || {},
    html,
    title: payload.title || context.title || '',
    toc: payload.toc || context.toc || [],
  }
}

export const requestEditorAi = async (scene, payload = {}) => {
  return await requestJson('/api/editor/ai/generate', {
    method: 'POST',
    body: JSON.stringify(normalizePayload(scene, payload)),
  })
}

export const listEditorTemplates = async (params = {}) => {
  const search = new URLSearchParams()
  if (params.type) search.set('type', params.type)
  if (params.status) search.set('status', params.status)
  const qs = search.toString()
  return await requestJson(`/api/editor/templates${qs ? `?${qs}` : ''}`)
}

export const saveEditorTemplate = async (payload = {}) => {
  return await requestJson('/api/editor/templates', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      remark: payload.remark,
      content: payload.content,
      type: payload.type || 'user',
      context: payload.context || {},
    }),
  })
}

export const listEditorTemplateVersions = async (templateId) => {
  return await requestJson(`/api/editor/templates/${templateId}/versions`)
}

export const rollbackEditorTemplate = async (payload = {}) => {
  return await requestJson(`/api/editor/templates/${payload.templateId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({
      version_id: payload.versionId,
      version: payload.version,
    }),
  })
}

export const listEditorStyleTemplates = async () => {
  return await requestJson('/api/editor/style-templates')
}

export const createEditorBackendAi = () => ({
  ai: {
    enabled: true,
    actions: ['write', 'polish', 'summarize', 'expand', 'shorten', 'translate'],
    async onChatGenerate(payload) {
      return await requestEditorAi('chat', payload)
    },
    async onContextAction(payload) {
      return await requestEditorAi('context_action', payload)
    },
    async onPolish(payload) {
      return await requestEditorAi('polish', payload)
    },
    async onGenerateTemplate(payload) {
      return await requestEditorAi('generate_template', payload)
    },
  },
  templateStore: {
    async list(params = {}) {
      return await listEditorTemplates({
        type: params.type,
        status: params.status || 'published',
      })
    },
    async save(payload) {
      return await saveEditorTemplate(payload)
    },
    async versions(templateId) {
      return await listEditorTemplateVersions(templateId)
    },
    async rollback(payload) {
      return await rollbackEditorTemplate(payload)
    },
    async listStyleTemplates() {
      return await listEditorStyleTemplates()
    },
    async applyStyleTemplate(payload) {
      return await requestEditorAi('apply_style_template', payload)
    },
  },
})

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8100'

const backendBaseUrl = () => {
  return (
    import.meta.env.VITE_BACKEND_BASE_URL ||
    DEFAULT_BACKEND_BASE_URL
  ).replace(/\/$/, '')
}

const requestJson = async (path, options = {}) => {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    headers,
    ...options,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `请求失败：${response.status}`)
  }
  return data
}

export const transcribeEditorVoice = async (audioBlob) => {
  const form = new FormData()
  form.append('audio', audioBlob, 'voice.wav')
  const response = await fetch(`${backendBaseUrl()}/api/chat/voice/transcribe`, {
    method: 'POST',
    body: form,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `语音识别失败：${response.status}`)
  }
  const text = typeof data?.text === 'string' ? data.text.trim() : ''
  if (!text) throw new Error('语音识别未返回文本')
  return text
}

const normalizeTemplate = (item = {}) => ({
  ...item,
  id: item.id !== undefined ? String(item.id) : item.value,
  value: item.value || (item.id !== undefined ? String(item.id) : undefined),
  type: item.type || item.template_kind || 'text',
  status: item.status || 'published',
  content: item.content || item.html || item.text || '',
  variables: item.variables || item.variables_json || [],
  sourceConfig: item.sourceConfig || item.source_config || item.source_config_json || {},
  tags: item.tags || item.tags_json || [],
})

const normalizeTemplateList = (result) => {
  const items = Array.isArray(result) ? result : result?.items || []
  return items.map(normalizeTemplate)
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
  if (params.q) search.set('q', params.q)
  const qs = search.toString()
  const path = params.status === ''
    ? `/api/templates${qs ? `?${qs}` : '?page_size=200'}${qs ? '&page_size=200' : ''}`
    : `/api/editor/templates${qs ? `?${qs}` : ''}`
  const result = await requestJson(path)
  return normalizeTemplateList(result)
}

export const saveEditorTemplate = async (payload = {}) => {
  let result = await requestJson('/api/editor/templates', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      remark: payload.remark,
      content: payload.content,
      type: payload.type || 'text',
      category: payload.category,
      tags: payload.tags || [],
      variables: payload.variables || [],
      source_config: payload.sourceConfig || payload.source_config || {},
      context: payload.context || {},
    }),
  })
  if (payload.status && result?.id) {
    result = await updateEditorTemplate({
      ...payload,
      id: result.id,
    }).catch(() => result)
  }
  return normalizeTemplate(result)
}

export const updateEditorTemplate = async (payload = {}) => {
  const result = await requestJson(`/api/templates/${payload.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      content: payload.content,
      status: payload.status,
      type: payload.type,
      category: payload.category,
      tags: payload.tags || [],
      variables: payload.variables || [],
      source_config: payload.sourceConfig || payload.source_config || {},
    }),
  })
  return normalizeTemplate(result)
}

export const deleteEditorTemplate = async (templateId) => {
  return await requestJson(`/api/templates/${templateId}`, {
    method: 'DELETE',
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
  const result = await requestJson('/api/editor/style-templates')
  return normalizeTemplateList(result)
}

export const createEditorDocument = async (payload = {}) => {
  return await requestJson('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      template_id: payload.templateId ? Number(payload.templateId) : null,
    }),
  })
}

export const updateEditorDocument = async (payload = {}) => {
  return await requestJson(`/api/documents/${payload.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: payload.title,
      content: payload.content,
    }),
  })
}

export const recommendEditorTemplates = async (payload = {}) => {
  try {
    const result = await requestJson('/api/editor/templates/recommend', {
      method: 'POST',
      body: JSON.stringify({
        prompt: payload.prompt || '',
        context: payload.context || {},
        types: payload.types || ['document', 'text', 'chart', 'data'],
        limit: payload.limit || 6,
      }),
    })
    return normalizeTemplateList(result)
  } catch (error) {
    const templates = await listEditorTemplates({ status: 'published' })
    const prompt = `${payload.prompt || ''} ${payload.context?.currentBlock?.text || ''}`.toLowerCase()
    return templates
      .map((item) => {
        const haystack = `${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
        const score = prompt && haystack
          ? prompt.split(/\s+/).filter(Boolean).reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0)
          : 0
        return { ...item, score, reason: score ? '本地关键词匹配' : '默认推荐' }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, payload.limit || 6)
  }
}

export const renderEditorTemplate = async (payload = {}) => {
  try {
    return await requestJson('/api/editor/templates/render', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return {
      content: payload.template?.content || payload.content || '',
      html: payload.template?.content || payload.content || '',
      text: '',
    }
  }
}

export const generateEditorDataTemplate = async (payload = {}) => {
  return await requestJson('/api/editor/templates/from-data', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
      const result = await listEditorTemplates({
        type: params.type,
        status: params.status === undefined ? 'published' : params.status,
        q: params.q,
      })
      if (params.type === 'document' && result.length === 0) {
        const fallback = await listEditorTemplates({
          status: params.status === undefined ? 'published' : params.status,
          q: params.q,
        })
        return fallback
          .filter((item) => ['document', 'system', 'user'].includes(item.type))
          .map((item) => ({ ...item, type: 'document' }))
      }
      return result
    },
    async save(payload) {
      return await saveEditorTemplate(payload)
    },
    async update(payload) {
      return await updateEditorTemplate(payload)
    },
    async delete(templateId) {
      return await deleteEditorTemplate(templateId)
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
    async recommend(payload) {
      return await recommendEditorTemplates(payload)
    },
    async render(payload) {
      return await renderEditorTemplate(payload)
    },
    async fromData(payload) {
      return await generateEditorDataTemplate(payload)
    },
    async createDocument(payload) {
      return await createEditorDocument(payload)
    },
    async updateDocument(payload) {
      return await updateEditorDocument(payload)
    },
  },
})

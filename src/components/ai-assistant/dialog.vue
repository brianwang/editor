<template>
  <modal
    v-model:visible="visible"
    :header="t('aiAssistant.title')"
    width="860px"
    :footer="false"
    destroy-on-close
  >
    <div class="umo-ai-assistant">
      <t-radio-group v-model="activeTab" variant="default-filled">
        <t-radio-button value="generate">
          {{ t('aiAssistant.generate') }}
        </t-radio-button>
        <t-radio-button value="polish">
          {{ t('aiAssistant.polish') }}
        </t-radio-button>
        <t-radio-button value="templates">
          {{ t('aiAssistant.templates') }}
        </t-radio-button>
      </t-radio-group>

      <div v-if="activeTab === 'generate'" class="umo-ai-assistant-panel">
        <div class="umo-ai-form-row">
          <span>{{ t('aiAssistant.template') }}</span>
          <t-select
            v-model="selectedTemplateId"
            :popup-props="{ attach: container }"
            :loading="loadingTemplates"
            :placeholder="t('aiAssistant.selectTemplate')"
            clearable
          >
            <t-option
              v-for="item in templates"
              :key="item.id || item.value"
              :label="item.title"
              :value="item.id || item.value"
            />
          </t-select>
        </div>
        <div class="umo-ai-form-row">
          <span>{{ t('aiAssistant.prompt') }}</span>
          <t-textarea
            v-model="prompt"
            :placeholder="t('aiAssistant.promptPlaceholder')"
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </div>
        <div v-if="placeholderText" class="umo-ai-placeholder">
          {{ placeholderText }}
        </div>
        <div class="umo-ai-actions">
          <t-button
            theme="primary"
            :loading="loading"
            :disabled="!selectedTemplate"
            @click="generateTemplate"
          >
            {{ t('aiAssistant.generateContent') }}
          </t-button>
          <t-button :disabled="!previewContent" @click="applyPreview">
            {{ t('aiAssistant.apply') }}
          </t-button>
        </div>
      </div>

      <div v-if="activeTab === 'polish'" class="umo-ai-assistant-panel">
        <div class="umo-ai-form-row">
          <span>{{ t('aiAssistant.action') }}</span>
          <t-select
            v-model="polishAction"
            :popup-props="{ attach: container }"
          >
            <t-option
              v-for="action in options.ai?.actions"
              :key="action"
              :label="t(`tools.aiActions.${action}`)"
              :value="action"
            />
          </t-select>
        </div>
        <div class="umo-ai-form-row">
          <span>{{ t('aiAssistant.prompt') }}</span>
          <t-textarea
            v-model="polishPrompt"
            :placeholder="t('aiAssistant.polishPlaceholder')"
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </div>
        <div class="umo-ai-context">
          {{ contextSummary }}
        </div>
        <div class="umo-ai-actions">
          <t-button theme="primary" :loading="loading" @click="polish">
            {{ t('aiAssistant.polishContent') }}
          </t-button>
          <t-button :disabled="!previewContent" @click="applyPreview">
            {{ t('aiAssistant.apply') }}
          </t-button>
        </div>
      </div>

      <div v-if="activeTab === 'templates'" class="umo-ai-assistant-panel">
        <div class="umo-ai-form-grid">
          <div class="umo-ai-form-row">
            <span>{{ t('aiAssistant.templateName') }}</span>
            <t-input
              v-model="templateForm.title"
              :placeholder="t('aiAssistant.templateNamePlaceholder')"
            />
          </div>
          <div class="umo-ai-form-row">
            <span>{{ t('aiAssistant.versionRemark') }}</span>
            <t-input
              v-model="templateForm.remark"
              :placeholder="t('aiAssistant.versionRemarkPlaceholder')"
            />
          </div>
        </div>
        <div class="umo-ai-form-row">
          <span>{{ t('aiAssistant.description') }}</span>
          <t-textarea
            v-model="templateForm.description"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </div>
        <div class="umo-ai-actions">
          <t-button
            theme="primary"
            :loading="savingTemplate"
            :disabled="!templateForm.title"
            @click="saveCurrentTemplate"
          >
            {{ t('aiAssistant.saveTemplate') }}
          </t-button>
          <t-button :loading="loadingTemplates" @click="loadTemplates">
            {{ t('aiAssistant.refresh') }}
          </t-button>
        </div>

        <div class="umo-ai-version-layout">
          <div class="umo-ai-version-list">
            <div
              v-for="item in templates"
              :key="item.id || item.value"
              class="umo-ai-version-item"
              :class="{ active: (item.id || item.value) === manageTemplateId }"
              @click="selectManageTemplate(item)"
            >
              <strong>{{ item.title }}</strong>
              <span>v{{ item.version || '-' }}</span>
            </div>
          </div>
          <div class="umo-ai-version-list">
            <div
              v-for="version in versions"
              :key="version.id || version.version"
              class="umo-ai-version-item"
              :class="{
                active: (version.id || version.version) === selectedVersionId,
              }"
              @click="selectVersion(version)"
            >
              <strong>v{{ version.version }}</strong>
              <span>{{ version.createdAt || version.remark || '' }}</span>
            </div>
            <div v-if="manageTemplateId && versions.length === 0" class="umo-ai-empty">
              {{ t('aiAssistant.noVersions') }}
            </div>
          </div>
          <div class="umo-ai-actions is-vertical">
            <t-button
              theme="primary"
              :loading="rollingBack"
              :disabled="!selectedVersion"
              @click="rollbackSelectedVersion"
            >
              {{ t('aiAssistant.rollback') }}
            </t-button>
          </div>
        </div>
      </div>

      <div class="umo-ai-preview">
        <div class="umo-ai-preview-title">{{ t('aiAssistant.preview') }}</div>
        <div v-if="previewContent" class="umo-ai-preview-content" v-html="previewContent"></div>
        <div v-else class="umo-ai-empty">{{ t('aiAssistant.previewEmpty') }}</div>
      </div>
    </div>
  </modal>
</template>

<script setup>
import {
  applyGeneratedContent,
  extractTemplatePlaceholders,
  generateTemplateContent,
  getAiContext,
  listTemplateVersions,
  listTemplates,
  polishContent,
  rollbackTemplate,
  saveTemplate,
  replaceDocumentContent,
} from '@/composables/ai-assistant'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  initialTab: {
    type: String,
    default: 'generate',
  },
})
const emits = defineEmits(['update:visible'])

const editor = inject('editor')
const options = inject('options')
const container = inject('container')

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

let activeTab = $ref(props.initialTab)
let templates = $ref([])
let versions = $ref([])
let selectedTemplateId = $ref(null)
let manageTemplateId = $ref(null)
let selectedVersionId = $ref(null)
let prompt = $ref('')
let polishAction = $ref(options.value.ai?.actions?.[0] || 'polish')
let polishPrompt = $ref('')
let previewContent = $ref('')
let applyMode = $ref('insert')
let loading = $ref(false)
let loadingTemplates = $ref(false)
let savingTemplate = $ref(false)
let rollingBack = $ref(false)

const templateForm = $ref({
  title: '',
  description: '',
  remark: '',
})

const selectedTemplate = $computed(() => {
  return templates.find((item) => (item.id || item.value) === selectedTemplateId)
})

const selectedVersion = $computed(() => {
  return versions.find((item) => (item.id || item.version) === selectedVersionId)
})

const contextSummary = $computed(() => {
  const context = getAiContext(editor, options)
  const scope = context.selection?.empty
    ? t('aiAssistant.scopeDocument')
    : t('aiAssistant.scopeSelection')
  return t('aiAssistant.contextSummary', {
    scope,
    title: context.title || t('document.untitled'),
    headings: context.toc?.length || 0,
  })
})

const placeholderText = $computed(() => {
  const placeholders = extractTemplatePlaceholders(selectedTemplate?.content || '')
  const parts = []
  if (placeholders.fields.length) {
    parts.push(`${t('aiAssistant.fields')}: ${placeholders.fields.join(', ')}`)
  }
  if (placeholders.ai.length) {
    parts.push(`${t('aiAssistant.aiInstructions')}: ${placeholders.ai.join(', ')}`)
  }
  return parts.join(' | ')
})

watch(
  () => props.visible,
  (value) => {
    if (value) {
      activeTab = props.initialTab
      loadTemplates()
      previewContent = ''
    }
  },
)

const normalizeContent = (result) => {
  return result?.content || result?.html || result?.text || ''
}

const loadTemplates = async () => {
  loadingTemplates = true
  try {
    const result = await listTemplates(options, { source: 'ai-assistant' })
    templates = Array.isArray(result) ? result : []
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.loadFailed'))
  } finally {
    loadingTemplates = false
  }
}

const generateTemplate = async () => {
  if (!selectedTemplate) return
  loading = true
  try {
    const context = getAiContext(editor, options)
    const result = await generateTemplateContent(options, {
      template: selectedTemplate,
      prompt,
      placeholders: extractTemplatePlaceholders(selectedTemplate.content || ''),
      context,
    })
    previewContent = normalizeContent(result)
    applyMode = context.selection?.empty ? 'insert' : 'replace'
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.generateFailed'))
  } finally {
    loading = false
  }
}

const polish = async () => {
  loading = true
  try {
    const context = getAiContext(editor, options)
    const result = await polishContent(options, {
      action: polishAction,
      prompt: polishPrompt,
      context,
    })
    previewContent = normalizeContent(result)
    applyMode = context.selection?.empty ? 'document' : 'replace'
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.polishFailed'))
  } finally {
    loading = false
  }
}

const applyPreview = () => {
  if (!previewContent) return
  const context = getAiContext(editor, options)
  if (applyMode === 'document') {
    replaceDocumentContent(editor, previewContent)
  } else if (applyMode === 'replace' && !context.selection.empty) {
    applyGeneratedContent(editor, previewContent, context.selection)
  } else {
    applyGeneratedContent(editor, previewContent)
  }
  previewContent = ''
  emits('update:visible', false)
}

const saveCurrentTemplate = async () => {
  const context = getAiContext(editor, options)
  const content = context.selection?.html || context.currentBlock?.html
  if (!content) {
    useMessage('warning', t('aiAssistant.emptyContent'))
    return
  }
  savingTemplate = true
  try {
    await saveTemplate(options, {
      title: templateForm.title,
      description: templateForm.description,
      remark: templateForm.remark,
      content,
      context,
    })
    useMessage('success', t('aiAssistant.saveSuccess'))
    templateForm.title = ''
    templateForm.description = ''
    templateForm.remark = ''
    await loadTemplates()
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.saveFailed'))
  } finally {
    savingTemplate = false
  }
}

const selectManageTemplate = async (template) => {
  manageTemplateId = template.id || template.value
  selectedVersionId = null
  previewContent = template.content || ''
  try {
    const result = await listTemplateVersions(options, manageTemplateId)
    versions = Array.isArray(result) ? result : []
  } catch (error) {
    versions = []
    useMessage('error', error?.message || t('aiAssistant.loadVersionsFailed'))
  }
}

const selectVersion = (version) => {
  selectedVersionId = version.id || version.version
  previewContent = version.content || ''
}

const rollbackSelectedVersion = async () => {
  if (!selectedVersion) return
  rollingBack = true
  try {
    await rollbackTemplate(options, {
      templateId: manageTemplateId,
      versionId: selectedVersion.id,
      version: selectedVersion.version,
    })
    useMessage('success', t('aiAssistant.rollbackSuccess'))
    await loadTemplates()
    const template = templates.find((item) => (item.id || item.value) === manageTemplateId)
    if (template) {
      await selectManageTemplate(template)
    }
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.rollbackFailed'))
  } finally {
    rollingBack = false
  }
}
</script>

<style lang="less">
.umo-ai-assistant {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 520px;
  .umo-ai-assistant-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .umo-ai-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .umo-ai-form-row {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    > span {
      color: var(--umo-text-color-light);
      font-size: 13px;
    }
  }
  .umo-ai-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    &.is-vertical {
      flex-direction: column;
      align-items: stretch;
    }
  }
  .umo-ai-context,
  .umo-ai-placeholder,
  .umo-ai-empty {
    color: var(--umo-text-color-light);
    font-size: 13px;
  }
  .umo-ai-version-layout {
    display: grid;
    grid-template-columns: 1fr 1fr 120px;
    gap: 12px;
    min-height: 140px;
  }
  .umo-ai-version-list {
    border: solid 1px var(--umo-border-color);
    border-radius: 4px;
    overflow: auto;
    max-height: 180px;
  }
  .umo-ai-version-item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    cursor: pointer;
    border-bottom: solid 1px var(--umo-border-color-light);
    span {
      color: var(--umo-text-color-light);
      font-size: 12px;
    }
    &.active,
    &:hover {
      background-color: var(--umo-button-hover-background);
    }
  }
  .umo-ai-preview {
    border-top: solid 1px var(--umo-border-color);
    padding-top: 12px;
  }
  .umo-ai-preview-title {
    font-size: 13px;
    color: var(--umo-text-color-light);
    margin-bottom: 8px;
  }
  .umo-ai-preview-content {
    border: solid 1px var(--umo-border-color);
    border-radius: 4px;
    min-height: 120px;
    max-height: 260px;
    overflow: auto;
    padding: 10px;
    background-color: var(--umo-color-white);
  }
}
</style>

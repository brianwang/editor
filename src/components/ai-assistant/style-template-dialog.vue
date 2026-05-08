<template>
  <modal
    v-model:visible="visible"
    :header="t('aiAssistant.styleTemplates')"
    width="780px"
    :footer="false"
    destroy-on-close
  >
    <div class="umo-style-template-dialog">
      <div class="umo-style-template-list">
        <div
          v-for="item in templates"
          :key="item.id || item.value"
          class="umo-style-template-item"
          :class="{ active: (item.id || item.value) === selectedTemplateId }"
          @click="selectTemplate(item)"
        >
          <strong>{{ item.title }}</strong>
          <span>{{ item.description || `v${item.version || '-'}` }}</span>
        </div>
        <div v-if="!loading && templates.length === 0" class="umo-style-template-empty">
          {{ t('aiAssistant.noStyleTemplates') }}
        </div>
      </div>
      <div class="umo-style-template-main">
        <div class="umo-style-template-actions">
          <t-button
            theme="primary"
            :loading="applying"
            :disabled="!selectedTemplate"
            @click="applyTemplate"
          >
            {{ t('aiAssistant.applyStyleTemplate') }}
          </t-button>
          <t-button :loading="loading" @click="loadTemplates">
            {{ t('aiAssistant.refresh') }}
          </t-button>
          <t-button :disabled="!previewContent" @click="replaceContent">
            {{ t('aiAssistant.apply') }}
          </t-button>
        </div>
        <div class="umo-style-template-preview">
          <div v-if="previewContent" v-html="previewContent"></div>
          <div v-else class="umo-style-template-empty">
            {{ t('aiAssistant.previewEmpty') }}
          </div>
        </div>
      </div>
    </div>
  </modal>
</template>

<script setup>
import {
  applyStyleTemplate,
  getAiContext,
  listStyleTemplates,
  replaceDocumentContent,
} from '@/composables/ai-assistant'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})
const emits = defineEmits(['update:visible'])

const editor = inject('editor')
const options = inject('options')

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

let templates = $ref([])
let selectedTemplateId = $ref(null)
let previewContent = $ref('')
let loading = $ref(false)
let applying = $ref(false)

const selectedTemplate = $computed(() => {
  return templates.find((item) => (item.id || item.value) === selectedTemplateId)
})

watch(
  () => props.visible,
  (value) => {
    if (value) {
      loadTemplates()
      previewContent = ''
    }
  },
)

const loadTemplates = async () => {
  loading = true
  try {
    const result = await listStyleTemplates(options)
    templates = Array.isArray(result) ? result : result?.items || []
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.loadFailed'))
  } finally {
    loading = false
  }
}

const selectTemplate = (template) => {
  selectedTemplateId = template.id || template.value
  previewContent = template.content || ''
}

const normalizeContent = (result) => result?.content || result?.html || result?.text || ''

const applyTemplate = async () => {
  if (!selectedTemplate) return
  applying = true
  try {
    const context = getAiContext(editor, options)
    const result = await applyStyleTemplate(options, {
      template: selectedTemplate,
      templateId: selectedTemplate.id || selectedTemplate.value,
      html: context.currentHtml,
      title: context.title,
      toc: context.toc,
      context,
    })
    previewContent = normalizeContent(result)
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.applyStyleFailed'))
  } finally {
    applying = false
  }
}

const replaceContent = () => {
  if (!previewContent) return
  replaceDocumentContent(editor, previewContent)
  emits('update:visible', false)
}
</script>

<style lang="less">
.umo-style-template-dialog {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  min-height: 420px;
}
.umo-style-template-list,
.umo-style-template-preview {
  border: solid 1px var(--umo-border-color);
  border-radius: 4px;
  overflow: auto;
}
.umo-style-template-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
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
.umo-style-template-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.umo-style-template-actions {
  display: flex;
  gap: 8px;
}
.umo-style-template-preview {
  flex: 1;
  padding: 12px;
}
.umo-style-template-empty {
  padding: 10px;
  color: var(--umo-text-color-light);
  font-size: 13px;
}
</style>

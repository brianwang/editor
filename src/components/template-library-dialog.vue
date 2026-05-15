<template>
  <modal
    v-model:visible="visible"
    :header="t('templateLibrary.title')"
    width="980px"
    :footer="false"
    destroy-on-close
  >
    <div class="umo-template-library-dialog">
      <div class="umo-template-library-sidebar">
        <t-radio-group v-model="activeType" variant="default-filled" @change="loadTemplates">
          <t-radio-button
            v-for="item in templateTypes"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </t-radio-button>
        </t-radio-group>
        <t-input
          v-model="keyword"
          :placeholder="t('templateLibrary.search')"
          clearable
          @enter="loadTemplates"
        />
        <div class="umo-template-library-list">
          <div
            v-for="item in templates"
            :key="item.id || item.value"
            class="umo-template-library-item"
            :class="{ active: selectedTemplateId === (item.id || item.value) }"
            @click="selectTemplate(item)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.description || item.type }}</span>
          </div>
          <div v-if="!loading && templates.length === 0" class="umo-template-library-empty">
            {{ t('templateLibrary.empty') }}
          </div>
        </div>
      </div>
      <div class="umo-template-library-main">
        <div class="umo-template-library-actions">
          <t-button theme="primary" :loading="saving" :disabled="!form.title" @click="saveCurrent">
            {{ form.id ? t('templateLibrary.update') : t('templateLibrary.create') }}
          </t-button>
          <t-button :loading="loading" @click="loadTemplates">
            {{ t('aiAssistant.refresh') }}
          </t-button>
          <t-button :disabled="!selectedTemplate" @click="applySelected">
            {{ t('templateLibrary.apply') }}
          </t-button>
          <t-button theme="danger" variant="outline" :disabled="!form.id" @click="deleteCurrent">
            {{ t('templateLibrary.delete') }}
          </t-button>
          <t-button @click="resetForm">
            {{ t('templateLibrary.new') }}
          </t-button>
        </div>
        <div class="umo-template-library-form">
          <t-input v-model="form.title" :placeholder="t('templateLibrary.name')" />
          <t-input v-model="form.description" :placeholder="t('templateLibrary.description')" />
          <t-select v-model="form.status" :popup-props="{ attach: container }">
            <t-option value="published" :label="t('templateLibrary.published')" />
            <t-option value="draft" :label="t('templateLibrary.draft')" />
          </t-select>
        </div>
        <t-textarea
          v-model="form.content"
          class="umo-template-library-editor"
          :placeholder="contentPlaceholder"
          :autosize="{ minRows: 10, maxRows: 16 }"
        />
        <div class="umo-template-library-preview">
          <div v-if="form.content && form.type !== 'chart'" v-html="form.content"></div>
          <pre v-else-if="form.content">{{ form.content }}</pre>
          <div v-else class="umo-template-library-empty">{{ t('aiAssistant.previewEmpty') }}</div>
        </div>
      </div>
    </div>
  </modal>
</template>

<script setup>
import {
  applyTemplateToEditor,
  deleteTemplateRecord,
  listTemplates,
  saveTemplateRecord,
  updateTemplateRecord,
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
const container = inject('container')

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

const templateTypes = $computed(() => [
  { value: 'document', label: t('templateLibrary.types.document') },
  { value: 'text', label: t('templateLibrary.types.text') },
  { value: 'chart', label: t('templateLibrary.types.chart') },
  { value: 'data', label: t('templateLibrary.types.data') },
  { value: 'style', label: t('templateLibrary.types.style') },
])

let activeType = $ref('document')
let keyword = $ref('')
let templates = $ref([])
let selectedTemplateId = $ref(null)
let loading = $ref(false)
let saving = $ref(false)

const blankForm = () => ({
  id: '',
  title: '',
  description: '',
  status: 'published',
  type: activeType,
  content: '',
})

let form = $ref(blankForm())

const selectedTemplate = $computed(() => {
  return templates.find((item) => (item.id || item.value) === selectedTemplateId)
})

const contentPlaceholder = $computed(() => {
  if (form.type === 'chart') {
    return t('templateLibrary.chartPlaceholder')
  }
  return t('templateLibrary.contentPlaceholder')
})

watch(
  () => props.visible,
  (value) => {
    if (!value) return
    loadTemplates()
  },
)

watch(
  () => activeType,
  () => {
    resetForm()
  },
)

const loadTemplates = async () => {
  loading = true
  try {
    const result = await listTemplates(options, {
      type: activeType,
      status: '',
      q: keyword,
    })
    templates = Array.isArray(result) ? result : result?.items || []
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.loadFailed'))
  } finally {
    loading = false
  }
}

const selectTemplate = (template) => {
  selectedTemplateId = template.id || template.value
  form = {
    id: template.id || template.value || '',
    title: template.title || '',
    description: template.description || '',
    status: template.status || 'published',
    type: template.type || activeType,
    content: template.content || '',
  }
}

const resetForm = () => {
  selectedTemplateId = null
  form = blankForm()
}

const saveCurrent = async () => {
  saving = true
  try {
    const payload = {
      ...form,
      type: form.type || activeType,
    }
    const saved = form.id
      ? await updateTemplateRecord(options, payload)
      : await saveTemplateRecord(options, payload)
    useMessage('success', t('templateLibrary.saveSuccess'))
    await loadTemplates()
    const id = saved?.id || saved?.value || form.id
    const item = templates.find((tpl) => (tpl.id || tpl.value) === id)
    if (item) selectTemplate(item)
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.saveFailed'))
  } finally {
    saving = false
  }
}

const deleteCurrent = async () => {
  if (!form.id) return
  try {
    await deleteTemplateRecord(options, form.id)
    useMessage('success', t('templateLibrary.deleteSuccess'))
    resetForm()
    await loadTemplates()
  } catch (error) {
    useMessage('error', error?.message || t('templateLibrary.deleteFailed'))
  }
}

const applySelected = async () => {
  if (!selectedTemplate) return
  try {
    await applyTemplateToEditor(editor, options, selectedTemplate)
    emits('update:visible', false)
  } catch (error) {
    useMessage('error', error?.message || t('templateLibrary.applyFailed'))
  }
}
</script>

<style lang="less">
.umo-template-library-dialog {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  min-height: 560px;
}
.umo-template-library-sidebar,
.umo-template-library-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.umo-template-library-sidebar {
  min-width: 0;
}
.umo-template-library-list,
.umo-template-library-preview {
  border: solid 1px var(--umo-border-color);
  border-radius: 4px;
  overflow: auto;
}
.umo-template-library-list {
  flex: 1;
}
.umo-template-library-item {
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
.umo-template-library-actions,
.umo-template-library-form {
  display: flex;
  gap: 8px;
}
.umo-template-library-form {
  :deep(.umo-input),
  :deep(.umo-select) {
    flex: 1;
  }
}
.umo-template-library-editor {
  :deep(.umo-textarea__inner) {
    font-family: var(--umo-font-family-mono);
  }
}
.umo-template-library-preview {
  flex: 1;
  padding: 12px;
  background-color: var(--umo-color-white);
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }
}
.umo-template-library-empty {
  padding: 10px;
  color: var(--umo-text-color-light);
  font-size: 13px;
}
</style>

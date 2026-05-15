<template>
  <modal
    v-model:visible="visible"
    :header="t('newDocument.title')"
    width="820px"
    :confirm-btn="{
      content: t('newDocument.create'),
      disabled: !documentTitle,
      loading: creating,
    }"
    :cancel-btn="t('documentTemplate.cancel')"
    destroy-on-close
    @confirm="create"
  >
    <div class="umo-new-document-dialog">
      <div class="umo-new-document-form">
        <t-input v-model="documentTitle" :placeholder="t('newDocument.name')" />
        <t-input
          v-model="keyword"
          :placeholder="t('newDocument.search')"
          clearable
        />
      </div>
      <div class="umo-new-document-categories">
        <t-radio-group v-model="activeCategory" variant="default-filled">
          <t-radio-button
            v-for="item in categories"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </t-radio-button>
        </t-radio-group>
      </div>
      <div class="umo-new-document-body">
        <div class="umo-new-document-list">
          <div
            v-for="item in filteredTemplates"
            :key="getTemplateKey(item)"
            class="umo-new-document-item"
            :class="{ active: selectedTemplateId === getTemplateKey(item) }"
            @click="selectTemplate(item)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.description || getTemplateCategory(item) }}</span>
          </div>
          <div v-if="!loading && filteredTemplates.length === 0" class="umo-new-document-empty">
            {{ t('documentTemplate.empty') }}
          </div>
        </div>
        <div class="umo-new-document-preview">
          <div v-if="selectedTemplate?.content" v-html="selectedTemplate.content"></div>
          <div v-else class="umo-new-document-empty">
            {{ t('newDocument.blankPreview') }}
          </div>
        </div>
      </div>
    </div>
  </modal>
</template>

<script setup>
import {
  createDocument,
  listTemplates,
  replaceDocumentContent,
  updateDocument,
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

const BLANK_TEMPLATE_ID = '__blank__'

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

let documentTitle = $ref('')
let templates = $ref([])
let selectedTemplateId = $ref(null)
let activeCategory = $ref('all')
let keyword = $ref('')
let loading = $ref(false)
let creating = $ref(false)

const blankTemplate = $computed(() => ({
  id: BLANK_TEMPLATE_ID,
  title: t('newDocument.blank'),
  description: t('newDocument.blankDescription'),
  category: t('newDocument.defaultCategory'),
  content: '<p></p>',
  builtin: true,
}))

const allTemplates = $computed(() => [blankTemplate, ...templates])

const selectedTemplate = $computed(() => {
  return allTemplates.find((item) => getTemplateKey(item) === selectedTemplateId)
})

const categories = $computed(() => {
  const items = new Map([['all', t('newDocument.allCategories')]])
  allTemplates.forEach((item) => {
    const category = getTemplateCategory(item)
    items.set(category, category)
  })
  return Array.from(items, ([value, label]) => ({ value, label }))
})

const filteredTemplates = $computed(() => {
  const q = keyword.trim().toLowerCase()
  return allTemplates.filter((item) => {
    const category = getTemplateCategory(item)
    const matchCategory = activeCategory === 'all' || category === activeCategory
    const text = [item.title, item.description, category].filter(Boolean).join(' ').toLowerCase()
    return matchCategory && (!q || text.includes(q))
  })
})

watch(
  () => props.visible,
  (value) => {
    if (!value) return
    documentTitle = options.value.document?.title || t('document.untitled')
    activeCategory = 'all'
    keyword = ''
    selectedTemplateId = BLANK_TEMPLATE_ID
    loadTemplates()
  },
)

const loadTemplates = async () => {
  loading = true
  try {
    const result = await listTemplates(options, {
      type: 'document',
      status: 'published',
      source: 'new-document',
    })
    templates = Array.isArray(result) ? result : result?.items || []
    selectedTemplateId = selectedTemplateId || BLANK_TEMPLATE_ID
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.loadFailed'))
  } finally {
    loading = false
  }
}

const selectTemplate = (template) => {
  selectedTemplateId = getTemplateKey(template)
}

const getTemplateKey = (template) => {
  return template?.id || template?.value || template?.title
}

const getTemplateCategory = (template) => {
  return (
    template?.category ||
    template?.categoryName ||
    template?.category_name ||
    template?.type ||
    t('newDocument.defaultCategory')
  )
}

const create = async () => {
  if (!documentTitle || creating) return
  creating = true
  try {
    const doc = await createDocument(options, {
      title: documentTitle,
      templateId: selectedTemplate?.builtin ? undefined : getTemplateKey(selectedTemplate),
    })
    const content = selectedTemplate?.content || '<p></p>'
    replaceDocumentContent(editor, content)
    options.value.document.title = documentTitle
    options.value.document.id = doc?.id || null
    if (doc?.id && content) {
      await updateDocument(options, {
        id: doc.id,
        title: documentTitle,
        content,
      })
    }
    useMessage('success', t('newDocument.success'))
    emits('update:visible', false)
  } catch (error) {
    useMessage('error', error?.message || t('newDocument.failed'))
  } finally {
    creating = false
  }
}
</script>

<style lang="less">
.umo-new-document-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.umo-new-document-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 10px;
}
.umo-new-document-categories {
  overflow-x: auto;
  white-space: nowrap;
}
.umo-new-document-body {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 12px;
  min-height: 420px;
}
.umo-new-document-list,
.umo-new-document-preview {
  border: solid 1px var(--umo-border-color);
  border-radius: 4px;
  overflow: auto;
}
.umo-new-document-item {
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
.umo-new-document-preview {
  padding: 12px;
}
.umo-new-document-empty {
  padding: 10px;
  color: var(--umo-text-color-light);
  font-size: 13px;
}
@media (max-width: 768px) {
  .umo-new-document-form,
  .umo-new-document-body {
    grid-template-columns: 1fr;
  }
  .umo-new-document-body {
    min-height: 0;
  }
  .umo-new-document-list {
    max-height: 220px;
  }
}
</style>

<template>
  <modal
    v-model:visible="visible"
    :header="t('documentTemplate.title')"
    width="760px"
    :confirm-btn="{
      content: t('documentTemplate.confirm'),
      disabled: !selectedTemplate,
    }"
    :cancel-btn="t('documentTemplate.cancel')"
    destroy-on-close
    @confirm="confirm"
  >
    <div class="umo-document-template-dialog">
      <div class="umo-document-template-list">
        <div
          v-for="item in templates"
          :key="item.id || item.value"
          class="umo-document-template-item"
          :class="{ active: (item.id || item.value) === selectedTemplateId }"
          @click="selectTemplate(item)"
        >
          <strong>{{ item.title }}</strong>
          <span>{{ item.description || `v${item.version || '-'}` }}</span>
        </div>
      </div>
      <div class="umo-document-template-preview">
        <div
          v-if="selectedTemplate?.content"
          class="umo-document-template-preview-content"
          v-html="selectedTemplate.content"
        ></div>
        <div v-else class="umo-document-template-empty">
          {{ t('documentTemplate.empty') }}
        </div>
      </div>
    </div>
  </modal>
</template>

<script setup>
import { listTemplates } from '@/composables/ai-assistant'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})
const emits = defineEmits(['update:visible', 'select'])

const options = inject('options')

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

let templates = $ref([])
let selectedTemplateId = $ref(null)

const selectedTemplate = $computed(() => {
  return templates.find((item) => (item.id || item.value) === selectedTemplateId)
})

watch(
  () => props.visible,
  async (value) => {
    if (!value) return
    const result = await listTemplates(options, { source: 'document-template' })
    templates = Array.isArray(result) ? result : []
    if (!selectedTemplateId && templates.length) {
      selectedTemplateId = templates[0].id || templates[0].value
    }
  },
)

const selectTemplate = (template) => {
  selectedTemplateId = template.id || template.value
}

const confirm = () => {
  if (!selectedTemplate) return
  emits('select', selectedTemplate)
}
</script>

<style lang="less">
.umo-document-template-dialog {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
}
.umo-document-template-list,
.umo-document-template-preview {
  border: solid 1px var(--umo-border-color);
  border-radius: 4px;
  overflow: auto;
}
.umo-document-template-item {
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
.umo-document-template-preview {
  padding: 12px;
}
.umo-document-template-empty {
  color: var(--umo-text-color-light);
}
</style>

<template>
  <div
    v-if="visible"
    class="umo-ai-chat-box"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @mousedown.stop
  >
    <div class="umo-ai-chat-box-header">
      <span>{{ title }}</span>
      <t-button size="small" variant="text" shape="square" @click="close">
        <icon name="close" />
      </t-button>
    </div>
    <t-textarea
      v-model="prompt"
      :placeholder="t('aiAssistant.chatPlaceholder')"
      :autosize="{ minRows: 3, maxRows: 5 }"
      autofocus
      @keydown.ctrl.enter.prevent="generate"
      @keydown.meta.enter.prevent="generate"
    />
    <div class="umo-ai-chat-box-actions">
      <t-button
        theme="primary"
        size="small"
        :loading="loading"
        :disabled="!canGenerate"
        @click="generate"
      >
        {{ t('aiAssistant.generateContent') }}
      </t-button>
      <t-button
        size="small"
        :disabled="!previewContent"
        @click="applyPreview"
      >
        {{ t('aiAssistant.apply') }}
      </t-button>
    </div>
    <div v-if="prompt.trim()" class="umo-ai-chat-box-recommend">
      <div class="umo-ai-chat-box-recommend-title">
        {{ t('templateLibrary.recommendTitle') }}
      </div>
      <div v-if="recommendedTemplates.length" class="umo-ai-chat-box-recommend-list">
        <button
          v-for="item in recommendedTemplates"
          :key="item.id || item.value"
          type="button"
          @click="applyRecommendedTemplate(item)"
        >
          <strong>{{ item.title }}</strong>
          <span>{{ item.reason || item.description || item.type }}</span>
        </button>
      </div>
      <div v-else-if="!recommending" class="umo-ai-chat-box-empty">
        {{ t('templateLibrary.recommendEmpty') }}
      </div>
    </div>
    <div class="umo-ai-chat-box-preview">
      <div
        v-if="previewContent"
        class="umo-ai-chat-box-preview-content"
        v-html="previewContent"
      ></div>
      <div v-else class="umo-ai-chat-box-empty">
        {{ t('aiAssistant.previewEmpty') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  applyGeneratedContent,
  applyTemplateToEditor,
  chatGenerateContent,
  getAiContext,
  recommendTemplates,
  replaceDocumentContent,
  runContextAction,
} from '@/composables/ai-assistant'
import { getActionTarget } from '@/composables/ai-actions'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 }),
  },
  action: {
    type: String,
    default: 'chat',
  },
})

const emits = defineEmits(['update:visible'])

const editor = inject('editor')
const options = inject('options')

let prompt = $ref('')
let previewContent = $ref('')
let loading = $ref(false)
let recommending = $ref(false)
let applyMode = $ref('insert')
let targetRange = $ref(null)
let recommendedTemplates = $ref([])
let recommendTimer = null
let recommendRequestId = 0

const visible = $computed(() => props.visible)
const title = $computed(() => {
  if (props.action === 'chat') return t('aiAssistant.chat')
  return t(`tools.aiActions.${props.action}`)
})
const canGenerate = $computed(() => props.action !== 'chat' || prompt.trim())

watch(
  () => [props.visible, props.action],
  ([value]) => {
    if (!value) return
    previewContent = ''
    prompt = ''
    targetRange = null
    recommendedTemplates = []
  },
)

watch(
  () => prompt,
  () => {
    if (!props.visible || !prompt.trim()) {
      recommendedTemplates = []
      return
    }
    if (recommendTimer) clearTimeout(recommendTimer)
    recommendTimer = setTimeout(loadRecommendations, 450)
  },
)

const normalizeContent = (result) => result?.content || result?.html || result?.text || ''

const generate = async () => {
  if (!canGenerate || loading) return
  loading = true
  try {
    const context = getAiContext(editor, options)
    const target = props.action === 'chat' ? null : getActionTarget(editor.value, props.action)
    if (props.action !== 'chat' && props.action !== 'write' && !target) {
      useMessage('warning', `没有文本需要${t(`tools.aiActions.${props.action}`)}`)
      return
    }
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
    const payload = {
      action: props.action,
      prompt,
      context,
    }
    const result = props.action === 'chat'
      ? await chatGenerateContent(options, payload)
      : await runContextAction(options, payload)
    previewContent = normalizeContent(result)
    if (props.action === 'chat' || props.action === 'write') {
      applyMode = 'insert'
      targetRange = null
    } else {
      applyMode = 'replace'
      targetRange = target
    }
  } catch (error) {
    useMessage('error', error?.message || t('aiAssistant.generateFailed'))
  } finally {
    loading = false
  }
}

const loadRecommendations = async () => {
  const currentRequestId = ++recommendRequestId
  recommending = true
  try {
    const context = getAiContext(editor, options)
    const result = await recommendTemplates(options, {
      prompt,
      context,
      types: ['document', 'text', 'chart', 'data'],
      limit: 5,
    })
    if (currentRequestId !== recommendRequestId) return
    recommendedTemplates = Array.isArray(result) ? result : result?.items || []
  } catch {
    if (currentRequestId === recommendRequestId) {
      recommendedTemplates = []
    }
  } finally {
    if (currentRequestId === recommendRequestId) {
      recommending = false
    }
  }
}

const applyRecommendedTemplate = async (template) => {
  try {
    await applyTemplateToEditor(editor, options, template, {
      prompt,
      context: getAiContext(editor, options),
    })
    close()
  } catch (error) {
    useMessage('error', error?.message || t('templateLibrary.applyFailed'))
  }
}

const applyPreview = () => {
  if (!previewContent) return
  const context = getAiContext(editor, options)
  if (applyMode === 'document') {
    replaceDocumentContent(editor, previewContent)
  } else if (applyMode === 'replace' && targetRange) {
    applyGeneratedContent(editor, previewContent, targetRange)
  } else {
    applyGeneratedContent(editor, previewContent)
  }
  close()
}

const close = () => {
  emits('update:visible', false)
}

onBeforeUnmount(() => {
  if (recommendTimer) clearTimeout(recommendTimer)
})
</script>

<style lang="less">
.umo-ai-chat-box {
  position: fixed;
  z-index: 6000;
  width: min(420px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: solid 1px var(--umo-border-color);
  border-radius: 6px;
  background-color: var(--umo-color-white);
  box-shadow: var(--td-shadow-2);
}
.umo-ai-chat-box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.umo-ai-chat-box-actions {
  display: flex;
  gap: 8px;
}
.umo-ai-chat-box-preview {
  min-height: 80px;
  max-height: 220px;
  overflow: auto;
  border: solid 1px var(--umo-border-color-light);
  border-radius: 4px;
  padding: 8px;
}
.umo-ai-chat-box-recommend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.umo-ai-chat-box-recommend-title {
  font-size: 12px;
  color: var(--umo-text-color-light);
}
.umo-ai-chat-box-recommend-list {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  button {
    flex: 0 0 128px;
    min-height: 52px;
    border: solid 1px var(--umo-border-color);
    border-radius: 4px;
    background: var(--umo-color-white);
    color: var(--umo-text-color);
    text-align: left;
    padding: 6px;
    cursor: pointer;
    overflow: hidden;
    strong,
    span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    span {
      color: var(--umo-text-color-light);
      font-size: 12px;
      margin-top: 3px;
    }
    &:hover {
      border-color: var(--umo-primary-color);
    }
  }
}
.umo-ai-chat-box-empty {
  color: var(--umo-text-color-light);
  font-size: 13px;
}
</style>

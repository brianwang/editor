<template>
  <Teleport to="body">
    <div
      v-if="menuVisible"
      class="umo-ai-context-menu"
      :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
      @mousedown.stop
    >
      <button type="button" @click="openChat('chat')">
        {{ t('aiAssistant.chat') }}
      </button>
      <button type="button" :disabled="aiActionLoading" @click="runAiAction('write')">
        {{ t('tools.aiActions.write') }}
      </button>
      <button type="button" :disabled="aiActionLoading" @click="runAiAction('polish')">
        {{ t('tools.aiActions.polish') }}
      </button>
      <button type="button" :disabled="aiActionLoading" @click="runAiAction('expand')">
        {{ t('tools.aiActions.expand') }}
      </button>
      <button type="button" :disabled="aiActionLoading" @click="runAiAction('summarize')">
        {{ t('tools.aiActions.summarize') }}
      </button>
      <button type="button" :disabled="aiActionLoading" @click="runAiAction('translate')">
        {{ t('tools.aiActions.translate') }}
      </button>
      <div class="umo-ai-context-menu-divider"></div>
      <button type="button" @click="insertToc">
        {{ t('insert.toc') }}
      </button>
      <button type="button" @click="openStyleTemplates">
        {{ t('aiAssistant.styleTemplates') }}
      </button>
      <button type="button" @click="openAssistant">
        {{ t('aiAssistant.templates') }}
      </button>
    </div>

    <ai-assistant-chat-box
      v-model:visible="chatVisible"
      :position="panelPosition"
      :action="chatAction"
    />

    <ai-assistant-action-progress
      :visible="actionProgressVisible"
      :progress="actionProgress"
      :action="actionProgressAction"
      :position="actionProgressPosition"
      @stop="stopAiAction"
    />
  </Teleport>
  <ai-assistant-style-template-dialog v-model:visible="styleVisible" />
  <ai-assistant-dialog v-model:visible="assistantVisible" initial-tab="templates" />
</template>

<script setup>
import { useAiActions } from '@/composables/ai-actions'

const editor = inject('editor')
const options = inject('options')

let menuVisible = $ref(false)
let chatVisible = $ref(false)
let styleVisible = $ref(false)
let assistantVisible = $ref(false)
let chatAction = $ref('chat')
let menuPosition = $ref({ x: 0, y: 0 })
let panelPosition = $ref({ x: 0, y: 0 })
const {
  loading: aiActionLoading,
  progressVisible: actionProgressVisible,
  progress: actionProgress,
  progressAction: actionProgressAction,
  requestAiAction,
  stopAiAction,
} = useAiActions(editor, options)

const clampPosition = (event, width = 220, height = 280) => {
  const gap = 12
  return {
    x: Math.max(gap, Math.min(event.clientX, window.innerWidth - width - gap)),
    y: Math.max(gap, Math.min(event.clientY, window.innerHeight - height - gap)),
  }
}

const hideMenu = () => {
  menuVisible = false
}

const handleContextMenu = (event) => {
  if (options.value.ai?.enabled === false || !editor.value?.isEditable) {
    return
  }
  event.preventDefault()
  menuPosition = clampPosition(event, 190, 270)
  panelPosition = clampPosition(event, 440, 420)
  menuVisible = true
}

const openChat = (action) => {
  chatAction = action
  chatVisible = true
  hideMenu()
}

const actionProgressPosition = $computed(() => clampPosition(
  { clientX: menuPosition.x, clientY: menuPosition.y },
  260,
  64,
))

const runAiAction = async (action) => {
  hideMenu()
  await requestAiAction(action)
}

const insertToc = () => {
  editor.value?.chain().focus().addTableOfContents().run()
  hideMenu()
}

const openStyleTemplates = () => {
  styleVisible = true
  hideMenu()
}

const openAssistant = () => {
  assistantVisible = true
  hideMenu()
}

watch(
  () => editor.value,
  (editorInstance, oldEditor) => {
    oldEditor?.view?.dom?.removeEventListener('contextmenu', handleContextMenu)
    editorInstance?.view?.dom?.addEventListener('contextmenu', handleContextMenu)
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('mousedown', hideMenu)
  document.addEventListener('scroll', hideMenu, true)
})

onBeforeUnmount(() => {
  editor.value?.view?.dom?.removeEventListener('contextmenu', handleContextMenu)
  document.removeEventListener('mousedown', hideMenu)
  document.removeEventListener('scroll', hideMenu, true)
})
</script>

<style lang="less">
.umo-ai-context-menu {
  position: fixed;
  z-index: 5999;
  width: 180px;
  padding: 6px;
  border: solid 1px var(--umo-border-color);
  border-radius: 6px;
  background-color: var(--umo-color-white);
  box-shadow: var(--td-shadow-2);
  button {
    width: 100%;
    height: 30px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--umo-text-color);
    text-align: left;
    padding: 0 8px;
    cursor: pointer;
    &:disabled {
      cursor: not-allowed;
      color: var(--umo-text-color-disabled);
    }
    &:hover {
      background-color: var(--umo-button-hover-background);
    }
  }
}
.umo-ai-context-menu-divider {
  height: 1px;
  margin: 5px 4px;
  background-color: var(--umo-border-color-light);
}
</style>

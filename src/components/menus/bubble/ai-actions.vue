<template>
  <template v-if="options.ai?.enabled !== false && hasTextSelection">
    <div class="umo-bubble-menu-divider"></div>
    <menus-button
      ico="ai-actions"
      :text="t('tools.aiActions.text')"
      menu-type="dropdown"
    >
      <template #dropmenu>
        <t-dropdown-menu>
          <t-dropdown-item
            v-for="action in options.ai?.actions"
            :key="action"
            :value="action"
            @click="requestAiAction(action)"
          >
            {{ t(`tools.aiActions.${action}`) }}
          </t-dropdown-item>
        </t-dropdown-menu>
      </template>
    </menus-button>
  </template>
  <ai-assistant-action-progress
    :visible="progressVisible"
    :progress="progress"
    :action="progressAction"
    @stop="stopAiAction"
  />
</template>

<script setup>
import { useAiActions } from '@/composables/ai-actions'

const editor = inject('editor')
const options = inject('options')
const {
  progressVisible,
  progress,
  progressAction,
  requestAiAction,
  stopAiAction,
} = useAiActions(editor, options)

const hasTextSelection = $computed(() => {
  if (!editor.value) return false
  const { from, to } = editor.value.state.selection
  return from !== to
})
</script>

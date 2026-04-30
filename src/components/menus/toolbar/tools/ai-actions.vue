<template>
  <menus-button
    v-if="options.ai?.enabled !== false"
    ico="ai-actions"
    :text="t('tools.aiActions.text')"
    menu-type="dropdown"
    huge
  >
    <template #dropmenu>
      <t-dropdown-menu>
        <t-dropdown-item
          v-for="action in options.ai?.actions"
          :key="action"
          :value="action"
          @click="requestAiAction(action, 'replace')"
        >
          {{ t(`tools.aiActions.${action}`) }}
        </t-dropdown-item>
        <t-dropdown-item divider value="write-after" @click="requestAiAction('write', 'insert')">
          {{ t('tools.aiActions.writeAfter') }}
        </t-dropdown-item>
      </t-dropdown-menu>
    </template>
  </menus-button>
</template>

<script setup>
import { useAiActions } from '@/composables/ai-actions'

const editor = inject('editor')
const options = inject('options')
const { requestAiAction } = useAiActions(editor)
</script>

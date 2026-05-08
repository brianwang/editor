<template>
  <menus-button
    v-if="options.ai?.enabled !== false"
    ico="ai-actions"
    :text="t('aiAssistant.title')"
    huge
    @menu-click="dialogVisible = true"
  />
  <ai-assistant-dialog v-model:visible="dialogVisible" initial-tab="templates" />
</template>

<script setup>
const options = inject('options')

let dialogVisible = $ref(false)
</script>

<template>
  <menus-button
    ico="ai-generate"
    :text="t('tools.aiGenerate.text')"
    huge
    @menu-click="handleClick"
  />
</template>

<script setup>
function handleClick() {
  window.parent.postMessage({ type: 'ai-generate-requested' }, '*')
}
</script>

<template>
  <menus-button
    ico="document-template"
    :text="t('newDocument.title')"
    huge
    @menu-click="dialogVisible = true"
  />
  <new-document-dialog v-model:visible="dialogVisible" />
</template>

<script setup>
let dialogVisible = $ref(false)
</script>

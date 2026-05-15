<template>
  <menus-button
    v-if="options.templateStore?.list"
    ico="template"
    :text="t('templateLibrary.title')"
    huge
    @menu-click="dialogVisible = true"
  />
  <template-library-dialog v-model:visible="dialogVisible" />
</template>

<script setup>
const options = inject('options')

let dialogVisible = $ref(false)
</script>

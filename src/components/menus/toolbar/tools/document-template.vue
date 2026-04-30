<template>
  <menus-button
    v-if="options.documentTemplates?.length"
    ico="document-template"
    :text="t('tools.documentTemplate')"
    huge
    @menu-click="dialogVisible = true"
  />
  <document-template-dialog
    v-if="options.documentTemplates?.length"
    v-model:visible="dialogVisible"
    @select="applyTemplate"
  />
</template>

<script setup>
const editor = inject('editor')
const options = inject('options')
const container = inject('container')

let dialogVisible = $ref(false)

const applyTemplate = async (template) => {
  const content = template.content ?? (await template.fetch?.())
  if (!content) return
  const confirmed = await new Promise((resolve) => {
    const dialog = useConfirm({
      attach: container,
      header: t('tools.documentTemplate'),
      body: t('documentTemplate.replaceWarning'),
      onConfirm() {
        dialog.destroy()
        resolve(true)
      },
      onCancel() {
        dialog.destroy()
        resolve(false)
      },
      onClose() {
        resolve(false)
      },
    })
  })
  if (!confirmed) return
  editor.value.commands.setContent(content)
  dialogVisible = false
}
</script>

<template>
  <bubble-menu
    v-if="editor"
    class="umo-editor-bubble-menu"
    :editor="editor"
    :should-show="shouldShowBubbleMenu"
  >
    <menus-bubble-menus v-if="options?.document?.enableBubbleMenu">
      <template #bubble_menu="props">
        <slot name="bubble_menu" v-bind="props" />
      </template>
    </menus-bubble-menus>
  </bubble-menu>
</template>

<script setup>
import { TextSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/vue-3/menus'

const editor = inject('editor')
const options = inject('options')

let isPointerSelecting = $ref(false)

const isEditorContentEvent = (event) => {
  const editorDom = editor.value?.view?.dom
  return editorDom && event.target instanceof Node && editorDom.contains(event.target)
}

const startPointerSelection = (event) => {
  if (event.button !== 0 || !isEditorContentEvent(event)) {
    return
  }
  isPointerSelecting = true
}

const stopPointerSelection = () => {
  if (!isPointerSelecting) {
    return
  }
  requestAnimationFrame(() => {
    isPointerSelecting = false
  })
}

const shouldShowBubbleMenu = ({ editor: currentEditor, view, state, from, to }) => {
  if (isPointerSelecting || !options.value?.document?.enableBubbleMenu) {
    return false
  }
  const { doc, selection } = state
  const isEmptyTextBlock =
    selection instanceof TextSelection && !doc.textBetween(from, to).length
  const isChildOfMenu = document.activeElement?.closest?.('.umo-editor-bubble-menu')
  const hasEditorFocus = view.hasFocus() || isChildOfMenu
  return hasEditorFocus && !selection.empty && !isEmptyTextBlock && currentEditor.isEditable
}

onMounted(() => {
  document.addEventListener('mousedown', startPointerSelection, true)
  document.addEventListener('mouseup', stopPointerSelection, true)
  document.addEventListener('dragend', stopPointerSelection, true)
  window.addEventListener('blur', stopPointerSelection)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', startPointerSelection, true)
  document.removeEventListener('mouseup', stopPointerSelection, true)
  document.removeEventListener('dragend', stopPointerSelection, true)
  window.removeEventListener('blur', stopPointerSelection)
})
</script>

<style lang="less">
.umo-editor-bubble-menu {
  max-width: 580px;
  z-index: 110;
  border-radius: var(--umo-radius);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 8px 10px !important;
  box-shadow: var(--umo-shadow);
  border: 1px solid var(--umo-border-color);
  background-color: var(--umo-color-white);

  &:empty {
    display: none;
  }

  .umo-menu-button.show-text .umo-button-content .umo-button-text {
    display: none !important;
  }

  .umo-menu-button.huge {
    height: var(--td-comp-size-xs);
    min-width: unset;

    .umo-button-content {
      min-width: unset !important;

      .umo-icon {
        font-size: 16px;
        margin-top: 0;
      }
    }
  }
}
</style>

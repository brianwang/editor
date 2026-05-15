import { Selection } from '@tiptap/extensions'
import { Plugin } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'

import { getSelectionNode } from '@/utils/selection'

const getPointRange = (x, y) => {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y)
    if (!position) return null
    return {
      node: position.offsetNode,
      offset: position.offset,
    }
  }
  const range = document.caretRangeFromPoint?.(x, y)
  if (!range) return null
  return {
    node: range.startContainer,
    offset: range.startOffset,
  }
}

const getLineTextEdgePos = (view, event) => {
  const range = document.createRange()
  const walker = document.createTreeWalker(view.dom, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  let leftEdge = null
  let rightEdge = null
  let node = walker.nextNode()
  while (node) {
    range.selectNodeContents(node)
    for (const rect of range.getClientRects()) {
      const inLine = event.clientY >= rect.top - 10 && event.clientY <= rect.bottom + 10
      if (!inLine) continue
      if (event.clientX >= rect.left && event.clientX <= rect.right) {
        return null
      }
      if (event.clientX < rect.left && (!leftEdge || rect.left < leftEdge.rect.left)) {
        leftEdge = { rect }
      }
      if (event.clientX > rect.right && (!rightEdge || rect.right > rightEdge.rect.right)) {
        rightEdge = { rect }
      }
    }
    node = walker.nextNode()
  }
  const edge = leftEdge || rightEdge
  if (!edge) return null
  const x = leftEdge ? edge.rect.left + 1 : edge.rect.right - 1
  const y = Math.min(Math.max(event.clientY, edge.rect.top + 1), edge.rect.bottom - 1)
  const pointRange = getPointRange(x, y)
  if (!pointRange?.node) return null
  try {
    return view.posAtDOM(pointRange.node, pointRange.offset)
  } catch {
    return null
  }
}

export default Selection.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      className: 'umo-selection',
    }
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setCurrentNodeSelection:
        () =>
        ({ editor, chain }) => {
          editor.commands.selectParentNode()
          const { $anchor } = editor.state.selection
          return chain()
            .setNodeSelection($anchor.pos - $anchor.depth)
            .run()
        },
      deleteSelectionNode:
        () =>
        ({ editor, commands }) => {
          const node = getSelectionNode(editor)
          if (!node) {
            return false
          }
          if (commands.deleteSelection()) {
            return true
          }
          return commands.deleteNode(node.type.name)
        },
    }
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (event.button !== 0 || !view.editable) {
                return false
              }
              const anchor = getLineTextEdgePos(view, event)
              if (anchor === null) {
                return false
              }
              let dragging = true
              const setSelection = (mouseEvent) => {
                const head =
                  view.posAtCoords({
                    left: mouseEvent.clientX,
                    top: mouseEvent.clientY,
                  })?.pos ?? getLineTextEdgePos(view, mouseEvent)
                if (head === null) return
                const tr = view.state.tr.setSelection(
                  TextSelection.create(view.state.doc, anchor, head),
                )
                view.dispatch(tr)
              }
              const mousemove = (mouseEvent) => {
                if (!dragging) return
                mouseEvent.preventDefault()
                setSelection(mouseEvent)
              }
              const mouseup = (mouseEvent) => {
                dragging = false
                document.removeEventListener('mousemove', mousemove, true)
                document.removeEventListener('mouseup', mouseup, true)
                setSelection(mouseEvent)
                view.focus()
              }
              event.preventDefault()
              view.focus()
              setSelection(event)
              document.addEventListener('mousemove', mousemove, true)
              document.addEventListener('mouseup', mouseup, true)
              return true
            },
          },
        },
      }),
    ]
  },
})

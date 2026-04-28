/**
 * PlaceholderHighlight — Tiptap inline node extension for template placeholders.
 *
 * Recognises two syntaxes and renders them as styled inline chips:
 *   - `{{字段名}}`   → kind="field"  → blue chip  (.umo-placeholder-field)
 *   - `[AI:指令]`    → kind="ai"     → purple chip (.umo-placeholder-ai)
 *
 * Usage (register alongside other extensions):
 *   import PlaceholderHighlight from '@/extensions/placeholder-highlight'
 *   // then include PlaceholderHighlight in the extensions array passed to Tiptap
 *
 * HTML round-trip format:
 *   <span data-placeholder-kind="field" data-placeholder-key="字段名">{{字段名}}</span>
 *   <span data-placeholder-kind="ai"    data-placeholder-key="指令">[AI:指令]</span>
 */

import { Node, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/core'

// ── Regex patterns ────────────────────────────────────────────────────────────

/**
 * Matches `{{...}}` — field placeholders.
 * Capture group 1 = the key text between the braces.
 */
const FIELD_INPUT_REGEX = /\{\{([^}]+)\}\}/
const FIELD_PASTE_REGEX = /\{\{([^}]+)\}\}/g

/**
 * Matches `[AI:...]` — AI instruction placeholders.
 * Capture group 1 = the instruction text after the colon.
 */
const AI_INPUT_REGEX = /\[AI:([^\]]+)\]/
const AI_PASTE_REGEX = /\[AI:([^\]]+)\]/g

// ── Helpers ───────────────────────────────────────────────────────────────────

/** CSS class applied to the rendered chip element, keyed by `kind`. */
const CHIP_CLASS = {
  field: 'umo-placeholder-field',
  ai: 'umo-placeholder-ai',
}

/** Visible label rendered inside the chip. */
const chipLabel = (kind, key) =>
  kind === 'field' ? `{{${key}}}` : `[AI:${key}]`

// ── Extension ─────────────────────────────────────────────────────────────────

export const PlaceholderHighlight = Node.create({
  name: 'placeholderHighlight',

  // Inline atom: behaves as a single opaque character inside text content.
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  // ── Attributes ──────────────────────────────────────────────────────────────

  addAttributes() {
    return {
      /**
       * Discriminates between the two placeholder types.
       * @type {'field' | 'ai'}
       */
      kind: {
        default: 'field',
        parseHTML: (element) =>
          element.getAttribute('data-placeholder-kind') ?? 'field',
        renderHTML: ({ kind }) => ({
          'data-placeholder-kind': kind,
        }),
      },

      /**
       * The raw content captured between the syntax delimiters.
       * e.g. "姓名" for {{姓名}}, or "生成摘要" for [AI:生成摘要].
       */
      key: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-placeholder-key') ?? '',
        renderHTML: ({ key }) => ({
          'data-placeholder-key': key,
        }),
      },
    }
  },

  // ── HTML parsing ─────────────────────────────────────────────────────────────
  // Recognises saved output when loading HTML content back into the editor.

  parseHTML() {
    return [
      {
        tag: 'span[data-placeholder-kind]',
      },
    ]
  },

  // ── HTML rendering ────────────────────────────────────────────────────────────
  // Produces the saved representation. Used for export, copy, and persistence.

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind ?? 'field'
    const key = node.attrs.key ?? ''
    const cssClass = CHIP_CLASS[kind] ?? CHIP_CLASS.field

    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: cssClass }),
      chipLabel(kind, key),
    ]
  },

  // ── Commands ─────────────────────────────────────────────────────────────────

  addCommands() {
    return {
      /**
       * Insert a placeholder chip at the current cursor position.
       *
       * @example
       * editor.commands.insertPlaceholder({ kind: 'field', key: '姓名' })
       * editor.commands.insertPlaceholder({ kind: 'ai',    key: '生成摘要' })
       */
      insertPlaceholder:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs })
            .run(),
    }
  },

  // ── Input rules ───────────────────────────────────────────────────────────────
  // Convert syntax typed directly in the editor into the node on completion.

  addInputRules() {
    return [
      // {{fieldKey}} typed in the editor
      nodeInputRule({
        find: FIELD_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          kind: 'field',
          key: match[1],
        }),
      }),

      // [AI:instruction] typed in the editor
      nodeInputRule({
        find: AI_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          kind: 'ai',
          key: match[1],
        }),
      }),
    ]
  },

  // ── Paste rules ───────────────────────────────────────────────────────────────
  // Convert syntax found in pasted plain text into nodes.

  addPasteRules() {
    return [
      // {{fieldKey}} in pasted content
      nodePasteRule({
        find: FIELD_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          kind: 'field',
          key: match[1],
        }),
      }),

      // [AI:instruction] in pasted content
      nodePasteRule({
        find: AI_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          kind: 'ai',
          key: match[1],
        }),
      }),
    ]
  },
})

export default PlaceholderHighlight

<template>
  <div class="description-editor">
    <div class="description-editor-toolbar" role="toolbar" aria-label="Formatage">
      <button
        type="button"
        class="description-editor-btn"
        title="Gras"
        aria-label="Gras"
        @mousedown.prevent="exec('bold')"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="description-editor-btn"
        title="Italique"
        aria-label="Italique"
        @mousedown.prevent="exec('italic')"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        class="description-editor-btn"
        title="Souligné"
        aria-label="Souligné"
        @mousedown.prevent="exec('underline')"
      >
        <u>U</u>
      </button>
      <div class="description-editor-toolbar-sep" aria-hidden="true"></div>
      <button
        type="button"
        class="description-editor-btn"
        :title="t('buildCard.editorLink')"
        :aria-label="t('buildCard.editorLink')"
        @mousedown.prevent="insertLink"
      >
        {{ t('buildCard.editorLinkShort') }}
      </button>
    </div>
    <div
      ref="editableRef"
      class="description-editor-body"
      contenteditable="true"
      role="textbox"
      :aria-placeholder="placeholderText"
      :data-placeholder="placeholderText"
      @input="onInput"
      @paste="onPaste"
      @blur="emitSanitized"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { sanitizeDescriptionHtml } from '~/utils/sanitizeDescriptionHtml'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  { placeholder: '' }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const editableRef = ref<HTMLDivElement | null>(null)
const isInternalUpdate = ref(false)

function exec(command: string, value?: string) {
  document.execCommand(command, false, value)
  editableRef.value?.focus()
}

function insertLink() {
  const raw = window.prompt(t('buildCard.editorLinkPrompt') || 'Texte du lien puis URL : mot[url]')
  if (!raw || !raw.trim()) return
  const match = raw.trim().match(/^(.+?)\[(https?:\/\/[^\]]+)\]$/)
  const linkText = match?.[1]
  const url = match?.[2]
  if (linkText && url) {
    document.execCommand(
      'insertHTML',
      false,
      `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`
    )
  } else {
    const url = window.prompt(t('buildCard.editorLinkUrlOnly') || 'URL du lien (https://…)')
    if (url && /^https?:\/\//i.test(url)) {
      exec('createLink', url)
    }
  }
  editableRef.value?.focus()
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getSanitizedHtml(): string {
  const el = editableRef.value
  if (!el) return ''
  return sanitizeDescriptionHtml(el.innerHTML)
}

function onInput() {
  isInternalUpdate.value = true
  emit('update:modelValue', getSanitizedHtml())
  nextTick().then(() => {
    isInternalUpdate.value = false
  })
}

function emitSanitized() {
  if (!editableRef.value) return
  const sanitized = getSanitizedHtml()
  if (sanitized !== editableRef.value.innerHTML) {
    editableRef.value.innerHTML = sanitized
  }
  emit('update:modelValue', sanitized)
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') ?? ''
  document.execCommand('insertText', false, text)
}

function syncFromModel() {
  if (!editableRef.value || isInternalUpdate.value) return
  const val = props.modelValue?.trim() || ''
  const sanitized = sanitizeDescriptionHtml(val)
  if (editableRef.value.innerHTML !== sanitized) {
    editableRef.value.innerHTML = sanitized
  }
}

watch(
  () => props.modelValue,
  () => syncFromModel()
)

const placeholderText = computed(() => props.placeholder || t('buildCard.descriptionPlaceholder'))

onMounted(() => {
  syncFromModel()
})
</script>

<style scoped>
.description-editor {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--card-border-color-soft);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.26);
  overflow: hidden;
}

.description-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.description-editor-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 26px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  cursor: pointer;
}

.description-editor-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.description-editor-toolbar-sep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
}

.description-editor-body {
  flex: 1;
  min-height: 180px;
  padding: 8px 11px;
  color: #fff;
  font-size: clamp(10px, 0.82vw, 12px);
  line-height: 1.4;
  overflow-y: auto;
  outline: none;
}

.description-editor-body:empty::before,
.description-editor-body[data-placeholder]:empty::before {
  content: attr(data-placeholder);
  color: rgba(255, 255, 255, 0.4);
}

.description-editor-body :deep(a) {
  color: var(--color-gold-300);
  text-decoration: underline;
}
</style>

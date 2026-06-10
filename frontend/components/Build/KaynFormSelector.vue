<template>
  <div ref="rootRef" class="kayn-form-selector">
    <button
      ref="triggerRef"
      type="button"
      class="kayn-form-selector__trigger"
      :title="triggerTitle"
      :aria-label="triggerTitle"
      :aria-expanded="open"
      @click.stop="toggleOpen"
    >
      <img :src="passiveImageUrl" alt="" class="kayn-form-selector__trigger-img" loading="lazy" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="kayn-form-selector__menu"
        :style="menuStyle"
        role="listbox"
        @click.stop
      >
        <button
          v-for="option in options"
          :key="option.form"
          type="button"
          class="kayn-form-selector__option"
          :class="{ 'kayn-form-selector__option--active': modelValue === option.form }"
          :title="option.label"
          :aria-label="option.label"
          role="option"
          :aria-selected="modelValue === option.form"
          @click="selectForm(option.form)"
        >
          <img :src="option.imageUrl" :alt="option.label" class="kayn-form-selector__option-img" />
          <span class="kayn-form-selector__option-label">{{ option.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  getChampionImageUrl,
  getChampionPassiveImageUrl,
  getKaynHudImageUrl,
} from '~/utils/imageUrl'
import type { KaynBuilderForm } from '~/utils/kaynFormTooltipMarkup'
import { getKaynDisplayName } from '~/utils/kaynFormTooltipMarkup'

const props = defineProps<{
  modelValue: KaynBuilderForm
  version: string
  passiveImageFull: string
  baseImageFull: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: KaynBuilderForm]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

const passiveImageUrl = computed(() =>
  getChampionPassiveImageUrl(props.version, props.passiveImageFull)
)

const options = computed(() => [
  {
    form: 0 as KaynBuilderForm,
    label: getKaynDisplayName(0),
    imageUrl: getChampionImageUrl(props.version, props.baseImageFull),
  },
  {
    form: 1 as KaynBuilderForm,
    label: getKaynDisplayName(1),
    imageUrl: getKaynHudImageUrl('slay'),
  },
  {
    form: 2 as KaynBuilderForm,
    label: getKaynDisplayName(2),
    imageUrl: getKaynHudImageUrl('ass'),
  },
])

const triggerTitle = computed(() => {
  const current = options.value.find(option => option.form === props.modelValue)
  return current?.label ?? getKaynDisplayName(0)
})

function updateMenuPosition() {
  const trigger = triggerRef.value
  const menu = menuRef.value
  if (!trigger || !menu) return

  const triggerRect = trigger.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const margin = 8
  const gap = 6

  let top = triggerRect.top - menuRect.height - gap
  let left = triggerRect.right - menuRect.width

  if (top < margin) {
    top = triggerRect.bottom + gap
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - margin))

  menuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    zIndex: '10000',
  }
}

function toggleOpen() {
  open.value = !open.value
}

function selectForm(form: KaynBuilderForm) {
  emit('update:modelValue', form)
  open.value = false
}

function onDocumentPointerDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (rootRef.value?.contains(target)) return
  if (menuRef.value?.contains(target)) return
  open.value = false
}

watch(open, async isOpen => {
  if (isOpen) {
    await nextTick()
    updateMenuPosition()
    await nextTick()
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
  } else {
    window.removeEventListener('resize', updateMenuPosition)
    window.removeEventListener('scroll', updateMenuPosition, true)
  }
})

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
})
</script>

<style scoped>
.kayn-form-selector {
  position: absolute;
  top: 10px;
  right: 58px;
  z-index: 20;
}

.kayn-form-selector__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(200, 155, 60, 0.55);
  border-radius: 4px;
  background: rgba(15, 18, 22, 0.92);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.kayn-form-selector__trigger:hover {
  border-color: rgba(200, 155, 60, 0.95);
  box-shadow: 0 0 8px rgba(200, 155, 60, 0.35);
}

.kayn-form-selector__trigger-img {
  width: 18px;
  height: 18px;
  object-fit: cover;
  border-radius: 2px;
}

.kayn-form-selector__menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 8px;
  background: rgba(12, 14, 18, 0.98);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  min-width: 88px;
}

.kayn-form-selector__option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.88);
  font-size: 10px;
  text-align: left;
}

.kayn-form-selector__option:hover {
  background: rgba(200, 155, 60, 0.12);
}

.kayn-form-selector__option--active {
  border-color: rgba(200, 155, 60, 0.75);
  background: rgba(200, 155, 60, 0.16);
}

.kayn-form-selector__option-img {
  width: 24px;
  height: 24px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.kayn-form-selector__option-label {
  line-height: 1.1;
  white-space: nowrap;
}
</style>

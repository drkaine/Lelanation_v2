<template>
  <form class="contact-form space-y-4" @submit.prevent="submitContact">
    <div>
      <label :for="`${idPrefix}type`" class="mb-1 block text-sm font-medium text-text">
        {{ t('contactModal.type') }}
      </label>
      <select
        :id="`${idPrefix}type`"
        v-model="contactForm.type"
        required
        class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
      >
        <option value="suggestion">{{ t('contactModal.types.suggestion') }}</option>
        <option value="bug">{{ t('contactModal.types.bug') }}</option>
        <option value="reclamation">{{ t('contactModal.types.reclamation') }}</option>
        <option value="autre">{{ t('contactModal.types.autre') }}</option>
      </select>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label :for="`${idPrefix}name`" class="mb-1 block text-sm font-medium text-text">
          {{ t('contactModal.name') }}
        </label>
        <input
          :id="`${idPrefix}name`"
          v-model="contactForm.name"
          type="text"
          required
          maxlength="256"
          class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
        />
      </div>
      <div>
        <label :for="`${idPrefix}contact`" class="mb-1 block text-sm font-medium text-text">
          {{ t('contactModal.contact') }}
        </label>
        <input
          :id="`${idPrefix}contact`"
          v-model="contactForm.contact"
          type="text"
          maxlength="256"
          :placeholder="t('contactModal.contactPlaceholder')"
          class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
        />
      </div>
    </div>
    <div>
      <label :for="`${idPrefix}message`" class="mb-1 block text-sm font-medium text-text">
        {{ t('contactModal.message') }}
      </label>
      <textarea
        :id="`${idPrefix}message`"
        v-model="contactForm.message"
        required
        rows="4"
        maxlength="5000"
        class="w-full resize-y rounded border border-primary/50 bg-background px-3 py-2 text-text"
      />
    </div>
    <p v-if="contactFeedback" :class="contactError ? 'text-error' : 'text-green-400'">
      {{ contactFeedback }}
    </p>
    <div class="flex flex-wrap justify-end gap-2">
      <button
        v-if="showCancel"
        type="button"
        class="rounded border border-primary/50 px-4 py-2 text-sm text-text transition-colors hover:bg-primary/20"
        @click="emit('cancel')"
      >
        {{ t('contactModal.close') }}
      </button>
      <button
        type="submit"
        class="rounded bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark disabled:opacity-50"
        :disabled="contactSending"
      >
        {{ contactSending ? '…' : t('contactModal.submit') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { apiUrl } from '~/utils/apiUrl'

const props = withDefaults(
  defineProps<{
    idPrefix?: string
    showCancel?: boolean
  }>(),
  {
    idPrefix: 'contact-',
    showCancel: false,
  }
)

const emit = defineEmits<{
  success: []
  cancel: []
}>()

const { t } = useI18n()

const contactSending = ref(false)
const contactFeedback = ref('')
const contactError = ref(false)
const contactForm = ref({
  type: 'suggestion' as 'suggestion' | 'bug' | 'reclamation' | 'autre',
  name: '',
  contact: '',
  message: '',
})

async function submitContact() {
  contactSending.value = true
  contactFeedback.value = ''
  contactError.value = false
  try {
    const res = await fetch(apiUrl('/api/contact'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactForm.value),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      contactFeedback.value = (data.error as string) || t('contactModal.error')
      contactError.value = true
      return
    }
    contactFeedback.value = t('contactModal.success')
    contactError.value = false
    contactForm.value = { type: 'suggestion', name: '', contact: '', message: '' }
    emit('success')
  } catch {
    contactFeedback.value = t('contactModal.error')
    contactError.value = true
  } finally {
    contactSending.value = false
  }
}

defineExpose({ idPrefix: props.idPrefix })
</script>

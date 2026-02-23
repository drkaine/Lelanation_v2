<template>
  <footer class="border-t border-primary/30 bg-surface/50 py-3 text-text/60">
    <div class="max-w-8xl mx-auto px-4">
      <div class="flex flex-col items-center justify-center gap-2 text-xs md:flex-row md:gap-4">
        <span class="text-text/50">© {{ currentYear }} Lelanation</span>
        <span class="hidden md:inline">•</span>
        <NuxtLink
          :to="localePath('/legal')"
          class="transition-colors hover:text-accent"
          :title="t('footer.legal')"
        >
          {{ t('footer.legal') }}
        </NuxtLink>
        <span class="hidden md:inline">•</span>
        <NuxtLink
          :to="localePath('/privacy')"
          class="transition-colors hover:text-accent"
          :title="t('footer.privacy')"
        >
          {{ t('footer.privacy') }}
        </NuxtLink>
        <span class="hidden md:inline">•</span>
        <button
          type="button"
          class="transition-colors hover:text-accent"
          :title="t('footer.contact')"
          @click="openContactModal"
        >
          {{ t('footer.contact') }}
        </button>
        <span class="hidden md:inline">•</span>
        <button
          type="button"
          class="presentation-toggle"
          :title="t('footer.presentationMode')"
          :aria-pressed="isStreamerMode"
          @click="onPresentationModeToggle"
        >
          <span class="presentation-toggle-label">{{ t('footer.presentationMode') }}</span>
          <span class="presentation-toggle-track" :class="{ active: isStreamerMode }">
            <span class="presentation-toggle-thumb" />
          </span>
        </button>
      </div>
    </div>

    <!-- Contact modal -->
    <Teleport to="body">
      <div
        v-if="contactModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
        @click.self="closeContactModal"
      >
        <div
          class="w-full max-w-md rounded-lg border border-primary/30 bg-surface shadow-xl"
          role="dialog"
          aria-labelledby="contact-modal-title"
        >
          <div class="flex items-center justify-between border-b border-primary/20 px-4 py-3">
            <h2 id="contact-modal-title" class="text-lg font-semibold text-text">
              {{ t('contactModal.title') }}
            </h2>
            <button
              type="button"
              class="rounded p-1 text-text/60 transition-colors hover:bg-primary/20 hover:text-text"
              :aria-label="t('contactModal.close')"
              @click="closeContactModal"
            >
              <Icon name="mdi:close" size="20" />
            </button>
          </div>
          <form class="space-y-4 p-4" @submit.prevent="submitContact">
            <div>
              <label for="contact-type" class="mb-1 block text-sm font-medium text-text">
                {{ t('contactModal.type') }}
              </label>
              <select
                id="contact-type"
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
            <div>
              <label for="contact-name" class="mb-1 block text-sm font-medium text-text">
                {{ t('contactModal.name') }}
              </label>
              <input
                id="contact-name"
                v-model="contactForm.name"
                type="text"
                required
                maxlength="256"
                class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
              />
            </div>
            <div>
              <label for="contact-contact" class="mb-1 block text-sm font-medium text-text">
                {{ t('contactModal.contact') }}
              </label>
              <input
                id="contact-contact"
                v-model="contactForm.contact"
                type="text"
                maxlength="256"
                :placeholder="t('contactModal.contactPlaceholder')"
                class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
              />
            </div>
            <div>
              <label for="contact-message" class="mb-1 block text-sm font-medium text-text">
                {{ t('contactModal.message') }}
              </label>
              <textarea
                id="contact-message"
                v-model="contactForm.message"
                required
                rows="4"
                maxlength="5000"
                class="w-full resize-y rounded border border-primary/50 bg-background px-3 py-2 text-text"
              />
            </div>
            <p v-if="contactFeedback" :class="contactError ? 'text-error' : 'text-green-600'">
              {{ contactFeedback }}
            </p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded border border-primary/50 px-4 py-2 text-sm text-text transition-colors hover:bg-primary/20"
                @click="closeContactModal"
              >
                {{ t('contactModal.close') }}
              </button>
              <button
                type="submit"
                class="rounded bg-accent px-4 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
                :disabled="contactSending"
              >
                {{ contactSending ? '…' : t('contactModal.submit') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </footer>
</template>

<script setup lang="ts">
import { apiUrl } from '~/utils/apiUrl'
import { useStreamerMode } from '~/composables/useStreamerMode'

const { t } = useI18n()
const currentYear = new Date().getFullYear()
const localePath = useLocalePath()
const { isStreamerMode, setStreamerMode } = useStreamerMode()

const contactModalOpen = ref(false)
const contactSending = ref(false)
const contactFeedback = ref('')
const contactError = ref(false)
const contactForm = ref({
  type: 'suggestion' as 'suggestion' | 'bug' | 'reclamation' | 'autre',
  name: '',
  contact: '',
  message: '',
})

function openContactModal() {
  contactModalOpen.value = true
  contactFeedback.value = ''
  contactError.value = false
}

function closeContactModal() {
  contactModalOpen.value = false
}

function onPresentationModeToggle() {
  setStreamerMode(!isStreamerMode.value)
}

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
    setTimeout(() => closeContactModal(), 1500)
  } catch {
    contactFeedback.value = t('contactModal.error')
    contactError.value = true
  } finally {
    contactSending.value = false
  }
}
</script>

<style scoped>
footer {
  margin-top: auto;
}

.presentation-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  border-radius: 9999px;
  padding: 3px 8px;
  color: rgb(var(--rgb-text) / 0.85);
  background: rgb(var(--rgb-background) / 0.25);
  transition: background-color 0.2s ease;
}

.presentation-toggle:hover {
  background: rgb(var(--rgb-background) / 0.45);
}

.presentation-toggle-label {
  font-size: 11px;
  line-height: 1;
}

.presentation-toggle-track {
  width: 30px;
  height: 16px;
  border-radius: 9999px;
  background: rgb(var(--rgb-text) / 0.35);
  padding: 2px;
  display: flex;
  align-items: center;
  transition: background-color 0.2s ease;
}

.presentation-toggle-track.active {
  background: rgb(var(--rgb-accent) / 0.7);
}

.presentation-toggle-thumb {
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: rgb(var(--rgb-background));
  transition: transform 0.2s ease;
}

.presentation-toggle-track.active .presentation-toggle-thumb {
  transform: translateX(14px);
}
</style>

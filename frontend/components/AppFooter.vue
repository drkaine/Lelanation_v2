<template>
  <footer class="footer-shell border-t border-primary/30 py-3 text-text/60">
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
        <span v-if="adminMode" class="hidden md:inline">•</span>
        <NuxtLink
          v-if="adminMode"
          :to="localePath('/lelanation-app')"
          class="transition-colors hover:text-accent"
          :title="t('footer.app')"
        >
          {{ t('footer.app') }}
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
          <div class="p-4">
            <ContactForm
              id-prefix="footer-contact-"
              show-cancel
              @cancel="closeContactModal"
              @success="onContactSuccess"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </footer>
</template>

<script setup lang="ts">
import ContactForm from '~/components/Contact/ContactForm.vue'
import { useAdminAuth } from '~/composables/useAdminAuth'

const { t } = useI18n()
const currentYear = new Date().getFullYear()
const localePath = useLocalePath()
const { isLoggedIn: adminMode } = useAdminAuth()

const contactModalOpen = ref(false)

function openContactModal() {
  contactModalOpen.value = true
}

function closeContactModal() {
  contactModalOpen.value = false
}

function onContactSuccess() {
  setTimeout(() => closeContactModal(), 1500)
}
</script>

<style scoped>
footer {
  margin-top: auto;
}

.footer-shell {
  background: #08101f;
}
</style>

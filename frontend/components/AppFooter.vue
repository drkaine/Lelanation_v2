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
        <span class="hidden md:inline">•</span>
        <NuxtLink
          :to="localePath('/information')"
          class="transition-colors hover:text-accent"
          :title="t('footer.information')"
        >
          {{ t('footer.information') }}
        </NuxtLink>
        <span class="hidden md:inline">•</span>
        <NuxtLink
          :to="localePath('/download')"
          class="transition-colors hover:text-accent"
          :title="t('nav.download')"
        >
          {{ t('nav.download') }}
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
    <AppModal
      :open="contactModalOpen"
      size="sm"
      :title="t('contactModal.title')"
      :close-label="t('contactModal.close')"
      @close="closeContactModal"
    >
      <ContactForm
        id-prefix="footer-contact-"
        show-cancel
        @cancel="closeContactModal"
        @success="onContactSuccess"
      />
    </AppModal>
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
  background: rgb(var(--rgb-chrome) / 1);
}
</style>

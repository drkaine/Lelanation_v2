<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.contact.title') }}</h2>
      <p v-if="contactLoading" class="text-text/70">Chargement…</p>
      <template v-else>
        <p v-if="contactEmpty" class="text-text/70">{{ t('admin.contact.empty') }}</p>
        <div v-else class="space-y-6">
          <div
            v-for="(entries, type) in contactByCategory"
            :key="type"
            class="rounded border border-primary/20 bg-background/50 p-3"
          >
            <h3 class="mb-2 font-semibold capitalize text-text">{{ type }}</h3>
            <ul class="space-y-2">
              <li
                v-for="(entry, idx) in entries"
                :key="`${type}-${idx}`"
                class="flex flex-wrap items-start justify-between gap-2 rounded border border-primary/10 bg-surface/50 p-2"
              >
                <div class="min-w-0 flex-1 text-sm">
                  <span class="font-medium text-text">{{ entry.name }}</span>
                  <span v-if="entry.contact" class="ml-2 text-text/70">· {{ entry.contact }}</span>
                  <p class="mt-1 text-text/80">{{ entry.message }}</p>
                  <p class="mt-1 text-xs text-text/60">{{ entry.date }}</p>
                </div>
                <button
                  type="button"
                  class="rounded border border-primary/50 px-2 py-1 text-sm text-error transition-colors hover:bg-error/20"
                  :disabled="contactDeleting === `${type}-${idx}`"
                  @click="deleteContact(type, idx)"
                >
                  {{ contactDeleting === `${type}-${idx}` ? '…' : t('admin.contact.delete') }}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'

const emit = defineEmits<{ 'auth-error': [message: string | null] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const { fetchWithAuth, clearAuth } = useAdminAuth()

// Contact
const CONTACT_TYPES = ['suggestion', 'bug', 'reclamation', 'autre'] as const
type ContactType = (typeof CONTACT_TYPES)[number]
interface ContactEntry {
  name: string
  message: string
  date: string
  contact?: string
}
type ContactData = Record<ContactType, ContactEntry[]>

const contactByCategory = ref<ContactData | null>(null)
const contactLoading = ref(false)
const contactDeleting = ref<string | null>(null)
const contactEmpty = computed(() => {
  if (!contactByCategory.value) return true
  return CONTACT_TYPES.every(k => !contactByCategory.value![k]?.length)
})

async function loadContact() {
  contactLoading.value = true
  emit('auth-error', null)
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/contact'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    contactByCategory.value = data
  } catch {
    emit('auth-error', t('admin.login.error'))
  } finally {
    contactLoading.value = false
  }
}

async function deleteContact(type: string, index: number) {
  const key = `${type}-${index}`
  contactDeleting.value = key
  try {
    const res = await fetchWithAuth(apiUrl(`/api/admin/contact/${type}/${index}`), {
      method: 'DELETE',
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    if (res.ok) await loadContact()
  } finally {
    contactDeleting.value = null
  }
}

function ensureLoaded() {
  if (!contactByCategory.value && !contactLoading.value) return loadContact()
}

defineExpose({ load: loadContact, ensureLoaded })
</script>

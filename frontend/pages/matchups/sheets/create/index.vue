<script setup lang="ts">
import {
  bootstrapMatchupGuideCreateSession,
  resolveMatchupGuideCreateStep,
} from '~/composables/useMatchupGuideCreateBuilder'

definePageMeta({
  middleware: 'matchup-guides-admin',
})

const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()

onMounted(() => {
  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  bootstrapMatchupGuideCreateSession(editId)

  const query: Record<string, string> = {}
  if (editId) query.editId = editId

  const step = resolveMatchupGuideCreateStep()
  router.replace(localePath({ path: `/matchups/sheets/create/${step}`, query }))
})
</script>

<template>
  <div></div>
</template>

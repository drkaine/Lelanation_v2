<script setup lang="ts">
const route = useRoute()
const localePath = useLocalePath()

definePageMeta({
  layout: false,
})

onMounted(() => {
  const query = { ...route.query } as Record<string, string>
  navigateTo(localePath({ path: '/builds/create/theorycraft', query }), { replace: true })
})
</script>

<template>
  <div />
</template>

<template>
  <div />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const localePath = useLocalePath()

onMounted(() => {
  navigateTo(localePath(`/champions/${route.params.id as string}`))
})
</script>

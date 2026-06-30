<template>
  <div />
</template>

<script setup lang="ts">
const localePath = useLocalePath()

await navigateTo(localePath('/settings'), { redirectCode: 301, replace: true })
</script>

<script setup lang="ts">
const localePath = useLocalePath()
await navigateTo(localePath('/builds/discover'), { redirectCode: 301 })
</script>

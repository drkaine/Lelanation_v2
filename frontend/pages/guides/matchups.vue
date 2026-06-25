<script setup lang="ts">
const localePath = useLocalePath()
await navigateTo(localePath('/matchups/sheets'), { redirectCode: 301 })
</script>

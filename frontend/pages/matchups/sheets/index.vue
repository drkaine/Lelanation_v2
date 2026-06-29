<script setup lang="ts">
const localePath = useLocalePath()
await navigateTo(localePath('/matchups/sheets/discover'), { redirectCode: 301 })
</script>

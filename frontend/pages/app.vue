<script setup lang="ts">
const localePath = useLocalePath()

await navigateTo(localePath('/download'), { replace: true })
</script>

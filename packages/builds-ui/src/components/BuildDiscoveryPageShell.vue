<template>
  <div class="builds-page min-h-screen px-[10px] pb-4 text-text">
    <div class="max-w-8xl mx-auto px-0">
      <div class="flex justify-center">
        <div class="streamer-tabs">
          <slot name="tabs" />
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.streamer-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.2rem;
  max-width: 100%;
}
</style>

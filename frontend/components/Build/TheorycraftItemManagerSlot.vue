<template>
  <div class="items-manager-inline-cell">
    <img
      :src="imageUrl"
      :alt="item.name"
      class="items-manager-inline-icon"
      :class="iconClass"
      :title="title"
      :draggable="draggable"
      @click="emit('click')"
      @mouseenter="emit('mouseenter', $event)"
      @mousemove="emit('mousemove', $event)"
      @mouseleave="emit('mouseleave')"
      @dragstart="emit('dragstart', $event)"
      @dragover="emit('dragover', $event)"
      @drop="emit('drop', $event)"
      @dragend="emit('dragend')"
    />
    <TheorycraftItemStackControls v-if="showStacks" :index="index" :item-id="item.id" />
    <TheorycraftItemPassiveToggle v-if="showPassiveToggle" :index="index" :item-id="item.id" />
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@lelanation/shared-types'
import TheorycraftItemStackControls from '~/components/Build/TheorycraftItemStackControls.vue'
import TheorycraftItemPassiveToggle from '~/components/Build/TheorycraftItemPassiveToggle.vue'

defineProps<{
  index: number
  item: Item
  imageUrl: string
  iconClass: Record<string, boolean>
  title: string
  draggable: boolean
  showStacks: boolean
  showPassiveToggle: boolean
}>()

const emit = defineEmits<{
  click: []
  mouseenter: [event: MouseEvent]
  mousemove: [event: MouseEvent]
  mouseleave: []
  dragstart: [event: DragEvent]
  dragover: [event: DragEvent]
  drop: [event: DragEvent]
  dragend: []
}>()
</script>

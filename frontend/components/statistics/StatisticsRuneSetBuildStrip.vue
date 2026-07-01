<script setup lang="ts">
import type { RunePath } from '@lelanation/shared-types'
import { getRuneImageUrl, getRunePathColor, getRunePathImageUrl } from '~/utils/imageUrl'

const props = defineProps<{
  gameVersion: string
  keystone: number | null
  primaryRow: number[]
  secondaryPath: RunePath | null
  secondaryRunes: number[]
  shards: number[]
  getRuneById: (id: number) => { id: number; name: string; icon: string } | null
  getShardIcon: (id: number) => string
  shardName: (id: number) => string
}>()

function pathMaskStyle(path: RunePath): Record<string, string> {
  const url = getRunePathImageUrl(props.gameVersion, path.icon, path.id, path.name)
  return {
    backgroundColor: getRunePathColor(path.icon, path.id, path.name),
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  }
}
</script>

<template>
  <div class="build-set-build-strip rune-set-build-strip">
    <div
      v-if="keystone || primaryRow.length || secondaryPath || secondaryRunes.length"
      class="rune-set-layout"
    >
      <div
        v-if="keystone || primaryRow.length"
        class="rune-set-tree-col rune-set-tree-col--primary"
      >
        <img
          v-if="keystone && getRuneById(keystone)"
          :src="getRuneImageUrl(gameVersion, getRuneById(keystone)!.icon)"
          :alt="getRuneById(keystone)!.name"
          :title="getRuneById(keystone)!.name"
          class="rune-set-keystone-img"
          width="34"
          height="34"
          loading="lazy"
          decoding="async"
        />
        <template v-for="rid in primaryRow" :key="'pri-' + rid">
          <img
            v-if="getRuneById(rid)"
            :src="getRuneImageUrl(gameVersion, getRuneById(rid)!.icon)"
            :alt="getRuneById(rid)!.name"
            :title="getRuneById(rid)!.name"
            class="rune-set-perk-img"
            width="22"
            height="22"
            loading="lazy"
            decoding="async"
          />
        </template>
      </div>
      <div
        v-if="secondaryPath || secondaryRunes.length"
        class="rune-set-tree-col rune-set-tree-col--secondary"
      >
        <div v-if="secondaryPath" class="rune-set-path-icon" aria-hidden="true">
          <span class="rune-set-path-mask" :style="pathMaskStyle(secondaryPath)" />
        </div>
        <template v-for="rid in secondaryRunes" :key="'sec-' + rid">
          <img
            v-if="getRuneById(rid)"
            :src="getRuneImageUrl(gameVersion, getRuneById(rid)!.icon)"
            :alt="getRuneById(rid)!.name"
            :title="getRuneById(rid)!.name"
            class="rune-set-perk-img"
            width="22"
            height="22"
            loading="lazy"
            decoding="async"
          />
        </template>
      </div>
    </div>
    <div v-if="shards.length" class="rune-set-shards-row">
      <img
        v-for="sid in shards"
        :key="'shard-' + sid"
        :src="getShardIcon(sid)"
        :alt="shardName(sid)"
        :title="shardName(sid)"
        class="rune-set-shard-img"
        width="18"
        height="18"
        loading="lazy"
        decoding="async"
      />
    </div>
  </div>
</template>

<style scoped>
.rune-set-build-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  gap: 0.375rem;
  width: 100%;
  min-width: 0;
  min-height: 7rem;
}

.rune-set-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  min-width: 0;
}

.rune-set-keystone-img {
  display: block;
  width: 2.125rem;
  height: 2.125rem;
  min-width: 2.125rem;
  min-height: 2.125rem;
  border-radius: 9999px;
  object-fit: contain;
  background: rgb(0 0 0 / 0.2);
}

.rune-set-tree-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1875rem;
}

.rune-set-perk-img,
.rune-set-path-icon {
  display: block;
  width: 1.375rem;
  height: 1.375rem;
  min-width: 1.375rem;
  min-height: 1.375rem;
  flex-shrink: 0;
}

.rune-set-perk-img {
  border-radius: 9999px;
  object-fit: contain;
  background: rgb(0 0 0 / 0.2);
}

.rune-set-path-icon {
  border-radius: 9999px;
  overflow: hidden;
}

.rune-set-path-mask {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
}

.rune-set-shards-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  min-height: 1.125rem;
  padding-top: 0.0625rem;
}

.rune-set-shard-img {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
  min-width: 1.125rem;
  min-height: 1.125rem;
  flex-shrink: 0;
  border-radius: 9999px;
  object-fit: contain;
  background: rgb(0 0 0 / 0.25);
}
</style>

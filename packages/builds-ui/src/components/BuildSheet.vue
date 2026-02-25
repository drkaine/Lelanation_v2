<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { Build, Role } from '@lelanation/shared-types'
import { useBuildsCore } from '../composables/useBuildsCore'

export interface ImageResolvers {
  champion: (imageFull: string) => string
  item: (imageFull: string) => string
  spell: (imageFull: string) => string
  championSpell: (championId: string, imageFull: string) => string
  runePath: (icon: string) => string
  rune: (icon: string) => string
  shard: (shardId: number) => string
  role: (role: string) => string
}

export interface RuneLookup {
  getRuneIcon: (runeId: number) => string
  getRuneName: (runeId: number) => string
  getPathIcon: (pathId: number) => string
  getShardIcon: (shardId: number) => string
}

const props = defineProps<{
  build: Build
  images: ImageResolvers
  runeLookup: RuneLookup
  version?: string
}>()

const buildRef = toRef(props, 'build')
const core = useBuildsCore(buildRef)

const allRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support']

const getRoleName = (role: Role) => {
  const names: Record<Role, string> = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' }
  return names[role]
}

const filteredSummonerSpells = computed(() =>
  (props.build.summonerSpells ?? []).filter((s): s is NonNullable<typeof s> => s !== null && s !== undefined)
)

const getBootBg = (item: { image: { full: string } }) =>
  `background-image: url('${props.images.item(item.image.full)}')`
</script>

<template>
  <div class="bs-wrapper">
    <div class="bs-card">
      <div class="bs-version">{{ version || build.gameVersion }}</div>

      <div class="bs-roles">
        <div class="bs-roles-col">
          <div
            v-for="role in allRoles"
            :key="role"
            :class="['bs-role-icon', core.selectedRoles.value.includes(role) ? 'bs-role-on' : 'bs-role-off']"
            :title="getRoleName(role)"
          >
            <img :src="images.role(role)" :alt="getRoleName(role)" class="bs-role-img" />
          </div>
        </div>
      </div>

      <!-- Champion -->
      <div class="bs-champion">
        <div class="bs-portrait-wrap">
          <img
            v-if="core.selectedChampion.value"
            :src="images.champion(core.selectedChampion.value.image.full)"
            :alt="core.selectedChampion.value.name"
            class="bs-portrait"
          />
          <div v-else class="bs-portrait-empty" />
        </div>
        <h2 class="bs-champ-name">
          {{ core.selectedChampion.value ? core.selectedChampion.value.name.toUpperCase() : '' }}
        </h2>

        <div class="bs-summs">
          <img
            v-for="(spell, spIdx) in filteredSummonerSpells"
            :key="spIdx"
            :src="images.spell(spell.image.full)"
            :alt="spell.name || spell.id || 'Spell'"
            class="bs-summ-icon"
          />
          <div v-for="n in 2 - filteredSummonerSpells.length" :key="`es-${n}`" class="bs-summ-empty" />
        </div>
        <div class="bs-sep" />
      </div>

      <!-- Runes -->
      <div class="bs-runes">
        <div class="bs-runes-inner">
          <div class="bs-keystone-wrap">
            <img v-if="core.keystoneRuneId.value" :src="runeLookup.getRuneIcon(core.keystoneRuneId.value)" alt="Keystone" class="bs-keystone" />
            <div v-else class="bs-keystone-empty" />
          </div>
          <div class="bs-runes-main">
            <div class="bs-primary-row">
              <img v-for="(id, i) in core.primaryRunesRow.value" :key="i" :src="runeLookup.getRuneIcon(id)" class="bs-primary-rune" />
              <div v-for="n in 3 - core.primaryRunesRow.value.length" :key="`ep-${n}`" class="bs-primary-empty" />
            </div>
            <div class="bs-secondary-row">
              <img v-if="build.runes?.secondary?.pathId" :src="runeLookup.getPathIcon(build.runes.secondary.pathId)" class="bs-sec-path" />
              <div v-else class="bs-sec-path-empty" />
              <img v-for="(id, i) in core.secondaryRuneIds.value" :key="i" :src="runeLookup.getRuneIcon(id)" class="bs-sec-rune" />
              <div v-for="n in 2 - core.secondaryRuneIds.value.length" :key="`es2-${n}`" class="bs-sec-rune-empty" />
            </div>
          </div>
        </div>
        <div class="bs-shards">
          <img v-for="(id, i) in core.shardIds.value" :key="i" :src="runeLookup.getShardIcon(id)" class="bs-shard" />
          <div v-for="n in 3 - core.shardIds.value.length" :key="`esh-${n}`" class="bs-shard-empty" />
        </div>
      </div>

      <div class="bs-sep" />

      <!-- Items -->
      <div class="bs-items">
        <div class="bs-starters">
          <div v-for="item in core.startingItems.value" :key="`s-${item.id}`" class="bs-item-wrap">
            <img :src="images.item(item.image.full)" :alt="item.name || item.id" class="bs-item-icon" />
          </div>
          <div v-for="n in 2 - core.startingItems.value.length" :key="`esi-${n}`" class="bs-item-empty" />

          <div class="bs-boots-slot">
            <img v-if="core.bootsItems.value.length === 1" :src="images.item(core.bootsItems.value[0].image.full)" class="bs-boots-single" />
            <template v-else-if="core.bootsItems.value.length >= 2">
              <div class="bs-boots-split bs-boots-left" :style="getBootBg(core.bootsItems.value[0])" />
              <div class="bs-boots-split bs-boots-right" :style="getBootBg(core.bootsItems.value[1])" />
            </template>
            <div v-if="core.bootsItems.value.length === 0" class="bs-item-empty" />
          </div>
        </div>

        <div class="bs-paths">
          <div class="bs-path">
            <template v-for="(item, idx) in core.coreItemsPath1.value" :key="`p1-${item.id}`">
              <div class="bs-item-wrap">
                <img :src="images.item(item.image.full)" :alt="item.name || item.id" class="bs-item-icon" />
              </div>
              <span v-if="idx < core.coreItemsPath1.value.length - 1" class="bs-arrow-r">&rarr;</span>
            </template>
            <template v-for="(_, idx) in Array(Math.max(0, 3 - core.coreItemsPath1.value.length))" :key="`ep1-${idx}`">
              <span v-if="idx === 0 && core.coreItemsPath1.value.length > 0" class="bs-arrow-r">&rarr;</span>
              <div class="bs-item-empty" />
              <span v-if="idx < Math.max(0, 3 - core.coreItemsPath1.value.length - 1)" class="bs-arrow-r">&rarr;</span>
            </template>
          </div>
          <div class="bs-path">
            <template v-for="(item, idx) in core.coreItemsPath2.value" :key="`p2-${item.id}`">
              <div class="bs-item-wrap">
                <img :src="images.item(item.image.full)" :alt="item.name || item.id" class="bs-item-icon" />
              </div>
              <span v-if="idx < core.coreItemsPath2.value.length - 1" class="bs-arrow-r">&rarr;</span>
            </template>
            <template v-for="(_, idx) in Array(Math.max(0, 3 - core.coreItemsPath2.value.length))" :key="`ep2-${idx}`">
              <span v-if="idx === 0 && core.coreItemsPath2.value.length > 0" class="bs-arrow-r">&rarr;</span>
              <div class="bs-item-empty" />
              <span v-if="idx < Math.max(0, 3 - core.coreItemsPath2.value.length - 1)" class="bs-arrow-r">&rarr;</span>
            </template>
          </div>
        </div>
      </div>

      <!-- First Three Ups -->
      <div class="bs-first3">
        <div class="bs-skill-col">
          <div v-for="(ab, idx) in core.firstThreeUpsAbilities.value" :key="idx" class="bs-skill-item">
            <div class="bs-skill-icon-wrap">
              <img :src="images.championSpell(core.selectedChampion.value?.id || '', ab.image.full)" :alt="ab.name" class="bs-skill-icon" />
              <span class="bs-skill-key">{{ ab.key }}</span>
              <span class="bs-level-badge">{{ idx + 1 }}</span>
            </div>
            <span v-if="idx < core.firstThreeUpsAbilities.value.length - 1" class="bs-arrow-d">&darr;</span>
          </div>
          <div v-for="n in 3 - core.firstThreeUpsAbilities.value.length" :key="`ef3-${n}`" class="bs-skill-item">
            <div class="bs-skill-icon-wrap"><div class="bs-skill-empty" /><span class="bs-level-badge">{{ core.firstThreeUpsAbilities.value.length + n }}</span></div>
            <span v-if="n < 3 - core.firstThreeUpsAbilities.value.length" class="bs-arrow-d">&darr;</span>
          </div>
        </div>
      </div>

      <!-- Skill Order -->
      <div class="bs-skillorder">
        <div class="bs-skill-col">
          <div v-for="(ab, idx) in core.skillOrderAbilities.value" :key="idx" class="bs-skill-item">
            <div class="bs-skill-icon-wrap">
              <img :src="images.championSpell(core.selectedChampion.value?.id || '', ab.image.full)" :alt="ab.name" class="bs-skill-icon" />
              <span class="bs-skill-key">{{ ab.key }}</span>
            </div>
            <span v-if="idx < core.skillOrderAbilities.value.length - 1" class="bs-arrow-d">&darr;</span>
          </div>
          <div v-for="n in 3 - core.skillOrderAbilities.value.length" :key="`eso-${n}`" class="bs-skill-item">
            <div class="bs-skill-icon-wrap"><div class="bs-skill-empty" /></div>
            <span v-if="n < 3 - core.skillOrderAbilities.value.length" class="bs-arrow-d">&darr;</span>
          </div>
        </div>
      </div>

      <div class="bs-footer">lelanation.fr</div>
    </div>
  </div>
</template>

<style scoped>
.bs-wrapper { display: inline-flex; flex-direction: column; gap: 8px; }

.bs-card {
  position: relative;
  width: 300px;
  height: 450px;
  background: linear-gradient(135deg, #0a1428 0%, #091428 45%, #0a323c 100%);
  border: 2px solid #c89b3c;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  font-family: ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  color: #f0e6d2;
}

.bs-version { position: absolute; top: 8px; right: 8px; font-size: 10px; color: rgba(255,255,255,0.6); }

.bs-roles { position: absolute; top: 30px; right: 8px; display: flex; flex-direction: column; gap: 4px; align-items: center; }
.bs-roles-col { display: flex; flex-direction: column; gap: 4px; align-items: center; }
.bs-role-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; border: none; padding: 0; }
.bs-role-off { opacity: 0.3; filter: grayscale(100%); }
.bs-role-on { opacity: 1; filter: grayscale(0%); border: 1px solid #c89b3c; background: rgba(200,155,60,0.1); }
.bs-role-img { width: 100%; height: 100%; object-fit: contain; }

/* Champion */
.bs-champion { display: flex; flex-direction: column; align-items: center; margin-bottom: 8px; }
.bs-portrait-wrap {
  width: 72px; height: 72px; position: relative; margin-bottom: 8px; flex-shrink: 0;
}
.bs-portrait-wrap::before {
  content: '';
  position: absolute; top: 50%; left: 50%; width: 100%; height: 100%;
  transform: translate(-50%, -50%);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cmask id='dm'%3E%3Crect width='100' height='100' fill='white'/%3E%3Cpolygon points='50,6 94,50 50,94 6,50' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Cpolygon points='50,0 100,50 50,100 0,50' fill='%23c89b3c' mask='url(%23dm)'/%3E%3C/svg%3E");
  background-size: 100% 100%; background-repeat: no-repeat; z-index: 2; pointer-events: none;
}
.bs-portrait {
  position: absolute; top: 50%; left: 50%; width: 88%; height: 88%;
  transform: translate(-50%, -50%); clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  object-fit: cover; z-index: 1;
}
.bs-portrait-empty {
  position: absolute; top: 50%; left: 50%; width: 88%; height: 88%;
  transform: translate(-50%, -50%); clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  background: rgba(255,255,255,0.05); border: 1px dashed #c89b3c; opacity: 0.3; z-index: 1;
}
.bs-champ-name {
  font-size: 18px; font-weight: 700; color: #cdfafa; text-align: center;
  margin: 0 0 8px 0; letter-spacing: 2px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.bs-sep { width: 100%; height: 1px; background: #c89b3c; opacity: 0.8; margin: 8px 0; }

/* Summoner spells */
.bs-summs { display: flex; gap: 6px; justify-content: center; margin: 6px 0; }
.bs-summ-icon { width: 32px; height: 32px; border-radius: 4px; border: 1px solid #c89b3c; object-fit: cover; }
.bs-summ-empty { width: 32px; height: 32px; border-radius: 4px; border: 1px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }

/* Runes */
.bs-runes { margin: 8px 0; position: relative; padding-right: 40px; }
.bs-runes-inner { display: flex; gap: 8px; align-items: flex-start; }
.bs-keystone-wrap { flex-shrink: 0; }
.bs-keystone { width: 52px; height: 52px; border-radius: 50%; border: 2px solid #c89b3c; object-fit: cover; }
.bs-keystone-empty { width: 52px; height: 52px; border-radius: 50%; border: 2px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }
.bs-runes-main { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.bs-primary-row { display: flex; align-items: center; gap: 4px; }
.bs-primary-rune { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #c89b3c; object-fit: cover; }
.bs-primary-empty { width: 28px; height: 28px; border-radius: 50%; border: 1px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }
.bs-secondary-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.bs-sec-path { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #c89b3c; object-fit: cover; }
.bs-sec-path-empty { width: 28px; height: 28px; border-radius: 50%; border: 1px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }
.bs-sec-rune { width: 24px; height: 24px; border-radius: 50%; border: 1px solid #c89b3c; object-fit: cover; }
.bs-sec-rune-empty { width: 24px; height: 24px; border-radius: 50%; border: 1px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }
.bs-shards { position: absolute; top: 0; right: 8px; bottom: 0; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
.bs-shard { width: 20px; height: 20px; border-radius: 3px; border: 1px solid #c89b3c; object-fit: cover; }
.bs-shard-empty { width: 20px; height: 20px; border-radius: 3px; border: 1px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }

/* Items */
.bs-items { margin: 8px 0; padding-left: 10px; }
.bs-starters { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; margin-left: 27px; }
.bs-boots-slot { width: 32px; height: 32px; position: relative; border-radius: 4px; border: 1px dashed #c89b3c; overflow: hidden; background: rgba(255,255,255,0.05); }
.bs-boots-single { width: 100%; height: 100%; object-fit: cover; display: block; }
.bs-boots-split { position: absolute; top: 0; width: 50%; height: 100%; background-size: 32px 32px; background-repeat: no-repeat; }
.bs-boots-left { left: 0; background-position: left center; }
.bs-boots-right { right: 0; background-position: right center; }
.bs-paths { display: flex; flex-direction: column; gap: 6px; }
.bs-path { display: flex; align-items: center; gap: 6px; }
.bs-item-wrap { position: relative; }
.bs-item-icon { width: 32px; height: 32px; border-radius: 4px; border: 1px solid #c89b3c; object-fit: cover; display: block; }
.bs-item-empty { width: 32px; height: 32px; border-radius: 4px; border: 1px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }
.bs-arrow-r { color: #c89b3c; font-size: 14px; font-weight: bold; }

/* Skills */
.bs-first3 { position: absolute; left: 200px; top: 300px; z-index: 10; }
.bs-skillorder { position: absolute; right: 20px; top: 300px; }
.bs-skill-col { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.bs-skill-item { display: flex; flex-direction: column; align-items: center; gap: 2px; position: relative; }
.bs-skill-icon-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
.bs-skill-icon { width: 32px; height: 32px; border-radius: 4px; border: 1px solid #c89b3c; object-fit: cover; }
.bs-skill-empty { width: 32px; height: 32px; border-radius: 4px; border: 1px dashed #c89b3c; background: rgba(255,255,255,0.05); opacity: 0.3; }
.bs-skill-key {
  position: absolute; bottom: -2px; right: -2px; background: rgba(0,0,0,0.9);
  color: #c89b3c; font-size: 10px; font-weight: bold; width: 14px; height: 14px;
  display: flex; align-items: center; justify-content: center; border-radius: 2px; z-index: 1;
}
.bs-level-badge {
  position: absolute; top: -2px; left: -2px; display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%; background-color: #c89b3c; color: #0a1428;
  font-size: 9px; font-weight: bold; z-index: 1;
}
.bs-arrow-d { color: #c89b3c; font-size: 8px; font-weight: bold; margin-top: 1px; line-height: 1; }

.bs-footer { position: absolute; bottom: 8px; left: 8px; font-size: 10px; color: rgba(255,255,255,0.6); }
</style>

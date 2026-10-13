<template>
  <PatchEntityCard v-if="isBugfixPatchEntity(entity)" :entity="entity" />

  <article
    v-else
    class="tpc ui-build-card-surface"
    :class="[`tone-${tone}`, { 'is-compact': isCompact }]"
  >
    <button
      type="button"
      class="tpc-head"
      :aria-expanded="!isCompact"
      :aria-label="entity.name"
      @click="localOpen = !localOpen"
    >
      <span class="tpc-portrait">
        <img
          v-if="entityImageUrl"
          :src="entityImageUrl"
          :alt="entity.name"
          width="48"
          height="48"
          loading="lazy"
          @error="onImageError"
        />
        <Icon v-else name="mdi:file-document-outline" aria-hidden="true" />
      </span>

      <span class="tpc-title">
        <span class="tpc-name">{{ entity.name }}</span>
        <span v-if="subtitle && !isCompact" class="tpc-sub">{{ subtitle }}</span>
        <span class="tpc-counts">
          <span v-if="counts.up" class="tpc-count tone-info">▲ {{ counts.up }}</span>
          <span v-if="counts.down" class="tpc-count tone-error">▼ {{ counts.down }}</span>
          <span v-if="counts.adjust" class="tpc-count tone-accent">◆ {{ counts.adjust }}</span>
        </span>
      </span>

      <span v-if="verdict" class="tpc-verdict">
        <Icon :name="PATCH_TAG_TILES[verdict].icon" aria-hidden="true" />
        <span v-if="!isCompact">{{ t(`patchNotesPage.changeTypes.${verdict}`) }}</span>
      </span>
    </button>

    <div v-if="!isCompact" class="tpc-body">
      <section
        v-for="(section, si) in sections"
        :key="`${section.title}-${si}`"
        class="tpc-section"
      >
        <h4 v-if="section.title && section.title !== subtitle" class="tpc-section-title">
          {{ section.title }}
        </h4>
        <ul class="tpc-rows">
          <li
            v-for="(change, ci) in section.changes"
            :key="ci"
            class="tpc-row"
            :class="[`tone-${statDeltaTone(change.type)}`, { 'is-text': !hasValues(change) }]"
          >
            <span class="tpc-stat">
              <img v-if="change.iconUrl" :src="change.iconUrl" alt="" width="16" height="16" />
              {{ change.stat || (hasValues(change) ? '' : change.after) }}
            </span>
            <span v-if="hasValues(change)" class="tpc-values">
              <span v-if="showBefore(change)" class="tpc-before">{{ change.before }}</span>
              <Icon
                v-if="showBefore(change) && showAfter(change)"
                name="mdi:arrow-right-thin"
                class="tpc-arrow"
                aria-hidden="true"
              />
              <span v-if="showAfter(change)" class="tpc-after">{{ change.after }}</span>
              <a
                v-if="change.linkUrl"
                :href="change.linkUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="tpc-link"
                :aria-label="change.linkLabel || change.linkUrl"
              >
                <Icon name="mdi:open-in-new" aria-hidden="true" />
              </a>
              <span v-if="statDelta(change.before, change.after)" class="tpc-delta">
                {{ statDelta(change.before, change.after) }}
              </span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </article>
</template>

<script setup lang="ts">
import PatchEntityCard from '~/components/PatchEntityCard.vue'
import { usePatchEntityImage } from '~/composables/usePatchEntityImage'
import type { PatchEntity, StatChange } from '~/stores/PatchNotesStore'
import { isBugfixPatchEntity } from '~/utils/patchBugfixItems'
import {
  PATCH_VERDICT_TONES,
  groupChangesBySection,
  patchChangeCounts,
  statDelta,
  statDeltaTone,
} from '~/utils/patchCardGaming'
import { resolvePatchEntitySummaryTag } from '~/utils/patchEntitySummary'
import { PATCH_TAG_TILES } from '~/utils/patchGaming'

const props = defineProps<{ entity: PatchEntity; compact?: boolean }>()

const { t } = useI18n()
const { entityImageUrl, onImageError } = usePatchEntityImage(() => props.entity)

/** En mode compact, un clic ouvre la card ; hors compact, un clic la replie. */
const localOpen = ref(false)
watch(
  () => props.compact,
  () => {
    localOpen.value = false
  }
)
const isCompact = computed(() => (props.compact ? !localOpen.value : localOpen.value))

const verdict = computed(() => resolvePatchEntitySummaryTag(props.entity))
const tone = computed(() => (verdict.value ? PATCH_VERDICT_TONES[verdict.value] : 'muted'))
const counts = computed(() => patchChangeCounts(props.entity.changes))
const subtitle = computed(() => props.entity.subCategory?.trim() ?? '')
const sections = computed(() => groupChangesBySection(props.entity.changes, subtitle.value))

function showBefore(change: StatChange): boolean {
  if (change.type === 'new' || !change.before) return false
  return !(change.before.startsWith('(') && change.before.endsWith(')'))
}

function showAfter(change: StatChange): boolean {
  return change.type !== 'removed' && Boolean(change.after)
}

/** Ligne « stat : avant → après » ; sinon texte libre sur toute la largeur. */
function hasValues(change: StatChange): boolean {
  return Boolean(change.stat) && (showBefore(change) || showAfter(change))
}
</script>

<style scoped>
.tpc {
  --tone: var(--color-text);
  position: relative;
  overflow: hidden;
  border-left: 4px solid var(--tone);
  border-radius: 0.75rem;
  break-inside: avoid;
}

.tone-info {
  --tone: var(--color-info);
}

.tone-error {
  --tone: var(--color-error);
}

.tone-accent {
  --tone: var(--color-accent);
}

.tone-muted {
  --tone: rgb(var(--rgb-primary) / 0.5);
}

.tpc-head {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 14%, transparent), transparent);
  text-align: left;
}

.tpc-portrait {
  display: flex;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid var(--tone);
  border-radius: 0.55rem;
  background: var(--color-blue-600);
  box-shadow: 0 0 10px color-mix(in srgb, var(--tone) 45%, transparent);
}

.tpc-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tpc-title {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
}

.tpc-name {
  overflow: hidden;
  color: var(--color-text-accent);
  font-weight: 800;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.tpc-sub {
  overflow: hidden;
  font-size: 0.75rem;
  opacity: 0.7;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpc-counts {
  display: flex;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 800;
}

.tpc-count {
  color: var(--tone);
}

.tpc-verdict {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tone) 20%, transparent);
  color: var(--tone);
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}

.tpc-body {
  padding: 0.25rem 0.75rem 0.75rem;
}

.tpc-section + .tpc-section {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgb(var(--rgb-primary) / 0.12);
}

.tpc-section-title {
  margin-bottom: 0.3rem;
  color: var(--color-text-accent);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
}

.tpc-rows {
  display: flex;
  flex-direction: column;
}

.tpc-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  padding: 0.3rem 0.4rem;
  border-left: 2px solid var(--tone);
  border-radius: 0.25rem;
  font-size: 0.8rem;
}

.tpc-row:nth-child(odd) {
  background: rgb(var(--rgb-primary) / 0.05);
}

.tpc-row.is-text {
  border-left-color: transparent;
  opacity: 0.85;
}

.tpc-stat {
  display: inline-flex;
  min-width: 0;
  flex: 1 1 10rem;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}

.tpc-stat img {
  width: 1rem;
  height: 1rem;
  border-radius: 0.2rem;
}

.tpc-values {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.tpc-before {
  opacity: 0.55;
  text-decoration: line-through;
}

.tpc-arrow {
  opacity: 0.5;
}

.tpc-after {
  color: var(--tone);
  font-weight: 700;
}

.tpc-link {
  color: var(--color-text-accent);
}

.tpc-delta {
  padding: 0 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tone) 20%, transparent);
  color: var(--tone);
  font-size: 0.7rem;
  font-weight: 800;
}

.tpc.is-compact .tpc-head {
  padding: 0.5rem;
}

.tpc.is-compact .tpc-portrait {
  width: 2.25rem;
  height: 2.25rem;
}

.tpc.is-compact .tpc-name {
  font-size: 0.8rem;
}
</style>

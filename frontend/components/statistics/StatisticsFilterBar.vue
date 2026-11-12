<template>
  <div class="stats-filterbar" role="group" :aria-label="t('statisticsPage.filterBarAria')">
    <div class="stats-filterbar-inner">
      <div v-if="showRole" class="stats-fb-field">
        <span class="stats-fb-label">{{ t('statisticsPage.filterRole') }}</span>
        <div class="stats-fb-seg">
          <button
            type="button"
            :class="['stats-fb-seg-btn', !role ? 'is-active' : '']"
            :aria-pressed="!role"
            @click="emit('update:role', '')"
          >
            {{ t('statisticsPage.filterBarRoleAll') }}
          </button>
          <button
            v-for="r in roles"
            :key="r.value"
            type="button"
            :class="['stats-fb-seg-btn', role === r.value ? 'is-active' : '']"
            :aria-pressed="role === r.value"
            @click="emit('update:role', role === r.value ? '' : r.value)"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <div v-if="showDivision" ref="divisionEl" class="stats-fb-field stats-fb-division">
        <span class="stats-fb-label">{{ t('statisticsPage.filterBarDivision') }}</span>
        <button
          type="button"
          class="stats-fb-select"
          :aria-expanded="divisionOpen"
          @click="divisionOpen = !divisionOpen"
        >
          <span>{{ divisionText }}</span>
          <span aria-hidden="true" class="stats-fb-caret">▾</span>
        </button>
        <div v-if="divisionOpen" class="stats-fb-menu">
          <button
            type="button"
            :class="['stats-fb-menu-item', selectedDivisions.length === 0 ? 'is-active' : '']"
            @click="emit('clear-divisions')"
          >
            {{ t('statisticsPage.filterBarDivisionAll') }}
          </button>
          <button
            v-for="tier in divisions"
            :key="tier"
            type="button"
            :class="['stats-fb-menu-item', selectedDivisions.includes(tier) ? 'is-active' : '']"
            :aria-pressed="selectedDivisions.includes(tier)"
            @click="emit('toggle-division', tier)"
          >
            <img
              v-if="emblemUrl(tier)"
              :src="emblemUrl(tier) ?? undefined"
              alt=""
              width="20"
              height="20"
              class="h-5 w-5 object-contain"
            />
            <span>{{ divisionLabel(tier) }}</span>
          </button>
        </div>
      </div>

      <div v-if="showOtp" class="stats-fb-field">
        <span class="stats-fb-label">{{ t('statisticsPage.filterOtp') }}</span>
        <div class="stats-fb-seg">
          <button
            v-for="s in STATS_OTP_SEGMENTS"
            :key="s.value"
            type="button"
            :class="['stats-fb-seg-btn', otp === s.value ? 'is-active' : '']"
            :aria-pressed="otp === s.value"
            @click="emit('update:otp', s.value)"
          >
            {{ t(s.labelKey) }}
          </button>
        </div>
      </div>

      <slot />

      <button
        type="button"
        class="stats-fb-reset"
        :disabled="activeCount === 0"
        @click="emit('reset')"
      >
        {{ t('statisticsPage.filterBarReset') }}
        <template v-if="activeCount > 0">({{ activeCount }})</template>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  STATS_OTP_SEGMENTS,
  divisionSummary,
  type StatsOtpValue,
} from '~/utils/statistics/filterBarOptions'

const props = defineProps<{
  roles: ReadonlyArray<{ value: string; label: string }>
  role: string
  divisions: readonly string[]
  selectedDivisions: readonly string[]
  otp: StatsOtpValue
  activeCount: number
  showRole: boolean
  showDivision: boolean
  showOtp: boolean
  divisionLabel: (tier: string) => string
  emblemUrl: (tier: string) => string | null | undefined
}>()

const emit = defineEmits<{
  'update:role': [value: string]
  'update:otp': [value: StatsOtpValue]
  'toggle-division': [tier: string]
  'clear-divisions': []
  reset: []
}>()

const { t } = useI18n()
const divisionOpen = ref(false)
const divisionEl = ref<HTMLElement | null>(null)
function onDocPointerDown(e: PointerEvent) {
  if (divisionEl.value && !divisionEl.value.contains(e.target as Node)) divisionOpen.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown))

const divisionText = computed(() => {
  const s = divisionSummary(props.selectedDivisions)
  if (s.kind === 'all') return t('statisticsPage.filterBarDivisionAll')
  if (s.kind === 'one') return props.divisionLabel(s.tier)
  return t('statisticsPage.filterBarDivisionCount', { n: s.count })
})
</script>

<style scoped>
.stats-filterbar {
  border-bottom: 1px solid #463714;
  background: #091428;
}
.stats-filterbar-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 14px 32px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
}
.stats-fb-field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stats-fb-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a09b8c;
}
.stats-fb-seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: #0a1428;
  border: 1px solid #0a323c;
  border-radius: 8px;
}
.stats-fb-seg-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
  white-space: nowrap;
}
.stats-fb-seg-btn:hover {
  color: #f0e6d2;
}
.stats-fb-seg-btn.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.stats-fb-division {
  position: relative;
}
.stats-fb-select {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  min-width: 140px;
  justify-content: space-between;
  padding: 0 12px;
  border: 1px solid #785a28;
  border-radius: 8px;
  background: #0a1428;
  color: #f0e6d2;
  font-size: 14px;
}
.stats-fb-caret {
  color: #c8aa6e;
}
.stats-fb-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
}
.stats-fb-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
  text-align: left;
}
.stats-fb-menu-item:hover {
  background: #1e2328;
  color: #f0e6d2;
}
.stats-fb-menu-item.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.stats-fb-reset {
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
  color: #c8aa6e;
}
.stats-fb-reset:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 767px) {
  .stats-filterbar-inner {
    padding: 12px 16px;
    gap: 10px 16px;
  }
  .stats-fb-field {
    flex-wrap: wrap;
    max-width: 100%;
  }
  .stats-fb-seg {
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .stats-fb-reset {
    margin-left: 0;
  }
}
</style>

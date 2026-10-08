<template>
  <section class="theorycraft-spell-panel space-y-3">
    <div
      v-if="!championId"
      class="rounded-lg border border-border/60 p-6 text-center text-sm text-muted"
    >
      {{ t('theorycraft.spells.selectChampion') }}
    </div>

    <div v-else-if="loading" class="py-6 text-center text-sm text-muted">
      {{ t('theorycraft.spells.loading') }}
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-400/40 p-4 text-sm text-red-400">
      {{ error }}
    </div>

    <template v-else>
      <!-- Mannequin d'entraînement -->
      <div
        v-if="hasVersusTarget() && simulatedTarget"
        class="practice-arena space-y-3 rounded-lg p-3 outline-none"
        tabindex="0"
        @keydown="onPracticeKeydown"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-bold uppercase tracking-wide text-accent">
            {{ practiceTitle }}
            <span class="ml-1 text-[11px] font-normal normal-case text-muted">
              {{ targetSummary }}
            </span>
          </h3>
          <button type="button" class="practice-btn" @click="resetSimulation">
            ↺ {{ t('theorycraft.practice.reset') }}
          </button>
        </div>

        <div class="relative">
          <div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span class="text-lg font-bold tabular-nums text-text">
              {{ Math.round(simulatedTarget.hp) }}
              <span class="text-xs font-normal text-muted">
                / {{ Math.round(targetMaxHp()) }} {{ t('theorycraft.practice.hp') }}
              </span>
              <span v-if="simulatedTarget.shield > 0" class="text-xs font-semibold text-slate-200">
                + {{ Math.round(simulatedTarget.shield) }} {{ t('theorycraft.practice.shield') }}
              </span>
            </span>
            <span v-if="activeHardCcRemaining > 0" class="practice-status practice-status--hard">
              {{ t('theorycraft.practice.stunned') }} {{ activeHardCcRemaining.toFixed(1) }}s
            </span>
            <span v-else-if="activeSlowRemaining > 0" class="practice-status practice-status--slow">
              {{ t('theorycraft.practice.slowed') }} {{ activeSlowRemaining.toFixed(1) }}s
            </span>
            <span v-if="targetDead" class="practice-dead"
              >☠ {{ t('theorycraft.practice.dead') }}</span
            >
          </div>
          <div class="practice-hpbar" role="img" :aria-label="practiceTitle">
            <template v-if="dummyBar">
              <span class="practice-hpbar__hp" :style="{ width: `${dummyBar.hp}%` }" />
              <span class="practice-hpbar__shield" :style="{ width: `${dummyBar.shield}%` }" />
              <span
                v-for="type in DAMAGE_TYPES"
                :key="`lost-${type}`"
                :class="`practice-hpbar__lost dmg-bg-${type}`"
                :style="{ width: `${dummyBar.lost[type]}%` }"
              />
            </template>
          </div>
          <div class="practice-floats" aria-live="polite">
            <span
              v-for="(hit, index) in hitFeed.slice(0, 4)"
              :key="hit.id"
              class="practice-float"
              :class="[
                `dmg-text-${hit.type}`,
                { 'practice-float--lethal': hit.lethal, 'practice-float--crit': hit.crit },
              ]"
              :style="{ right: `${8 + index * 18}%` }"
            >
              -{{ Math.round(hit.amount) }}{{ hit.crit ? '!' : '' }}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <div class="practice-stat">
            <span class="practice-stat__label">{{ t('theorycraft.practice.total') }}</span>
            <span class="practice-stat__value">{{ Math.round(totalDealt) }}</span>
          </div>
          <div class="practice-stat">
            <span class="practice-stat__label">{{ t('theorycraft.practice.dps') }}</span>
            <span class="practice-stat__value">{{ Math.round(combatDps) }}</span>
          </div>
          <div class="practice-stat">
            <span class="practice-stat__label">{{ t('theorycraft.practice.time') }}</span>
            <span class="practice-stat__value">{{ timelineNowSeconds.toFixed(2) }}s</span>
          </div>
          <div class="practice-stat">
            <span class="practice-stat__label">{{ t('theorycraft.practice.cc') }}</span>
            <span class="practice-stat__value text-sm">
              {{ simulatedControl.hardCcSeconds.toFixed(1) }}s
              <span class="text-[10px] text-muted">
                / {{ simulatedControl.slowSeconds.toFixed(1) }}s
              </span>
            </span>
          </div>
          <div class="practice-stat">
            <span class="practice-stat__label">{{ t('theorycraft.practice.healed') }}</span>
            <span class="practice-stat__value text-emerald-400">{{ Math.round(healed) }}</span>
          </div>
          <div class="practice-stat">
            <span class="practice-stat__label">{{ t('theorycraft.practice.shielded') }}</span>
            <span class="practice-stat__value text-sky-300">{{ Math.round(shielded) }}</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-xs">
          <div
            v-for="type in DAMAGE_TYPES"
            :key="`total-${type}`"
            class="practice-type"
            :class="`practice-type--${type}`"
          >
            <span class="practice-type__label">{{ t(`theorycraft.practice.types.${type}`) }}</span>
            <span class="practice-type__value">{{ Math.round(dealtSplit[type]) }}</span>
            <span class="practice-type__pct">{{ Math.round(dealtShares[type]) }}%</span>
          </div>
        </div>

        <div v-if="simulatedResource && simulatedResource.max > 0" class="text-[10px]">
          <div class="practice-resbar">
            <span
              :class="
                simulatedResource.kind === 'energy'
                  ? 'practice-resbar__energy'
                  : 'practice-resbar__mana'
              "
              :style="{
                width: `${(simulatedResource.current / simulatedResource.max) * 100}%`,
              }"
            />
            <span class="practice-resbar__text">
              {{ t(`theorycraft.stats.${simulatedResource.kind}`) }}
              {{ Math.round(simulatedResource.current) }} / {{ Math.round(simulatedResource.max) }}
            </span>
          </div>
        </div>

        <!-- Barre d'actions -->
        <div class="practice-actions">
          <button
            type="button"
            class="practice-action"
            :disabled="autoAttackSplit == null"
            :title="
              damageTitle(
                t('theorycraft.practice.autoAttack'),
                estimatedAutoAttackDamage(),
                autoAttackRawDamage ? rawAttackSplit(autoAttackRawDamage.expected) : null
              )
            "
            @click.exact="useAutoAttack"
            @click.shift.exact="enqueueAutoAttack"
          >
            <span class="practice-action__icon practice-action__icon--aa">⚔</span>
            <span class="practice-action__key">{{ t('theorycraft.practice.spaceKey') }}</span>
            <span v-if="autoRemainingCooldown() > 0.001" class="practice-action__cd">
              {{ autoRemainingCooldown().toFixed(1) }}
            </span>
            <span class="practice-action__dmg">{{
              Math.round(estimatedAutoAttackDamage() ?? 0)
            }}</span>
            <span class="practice-splitbar">
              <span
                v-for="seg in splitBarSegments(autoAttackSplit)"
                :key="seg.type"
                :class="`dmg-bg-${seg.type}`"
                :style="{ width: seg.width }"
              />
            </span>
          </button>
          <button
            v-if="
              passive &&
              (passive.damageVsChampion != null || (passive.controlDurationVsChampion ?? 0) > 0)
            "
            type="button"
            class="practice-action"
            :title="
              damageTitle(
                passive.name,
                passive.damageVsChampion,
                rawEventSplit({ profile: passive.damageProfile })
              )
            "
            @click="usePassiveDamage(passive)"
          >
            <img
              v-if="passive.imageUrl"
              :src="passive.imageUrl"
              :alt="passive.name"
              class="practice-action__icon"
              loading="lazy"
            />
            <span class="practice-action__key">P</span>
            <span v-if="passiveRemainingCooldown() > 0.001" class="practice-action__cd">
              {{ passiveRemainingCooldown().toFixed(1) }}
            </span>
            <span class="practice-action__dmg">{{
              Math.round(passive.damageVsChampion ?? 0)
            }}</span>
            <span class="practice-splitbar">
              <span
                v-for="seg in splitBarSegments(passive.damageVsSplit)"
                :key="seg.type"
                :class="`dmg-bg-${seg.type}`"
                :style="{ width: seg.width }"
              />
            </span>
          </button>
          <button
            v-for="spell in spells"
            :key="`action-${spell.id}`"
            type="button"
            class="practice-action"
            :class="{
              'practice-action--nomana': spellLacksResource(spell),
              'practice-action--active': Boolean(sustainedFireState[spell.id]),
            }"
            :disabled="!spellIsUsable(spell)"
            :title="
              damageTitle(
                spell.name,
                spell.damageVsChampion,
                rawEventSplit({ profile: spell.damageProfile, ability: true })
              )
            "
            @click.exact="useSpellDamage(spell)"
            @click.shift.exact="enqueueSpell(spell)"
          >
            <img
              v-if="spell.imageUrl"
              :src="spell.imageUrl"
              :alt="spell.name"
              class="practice-action__icon"
              loading="lazy"
            />
            <span class="practice-action__key">{{ displaySpellSlot(spell.slot) }}</span>
            <span v-if="sustainedFireState[spell.id]" class="practice-action__on">ON</span>
            <span v-if="spellRemainingCooldown(spell.id) > 0.001" class="practice-action__cd">
              {{ spellRemainingCooldown(spell.id).toFixed(1) }}
            </span>
            <span class="practice-action__dmg">
              {{ spell.damageVsChampion != null ? Math.round(spell.damageVsChampion) : 'CC' }}
            </span>
            <span v-if="(spell.resourceCost ?? 0) > 0" class="practice-action__cost">
              {{ Math.round(spell.resourceCost ?? 0) }}
            </span>
            <span
              v-if="spell.executeBelow"
              class="practice-action__exec"
              :title="
                t('theorycraft.practice.executeBelow', { hp: Math.round(spell.executeBelow) })
              "
            >
              ☠ {{ Math.round(spell.executeBelow) }}
            </span>
            <span class="practice-splitbar">
              <span
                v-for="seg in splitBarSegments(spell.damageVsSplit)"
                :key="seg.type"
                :class="`dmg-bg-${seg.type}`"
                :style="{ width: seg.width }"
              />
            </span>
          </button>
        </div>
        <p class="text-xs text-muted">{{ t('theorycraft.practice.afterMitigation') }}</p>

        <!-- Summoners et consommables -->
        <div v-if="extraActions.length > 0" class="practice-extras flex flex-wrap gap-1.5 text-xs">
          <button
            v-for="action in extraActions"
            :key="action.key"
            type="button"
            class="practice-extra"
            :class="{ 'practice-extra--target': action.side === 'target' }"
            @click="useExtraAction(action)"
          >
            {{ action.label }}
            <span v-if="action.side === 'target'"
              >({{ t('theorycraft.practice.extras.opponent') }})</span
            >
            <span v-if="extraRemainingCooldown(action) > 0.001" class="practice-extra__cd">
              {{ extraRemainingCooldown(action).toFixed(0) }}
            </span>
          </button>
        </div>

        <!-- Combo -->
        <div class="practice-combo flex flex-wrap items-center gap-1.5 text-xs">
          <span class="font-semibold uppercase tracking-wide text-text/70">
            {{ t('theorycraft.practice.combo') }}
          </span>
          <span v-if="actionQueue.length === 0" class="text-muted">
            {{ t('theorycraft.practice.comboEmpty') }}
          </span>
          <button
            v-for="(action, index) in actionQueue"
            :key="`queued-${index}`"
            type="button"
            class="practice-chip"
            :title="t('theorycraft.practice.removeFromCombo')"
            @click="removeQueuedAction(index)"
          >
            {{ action.label }}
          </button>
          <span class="ml-auto flex flex-wrap gap-1">
            <button
              type="button"
              class="practice-btn practice-btn--primary"
              :disabled="actionQueue.length === 0"
              @click="runQueueFromStart"
            >
              ▶ {{ t('theorycraft.practice.runCombo') }}
            </button>
            <button
              type="button"
              class="practice-btn"
              :disabled="actionQueue.length === 0"
              @click="clearQueue"
            >
              {{ t('theorycraft.practice.clearCombo') }}
            </button>
            <button type="button" class="practice-btn" @click="waitTimelineStep">
              ⏱ +{{ timelineStepSeconds.toFixed(1) }}s
            </button>
          </span>
        </div>

        <p class="text-[10px] leading-snug text-muted">
          {{
            t('theorycraft.practice.keyboardHint', {
              keys: spells.map(spell => displaySpellSlot(spell.slot)).join(' '),
            })
          }}
        </p>

        <details v-if="simulationLog.length > 0" class="text-[11px] text-text/80">
          <summary class="cursor-pointer font-semibold uppercase tracking-wide text-text/60">
            {{ t('theorycraft.practice.log.title') }} ({{ simulationLog.length }})
          </summary>
          <p v-for="(line, index) in simulationLog" :key="`sim-log-${index}`" class="tabular-nums">
            {{ line }}
          </p>
        </details>
      </div>

      <!-- Dégâts par source -->
      <div v-if="killRows.length > 0 || spells.length > 0" class="practice-table rounded-lg p-2">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-xs font-bold uppercase tracking-wide text-text/80">
            {{ t('theorycraft.practice.damageTable') }}
          </h3>
          <span class="flex gap-2 text-[10px]">
            <span
              v-for="type in DAMAGE_TYPES"
              :key="`legend-${type}`"
              class="inline-flex items-center gap-1"
            >
              <span :class="`practice-dot dmg-bg-${type}`" />
              {{ t(`theorycraft.practice.types.${type}`) }}
            </span>
          </span>
        </div>
        <table class="w-full text-xs">
          <thead>
            <tr class="text-[10px] uppercase text-muted">
              <th class="text-left font-semibold">{{ t('theorycraft.practice.source') }}</th>
              <th class="text-left font-semibold">{{ t('theorycraft.practice.split') }}</th>
              <th class="text-right font-semibold">{{ t('theorycraft.practice.perCast') }}</th>
              <th class="text-right font-semibold">{{ t('theorycraft.practice.hitsToKill') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in killRows" :key="`row-${row.key}`" class="practice-row">
              <td class="py-1 pr-2">
                <span class="flex items-center gap-1.5">
                  <span class="practice-slot">{{ row.slot }}</span>
                  <span class="truncate font-semibold text-text">{{ row.name }}</span>
                  <span v-if="row.spell" class="flex items-center gap-0.5">
                    <button
                      v-for="rank in row.spell.maxRank"
                      :key="`${row.key}-rank-${rank}`"
                      type="button"
                      class="practice-rank"
                      :class="{ 'practice-rank--on': activeRank(row.spell.id) === rank }"
                      :title="`${t('theorycraft.spells.rank')} ${rank}`"
                      @click="setRank(row.spell.id, rank)"
                    >
                      {{ rank }}
                    </button>
                  </span>
                </span>
              </td>
              <td class="py-1 pr-2">
                <span class="flex flex-wrap gap-1 tabular-nums">
                  <span
                    v-for="part in splitParts(row.split)"
                    :key="part.type"
                    :class="`dmg-text-${part.type}`"
                  >
                    {{ Math.round(part.value) }}
                  </span>
                </span>
              </td>
              <td
                class="py-1 text-right font-bold tabular-nums text-text"
                :title="row.spell?.damageVsTooltip"
              >
                {{ Math.round(row.damage) }}
              </td>
              <td class="py-1 text-right tabular-nums">
                <span v-if="row.hits === 1" class="practice-dead">☠</span>
                <span v-else-if="row.hits != null">{{ row.hits }}×</span>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
            <tr class="practice-row practice-row--total">
              <td class="py-1 pr-2 font-bold text-accent">
                {{ t('theorycraft.practice.fullCombo') }}
              </td>
              <td class="py-1 pr-2">
                <span class="flex flex-wrap gap-1 tabular-nums">
                  <span
                    v-for="part in splitParts(fullComboSplit)"
                    :key="part.type"
                    :class="`dmg-text-${part.type}`"
                  >
                    {{ Math.round(part.value) }}
                  </span>
                </span>
              </td>
              <td class="py-1 text-right font-bold tabular-nums text-accent">
                {{ Math.round(sumSplit(fullComboSplit)) }}
              </td>
              <td class="py-1 text-right">
                <span v-if="fullComboKills" class="practice-dead"
                  >☠ {{ t('theorycraft.practice.lethal') }}</span
                >
                <span v-else class="tabular-nums text-muted">
                  {{ Math.round(Math.max(0, effectiveTargetHp - sumSplit(fullComboSplit))) }}
                  {{ t('theorycraft.practice.hpLeft') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        v-if="!passive && spells.length === 0"
        class="rounded-lg border border-border/60 p-3 text-sm text-muted"
      >
        {{ t('theorycraft.spells.noSpells') }}
      </p>

      <h3
        v-if="passive || spells.length > 0"
        class="pt-1 text-xs font-bold uppercase tracking-wide text-text/70"
      >
        {{ t('theorycraft.practice.details') }}
      </h3>

      <details v-if="passive" class="theorycraft-spell-entry group p-1.5">
        <summary
          class="spell-entry-row flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 marker:content-none"
        >
          <span class="shrink-0 text-[10px] leading-none text-muted" aria-hidden="true">
            <span class="group-open:hidden">▶</span>
            <span class="hidden group-open:inline">▼</span>
          </span>
          <div v-if="passive.imageUrl" class="theorycraft-spell-icon shrink-0">
            <img
              :src="passive.imageUrl"
              :alt="passive.name"
              class="theorycraft-spell-icon__img"
              loading="lazy"
            />
            <span class="theorycraft-spell-icon__key">P</span>
          </div>
          <h3 class="text-sm font-semibold leading-tight text-text">{{ passive.name }}</h3>
          <span
            v-if="(passive.controlDurationVsChampion ?? 0) > 0"
            class="spell-vs-damage-badge"
            :title="passive.controlVsTooltip"
          >
            CC {{ passive.controlDurationVsChampion?.toFixed(2) }}s
          </span>
        </summary>

        <div v-if="passiveStackDefinition" class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label class="flex items-center gap-1.5 text-muted">
            <span>{{ t('theorycraft.spells.stacks') }}</span>
            <input
              type="number"
              min="0"
              :max="passiveStackDefinition.maxStacks ?? undefined"
              class="theorycraft-stack-input rounded border border-border bg-surface text-text"
              :size="stackInputSize(passiveStackDefinition, stackCount(passiveStackDefinition.id))"
              :value="stackCount(passiveStackDefinition.id)"
              @input="onStackInput(passiveStackDefinition.id, $event)"
            />
          </label>
        </div>

        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="passive.summaryHtml && passive.showSummary"
          class="tooltip-spell-description tooltip-game-description mb-2 mt-2 text-sm text-muted"
          v-html="passive.summaryHtml"
        />

        <div
          v-if="passive.descriptionHtml"
          class="tooltip-spell-description tooltip-game-description text-sm"
          v-html="passive.descriptionHtml"
        />

        <div
          v-for="(detail, index) in passive.detailedTexts ?? []"
          :key="`passive-detail-${index}`"
          class="tooltip-spell-description tooltip-game-description mt-2 border-t border-border/40 pt-1.5 text-sm"
          v-html="detail"
        />
        <!-- eslint-enable vue/no-v-html -->
      </details>

      <details v-for="spell in spells" :key="spell.id" class="theorycraft-spell-entry group p-1.5">
        <summary
          class="spell-entry-row flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 marker:content-none"
        >
          <span class="shrink-0 text-[10px] leading-none text-muted" aria-hidden="true">
            <span class="group-open:hidden">▶</span>
            <span class="hidden group-open:inline">▼</span>
          </span>
          <div v-if="spell.imageUrl" class="theorycraft-spell-icon shrink-0">
            <img
              :src="spell.imageUrl"
              :alt="spell.name"
              class="theorycraft-spell-icon__img"
              loading="lazy"
            />
            <span class="theorycraft-spell-icon__key">{{ displaySpellSlot(spell.slot) }}</span>
          </div>
          <h3 class="text-sm font-semibold leading-tight text-text">{{ spell.name }}</h3>
          <span
            v-if="!spell.isDynamic"
            class="rounded bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text/60"
          >
            {{ t('theorycraft.spells.approximateValues') }}
          </span>
          <span
            v-if="(spell.controlDurationVsChampion ?? 0) > 0"
            class="spell-vs-damage-badge"
            :title="spell.controlVsTooltip"
          >
            CC {{ spell.controlDurationVsChampion?.toFixed(2) }}s
          </span>
          <button
            v-if="spell.hasActivatableBuff"
            type="button"
            class="theorycraft-spell-active-toggle shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors"
            :class="
              isSpellActive(spell.id)
                ? 'border-accent bg-accent/25 text-accent'
                : 'border-border text-text/70 hover:border-accent/50'
            "
            :title="t('theorycraft.spells.toggleActive')"
            @click.stop.prevent="toggleSpellActive(spell.id)"
          >
            {{ t('theorycraft.spells.active') }}
          </button>
        </summary>

        <div
          v-if="stackDefinitionForSpell(spell.id, spell.slot)"
          class="mt-2 flex flex-wrap items-center gap-2 text-xs"
        >
          <label class="flex items-center gap-1.5 text-muted">
            <span>{{ t('theorycraft.spells.stacks') }}</span>
            <input
              type="number"
              min="0"
              :max="stackDefinitionForSpell(spell.id, spell.slot)?.maxStacks ?? undefined"
              class="theorycraft-stack-input rounded border border-border bg-surface text-text"
              :size="
                stackInputSize(
                  stackDefinitionForSpell(spell.id, spell.slot)!,
                  stackCount(stackDefinitionForSpell(spell.id, spell.slot)!.id)
                )
              "
              :value="stackCount(stackDefinitionForSpell(spell.id, spell.slot)!.id)"
              @input="onStackInput(stackDefinitionForSpell(spell.id, spell.slot)!.id, $event)"
            />
          </label>
        </div>

        <!-- eslint-disable vue/no-v-html -->
        <dl
          v-if="spell.headerStats?.length"
          class="spell-header-stats mb-2 mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs"
        >
          <div
            v-for="stat in spell.headerStats"
            :key="stat.key"
            class="spell-header-stats__row inline-flex items-baseline gap-1 whitespace-nowrap"
          >
            <dt class="spell-header-stats__label shrink-0 font-semibold uppercase tracking-wide">
              {{ stat.label }}:
            </dt>
            <dd
              class="spell-header-stats__value text-text"
              v-html="stat.valueHtml ?? stat.valueText"
            />
          </div>
        </dl>

        <div
          v-if="spell.summaryHtml && spell.showSummary"
          class="tooltip-spell-description tooltip-game-description mb-2 text-sm text-muted"
          v-html="spell.summaryHtml"
        />

        <div
          v-if="spell.descriptionHtml"
          class="tooltip-spell-description tooltip-game-description text-sm"
          v-html="spell.descriptionHtml"
        />

        <div
          v-for="(detail, index) in spell.detailedTexts ?? []"
          :key="`${spell.id}-detail-${index}`"
          class="tooltip-spell-description tooltip-game-description mt-2 border-t border-border/40 pt-1.5 text-sm"
          v-html="detail"
        />
        <!-- eslint-enable vue/no-v-html -->
      </details>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useChampionData } from '~/composables/useChampionData'
import {
  finalizeTooltipDisplay,
  resolveTheorycraftSpellDescription,
  resolveTheorycraftSpellDetailRaws,
  type TheorycraftSpellCalculation,
  type TheorycraftSpellRuntimeData,
  type TheorycraftStackResolveContext,
} from '~/composables/useTheorycraftTooltip'
import { useBuildStore } from '~/stores/BuildStore'
import type { TheorycraftBuildStats, TheorycraftStackDefinition } from '~/types/theorycraft'
import { normalizeKaynFormMarkup } from '~/utils/kaynFormTooltipMarkup'
import { passiveRankForChampionLevel, resolveHeaderStatAtRank } from '~/utils/theorycraftStats'
import {
  buildStackCalculationsBySource,
  findStackDefinitionForSource,
  parseStackDefinitions,
} from '~/utils/theorycraftStacks'
import { spellHasActivatableBuff } from '~/utils/theorycraftSpellBuffs'
import { getImageUrl } from '~/utils/imageUrl'
import {
  addSplit,
  applyHitToDummy,
  buildDummyBar,
  DAMAGE_TYPES,
  dominantDamageType,
  dpsOf,
  emptySplit,
  mitigateSplit,
  splitShares,
  sumSplit,
  type DamageSplit,
  type DamageType,
  practiceTargetTitle,
  autoAttackRaw,
  rollCrit,
  trainingDummyStats,
  applyExecute,
  healFromHit,
  scaleSplit,
} from '~/utils/theorycraftPracticeTool'
import {
  cooldownAfterReduction,
  evaluateDamageProfile,
  headerCooldownAtRank,
  headerCostAtRank,
  passiveTriggers,
  resolveSustainedFire,
  type SustainedFire,
  parseTooltipDamageParts,
  profileHasDamage,
  resolveDamageProfile,
  resolveExecuteThreshold,
  resolveSpellSustain,
  type DamageProfile,
  type SpellDamageSource,
} from '~/utils/theorycraftSpellDamage'
import {
  abilityItemDamage,
  amplifyItemDamage,
  onHitItemDamage,
  spellbladeDamage,
  type ItemAttacker,
  type ItemTarget,
} from '~/utils/theorycraftItemEffects'
import {
  comboProcDamage,
  createProcState,
  registerProcHit,
  type ProcContext,
} from '~/utils/theorycraftProcs'
import { listSelectedRuneIds } from '~/utils/theorycraftRuneModifiers'
import {
  combineControlDurations,
  consumableHeal,
  defenderMitigation,
  eclipseShield,
  eclipseTriggered,
  healTarget,
  regenerateHp,
  igniteTotalDamage,
  summonerBarrierShield,
  summonerCooldown,
  summonerHealAmount,
} from '~/utils/theorycraftCombatExtras'

interface SpellHeaderStat {
  key: string
  label: string
  valueText: string
  valueHtml?: string
}

interface SpellImageRef {
  full?: string
}

interface ResolvedSpellView {
  id: string
  slot: string
  name: string
  maxRank: number
  imageUrl?: string
  summaryHtml?: string
  showSummary: boolean
  descriptionHtml: string
  detailedTexts?: string[]
  headerStats?: SpellHeaderStat[]
  isDynamic: boolean
  hasActivatableBuff: boolean
  damageVsChampion?: number | null
  damageVsSplit?: DamageSplit | null
  lethalVsChampion?: boolean
  damageVsTooltip?: string
  controlDurationVsChampion?: number | null
  hardControlDurationVsChampion?: number | null
  slowDurationVsChampion?: number | null
  controlVsTooltip?: string
  damageProfile?: DamageProfile | null
  executeBelow?: number | null
  heal?: number
  shield?: number
  cooldownSeconds?: number
  resourceCost?: number
  hitDelaySeconds?: number
  sustainedFire?: SustainedFire | null
}

interface ResolvedPassiveView {
  name: string
  imageUrl?: string
  summaryHtml?: string
  showSummary: boolean
  descriptionHtml: string
  detailedTexts?: string[]
  isDynamic: boolean
  damageVsChampion?: number | null
  damageVsSplit?: DamageSplit | null
  lethalVsChampion?: boolean
  damageVsTooltip?: string
  controlDurationVsChampion?: number | null
  hardControlDurationVsChampion?: number | null
  slowDurationVsChampion?: number | null
  controlVsTooltip?: string
  damageProfile?: DamageProfile | null
  cooldownSeconds?: number
  heal?: number
  shield?: number
}

interface SimulatedTargetState {
  hp: number
  shield: number
}

interface SimulatedControlState {
  hardCcSeconds: number
  slowSeconds: number
}

interface SimulatedResourceState {
  kind: 'mana' | 'energy'
  current: number
  max: number
}

interface TimeWindow {
  start: number
  end: number
}

interface QueuedAction {
  type: 'aa' | 'spell'
  spellId?: string
  label: string
}

interface HitFeedEntry {
  id: number
  label: string
  amount: number
  type: DamageType
  lethal: boolean
  crit: boolean
}

interface PendingHitEvent {
  at: number
  label: string
  split: DamageSplit
  hardCc: number
  slowCc: number
  crit?: boolean
  /** Health-dependent damage, evaluated when the hit lands. */
  profile?: DamageProfile | null
  ability?: boolean
  isAttack?: boolean
  executeBelow?: number | null
  /** Share of on-hit item damage added to the hit (Urgot W shots). */
  onHitRatio?: number
  /** Damage over time (Ignite, Death's Dance): no vamp, no Eclipse proc. */
  periodic?: boolean
  /** Already mitigated by the target (Death's Dance bleed). */
  bypassDefense?: boolean
  /** Heals the target instead of hitting it (potion ticks). */
  heal?: number
  /** Rune / item proc: does not trigger other procs. */
  proc?: boolean
}

type ExtraActionKind = 'ignite' | 'barrier' | 'heal' | 'potion'

interface ExtraAction {
  key: string
  side: 'self' | 'target'
  kind: ExtraActionKind
  label: string
  cooldown: number
  itemId?: string
}

const props = defineProps<{
  championId: string | null
  championData?: Record<string, unknown> | null
  level: number
  buildStats: TheorycraftBuildStats | null
  attackerRawStats?: Record<string, number> | null
  opponentBuildStats?: TheorycraftBuildStats | null
  opponentRawStats?: Record<string, number> | null
  opponentName?: string | null
  opponentItemIds?: string[]
  opponentSummonerIds?: string[]
}>()

const { t, locale } = useI18n()
const buildStore = useBuildStore()

/** Opponent build when one is picked, otherwise the training dummy. */
const hasOpponent = computed(() => Boolean(props.opponentBuildStats && props.opponentRawStats))
const dummyTarget = computed(() => trainingDummyStats(attackerLevelForMitigation()))
const targetStats = computed(
  (): TheorycraftBuildStats =>
    (hasOpponent.value ? props.opponentBuildStats : null) ?? dummyTarget.value.buildStats
)
const targetRaw = computed(
  (): Record<string, number> =>
    (hasOpponent.value ? props.opponentRawStats : null) ?? dummyTarget.value.rawStats
)
/** Attacker stats carrying penetration, lethality and crit. */
const attackerRaw = computed(
  (): Record<string, number> | null =>
    props.attackerRawStats ??
    (buildStore.calculatedStats as unknown as Record<string, number> | null) ??
    null
)
const targetSummary = computed(() =>
  t('theorycraft.practice.targetStats', {
    hp: Math.round(Number(targetStats.value.totalHP ?? 0)),
    armor: Math.round(Number(targetRaw.value.armor ?? targetStats.value.armor ?? 0)),
    mr: Math.round(Number(targetRaw.value.magicResist ?? targetStats.value.magicResist ?? 0)),
  })
)
const practiceTitle = computed(() =>
  practiceTargetTitle(
    hasOpponent.value ? props.opponentName : null,
    t('theorycraft.practice.title')
  )
)
const { loadChampion, error: loadError } = useChampionData()

const loading = ref(false)
const error = ref<string | null>(null)
const loadedChampion = ref<Record<string, unknown> | null>(null)
const rankBySpellId = reactive<Record<string, number>>({})
const stackDefinitions = computed(() => parseStackDefinitions(loadedChampion.value))
const stackCalculationsBySource = computed(() =>
  buildStackCalculationsBySource(loadedChampion.value)
)

const passiveStackDefinition = computed(() =>
  findStackDefinitionForSource(stackDefinitions.value, { scope: 'passive' })
)
const simulatedTarget = ref<SimulatedTargetState | null>(null)
const simulatedControl = ref<SimulatedControlState>({ hardCcSeconds: 0, slowSeconds: 0 })
const simulatedResource = ref<SimulatedResourceState | null>(null)
const timelineNowSeconds = ref(0)
const timelineStepSeconds = ref(0.4)
const hardControlWindows = ref<TimeWindow[]>([])
const slowControlWindows = ref<TimeWindow[]>([])
const spellReadyAt = reactive<Record<string, number>>({})
const autoReadyAt = ref(0)
const castLockUntil = ref(0)
const gcdLockUntil = ref(0)
const actionQueue = ref<QueuedAction[]>([])
const pendingHitEvents = ref<PendingHitEvent[]>([])
const simulationLog = ref<string[]>([])
const dealtSplit = ref<DamageSplit>(emptySplit())
const hitFeed = ref<HitFeedEntry[]>([])
const firstHitAt = ref<number | null>(null)
const lastHitAt = ref<number | null>(null)
const healed = ref(0)
const shielded = ref(0)
const spellbladeReady = ref(false)
const passiveReadyAt = ref(0)
const sustainedFireState = reactive<Record<string, { until: number; nextShotAt: number }>>({})
const targetGrievousUntil = ref(0)
const targetTempShields = ref<Array<{ amount: number; until: number }>>([])
const championHitTimes = ref<number[]>([])
const eclipseReadyAt = ref(0)
/** Rune / item procs (Dark Harvest, Electrocute, Stormsurge…): plain state, read only by hits. */
let procState = createProcState()

function stackDefinitionForSpell(id: string, slot: string): TheorycraftStackDefinition | null {
  return findStackDefinitionForSource(stackDefinitions.value, { scope: 'spell', id, slot })
}

function stackCount(definitionId: string): number {
  return buildStore.theorycraftStackCounts[definitionId] ?? 0
}

function onStackInput(definitionId: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  buildStore.setTheorycraftStackCount(definitionId, value)
}

function stackInputSize(
  definition: Pick<TheorycraftStackDefinition, 'maxStacks'>,
  value: number
): number {
  const maxLen = String(definition.maxStacks ?? 9999).length
  const valueLen = String(value || 0).length
  return Math.max(2, maxLen, valueLen) + 1
}

function buildStackContext(source: {
  scope: 'passive' | 'spell'
  id?: string
  slot?: string
}): TheorycraftStackResolveContext | null {
  const definition = findStackDefinitionForSource(stackDefinitions.value, source)
  if (!definition) return null
  const count = stackCount(definition.id)
  if (count <= 0) return null
  return {
    definition,
    stackCount: count,
    calculationsBySource: stackCalculationsBySource.value,
  }
}

const QWERTY_TO_AZERTY: Record<string, string> = {
  Q: 'A',
  W: 'Z',
  E: 'E',
  R: 'R',
}

function displaySpellSlot(slot: string): string {
  const normalized = String(slot ?? '')
    .trim()
    .toUpperCase()
  if (locale.value === 'fr') {
    return QWERTY_TO_AZERTY[normalized] ?? normalized
  }
  return normalized
}

function championIdForImages(): string {
  const champion = props.championData ?? loadedChampion.value
  return String(props.championId ?? champion?.id ?? '').trim()
}

function spellImageRef(raw: Record<string, unknown>): SpellImageRef | null {
  const image = raw.image
  if (!image || typeof image !== 'object') return null
  return image as SpellImageRef
}

function resolveSpellImageUrl(imageFull: string, isPassive = false): string {
  const filename = String(imageFull ?? '').trim()
  if (!filename) return ''
  const subPath = isPassive ? 'passive' : championIdForImages()
  if (!isPassive && !subPath) return ''
  return getImageUrl('champion-spell', 'latest', filename, subPath)
}

function resolvePassiveImageUrl(passiveRaw: Record<string, unknown>): string {
  const imageFull = String(spellImageRef(passiveRaw)?.full ?? '').trim()
  if (imageFull) return resolveSpellImageUrl(imageFull, true)
  const championId = championIdForImages()
  if (!championId) return ''
  return resolveSpellImageUrl(`${championId}_P.png`, true)
}

function resolveAbilityImageUrl(spellRaw: Record<string, unknown>): string {
  const imageFull = String(spellImageRef(spellRaw)?.full ?? '').trim()
  if (imageFull) return resolveSpellImageUrl(imageFull, false)
  const championId = championIdForImages()
  const slot = String(spellRaw.slot ?? '')
    .trim()
    .toUpperCase()
  if (!championId || !slot) return ''
  return resolveSpellImageUrl(`${championId}${slot}.png`, false)
}

function activeRank(spellId: string): number {
  return rankBySpellId[spellId] ?? 1
}

function setRank(spellId: string, rank: number) {
  rankBySpellId[spellId] = rank
  buildStore.setTheorycraftSpellRank(spellId, rank)
}

function isSpellActive(spellId: string): boolean {
  return Boolean(buildStore.theorycraftActiveSpells[spellId])
}

function toggleSpellActive(spellId: string) {
  buildStore.toggleTheorycraftActiveSpell(spellId)
}

function hasVersusTarget(): boolean {
  return Boolean(props.buildStats)
}

function targetMaxHp(): number {
  return Number(targetStats.value.totalHP ?? 0)
}

function targetInitialShield(): number {
  return Math.max(0, Number(targetRaw.value.shield ?? 0))
}

function resolveResourceKind(): 'mana' | 'energy' {
  const partype = String((props.championData as { partype?: string } | null)?.partype ?? '')
    .trim()
    .toLowerCase()
  return partype.includes('energy') ? 'energy' : 'mana'
}

function maxResourcePool(): number {
  const stats = props.buildStats
  if (!stats) return 0
  if (resolveResourceKind() === 'energy') return 200
  return Math.max(0, Number(stats.maxMana ?? 0))
}

function resetSimulation() {
  dealtSplit.value = emptySplit()
  hitFeed.value = []
  healed.value = 0
  shielded.value = 0
  spellbladeReady.value = false
  passiveReadyAt.value = 0
  Object.keys(sustainedFireState).forEach(key => {
    delete sustainedFireState[key]
  })
  targetGrievousUntil.value = 0
  targetTempShields.value = []
  championHitTimes.value = []
  eclipseReadyAt.value = 0
  procState = createProcState()
  firstHitAt.value = null
  lastHitAt.value = null
  if (!hasVersusTarget()) {
    simulatedTarget.value = null
    simulationLog.value = []
    return
  }
  simulatedTarget.value = {
    hp: Math.max(0, targetMaxHp()),
    shield: targetInitialShield(),
  }
  const maxResource = maxResourcePool()
  simulatedResource.value = {
    kind: resolveResourceKind(),
    current: maxResource,
    max: maxResource,
  }
  timelineNowSeconds.value = 0
  simulatedControl.value = { hardCcSeconds: 0, slowSeconds: 0 }
  hardControlWindows.value = []
  slowControlWindows.value = []
  Object.keys(spellReadyAt).forEach(key => {
    delete spellReadyAt[key]
  })
  autoReadyAt.value = 0
  castLockUntil.value = 0
  gcdLockUntil.value = 0
  actionQueue.value = []
  pendingHitEvents.value = []
  simulationLog.value = []
}

function ensureSimulationState(): SimulatedTargetState | null {
  if (!hasVersusTarget()) return null
  if (!simulatedTarget.value) resetSimulation()
  return simulatedTarget.value
}

let hitFeedSeq = 0

function applyDamageToSimulation(
  split: DamageSplit,
  sourceLabel: string,
  crit = false,
  options: {
    executeBelow?: number | null
    isAttack?: boolean
    periodic?: boolean
    bypassDefense?: boolean
    ability?: boolean
    /** Rune / item proc: does not trigger other procs. */
    proc?: boolean
  } = {}
) {
  const target = ensureSimulationState()
  if (!target) return
  if (!(sumSplit(split) > 0)) return
  if (!options.bypassDefense) {
    const mitigation = defenderMitigation(defenderItemIds.value, split, {
      isAttack: options.isAttack,
      crit,
      defenderRanged: Number(targetRaw.value?.attackRange ?? 0) >= 300,
    })
    split = mitigation.immediate
    if (mitigation.deferred > 0) queueDeathsDanceBleed(mitigation.deferred, sourceLabel)
  }
  const damage = sumSplit(split)
  const next = applyHitToDummy(target, damage)
  target.hp = next.hp
  target.shield = next.shield
  if (!options.periodic) {
    healed.value += healFromHit(next.hpLost + next.absorbed, {
      isAttack: options.isAttack ?? false,
      lifeSteal: Number(attackerRaw.value?.lifeSteal ?? 0),
      omnivamp: Number(attackerRaw.value?.omnivamp ?? 0),
    })
    if (!options.proc) registerChampionHit()
  }
  if (!options.proc) triggerProcs(damage, options)
  const executed = applyExecute(target, options.executeBelow)
  if (executed.executed) {
    target.hp = 0
    target.shield = 0
    recordTimelineEvent(t('theorycraft.practice.log.execute', { label: sourceLabel }))
  }
  dealtSplit.value = addSplit(dealtSplit.value, split)
  const now = timelineNowSeconds.value
  if (firstHitAt.value == null) firstHitAt.value = now
  lastHitAt.value = now
  hitFeedSeq += 1
  hitFeed.value = [
    {
      id: hitFeedSeq,
      label: sourceLabel,
      amount: damage,
      type: dominantDamageType(split) ?? 'physical',
      lethal: target.hp <= 0 && target.shield <= 0,
      crit,
    },
    ...hitFeed.value,
  ].slice(0, 6)
  recordTimelineEvent(
    t('theorycraft.practice.log.hit', {
      label: sourceLabel,
      damage: formatDamageValue(damage),
      hp: formatDamageValue(target.hp),
    })
  )
}

/** Defensive items count only against a real opponent (the dummy has none). */
const defenderItemIds = computed((): string[] =>
  hasOpponent.value ? (props.opponentItemIds ?? []) : []
)

/** Death's Dance: the deferred part is taken as true damage over 3 s. */
function queueDeathsDanceBleed(amount: number, sourceLabel: string) {
  const now = timelineNowSeconds.value
  recordTimelineEvent(
    t('theorycraft.practice.log.deathsDance', {
      label: sourceLabel,
      amount: formatDamageValue(amount),
    })
  )
  for (let tick = 1; tick <= 3; tick += 1) {
    queueHitEvent({
      at: now + tick,
      label: t('theorycraft.practice.extras.deathsDance'),
      split: { ...emptySplit(), true: amount / 3 },
      hardCc: 0,
      slowCc: 0,
      periodic: true,
      bypassDefense: true,
    })
  }
}

/** Rune and item procs of the hit that just landed: immediate ones hit now, others are queued. */
function procContext(): ProcContext {
  return {
    runeIds: listSelectedRuneIds((buildStore.displayedBuild ?? buildStore.currentBuild)?.runes),
    itemIds: attackerItemIds.value,
    attacker: itemAttacker(),
    souls: Number(buildStore.theorycraftRuneStacks[8128] ?? 0),
  }
}

function triggerProcs(
  damage: number,
  options: { isAttack?: boolean; periodic?: boolean; ability?: boolean }
) {
  const target = simulatedTarget.value
  if (!target) return
  const now = timelineNowSeconds.value
  const procs = registerProcHit(
    procState,
    {
      at: now,
      damage,
      isAttack: options.isAttack ?? false,
      ability: options.ability ?? false,
      periodic: options.periodic ?? false,
      targetHp: target.hp,
      targetMaxHp: targetMaxHp(),
    },
    procContext()
  )
  for (const proc of procs) {
    const label = t(`theorycraft.practice.procs.${proc.id}`)
    const split = mitigateRaw(proc.split)
    if (proc.at <= now + 1e-6) {
      applyDamageToSimulation(split, label, false, { proc: true, periodic: proc.periodic })
      continue
    }
    queueHitEvent({
      at: proc.at,
      label,
      split,
      hardCc: 0,
      slowCc: 0,
      proc: true,
      periodic: proc.periodic,
    })
  }
}

/** Eclipse: shield on the 2nd champion hit within 2 s, 6 s cooldown. */
function registerChampionHit() {
  const now = timelineNowSeconds.value
  championHitTimes.value = [...championHitTimes.value.filter(time => now - time <= 2), now]
  if (now + 1e-6 < eclipseReadyAt.value) return
  if (!eclipseTriggered(championHitTimes.value, now)) return
  const attacker = itemAttacker()
  const amount = eclipseShield(attackerItemIds.value, attacker)
  if (amount <= 0) return
  shielded.value += amount
  eclipseReadyAt.value = now + 6
  championHitTimes.value = []
  recordTimelineEvent(
    t('theorycraft.practice.log.selfShield', {
      label: t('theorycraft.practice.extras.eclipse'),
      amount: formatDamageValue(amount),
    })
  )
}

function targetHasGrievousWounds(): boolean {
  return timelineNowSeconds.value + 1e-6 < targetGrievousUntil.value
}

function healTargetNow(amount: number, label: string) {
  const target = ensureSimulationState()
  if (!target) return
  const before = target.hp
  target.hp = healTarget(target, amount, targetMaxHp(), targetHasGrievousWounds()).hp
  recordTimelineEvent(
    t('theorycraft.practice.log.targetHeal', {
      label,
      amount: formatDamageValue(target.hp - before),
    })
  )
}

/** Removes the target's timed shields (Barrier) once they expire. */
function expireTargetShields() {
  const now = timelineNowSeconds.value
  const expired = targetTempShields.value.filter(entry => entry.until <= now + 1e-6)
  if (expired.length === 0) return
  targetTempShields.value = targetTempShields.value.filter(entry => entry.until > now + 1e-6)
  const target = simulatedTarget.value
  if (!target) return
  const amount = expired.reduce((sum, entry) => sum + entry.amount, 0)
  target.shield = Math.max(0, target.shield - amount)
}

const passiveTrigger = computed(() => passiveTriggers(String(props.championId ?? '')))

function passiveRemainingCooldown(): number {
  return Math.max(0, passiveReadyAt.value - timelineNowSeconds.value)
}

/** Passive fired by an attack or a spell (Urgot legs), when off cooldown. */
function procPassive(at: number) {
  const view = passive.value
  if (!view?.damageVsSplit || at + 1e-6 < passiveReadyAt.value) return
  passiveReadyAt.value = at + Math.max(0, Number(view.cooldownSeconds ?? 0))
  queueHitEvent({
    at,
    label: `P ${view.name}`,
    split: view.damageVsSplit,
    hardCc: 0,
    slowCc: 0,
    profile: view.damageProfile,
  })
}

/** Shots of active sustained-fire spells (Urgot W) up to the current time. */
function queueSustainedShots() {
  const now = timelineNowSeconds.value
  for (const spell of spells.value) {
    const fire = spell.sustainedFire
    const state = sustainedFireState[spell.id]
    if (!fire || !state) continue
    const label = `${displaySpellSlot(spell.slot)} ${spell.name}`
    const procs = passiveTrigger.value?.spellSlots.includes(spell.slot.toUpperCase()) ?? false
    while (state.nextShotAt <= Math.min(now, state.until) + 1e-6) {
      queueHitEvent({
        at: state.nextShotAt,
        label,
        split: spell.damageVsSplit ?? emptySplit(),
        hardCc: 0,
        slowCc: 0,
        profile: spell.damageProfile,
        isAttack: true,
        onHitRatio: fire.onHitRatio,
      })
      if (procs) procPassive(state.nextShotAt)
      state.nextShotAt += 1 / fire.shotsPerSecond
    }
    if (state.until <= now) delete sustainedFireState[spell.id]
  }
}

function recordTimelineEvent(message: string) {
  simulationLog.value = [
    `${formatDamageValue(timelineNowSeconds.value)}s · ${message}`,
    ...simulationLog.value,
  ].slice(0, 20)
}

function advanceTimeline(seconds?: number) {
  const step = Number(seconds ?? timelineStepSeconds.value)
  if (!Number.isFinite(step) || step <= 0) return
  timelineNowSeconds.value += step
  if (simulatedResource.value) {
    const regenPerSecond = simulatedResource.value.kind === 'energy' ? 10 : 8
    simulatedResource.value.current = Math.min(
      simulatedResource.value.max,
      simulatedResource.value.current + regenPerSecond * step
    )
  }
  regenerateTarget(step)
  queueSustainedShots()
  processPendingHitEvents()
  expireTargetShields()
}

/** Target health regeneration over the elapsed time (reduced by grievous wounds). */
function regenerateTarget(seconds: number) {
  const target = simulatedTarget.value
  if (!target) return
  const regen = Number(targetRaw.value.healthRegen ?? 0) * (targetHasGrievousWounds() ? 0.6 : 1)
  target.hp = regenerateHp(target, regen, seconds, targetMaxHp()).hp
}

function waitTimelineStep() {
  advanceTimeline()
}

function autoAttackIntervalSeconds(): number {
  const asFromStats = Number(attackerRaw.value?.attackSpeed ?? NaN)
  const attackSpeed = Number.isFinite(asFromStats) && asFromStats > 0 ? asFromStats : 0.7
  return 1 / attackSpeed
}

function spellRemainingCooldown(spellId: string): number {
  const readyAt = Number(spellReadyAt[spellId] ?? 0)
  return Math.max(0, readyAt - timelineNowSeconds.value)
}

function autoRemainingCooldown(): number {
  return Math.max(0, autoReadyAt.value - timelineNowSeconds.value)
}

function actionLockRemaining(): number {
  const now = timelineNowSeconds.value
  return Math.max(0, castLockUntil.value - now, gcdLockUntil.value - now)
}

function applyActionRecovery(castTimeSeconds: number, gcdSeconds = 0.1) {
  const now = timelineNowSeconds.value
  castLockUntil.value = Math.max(castLockUntil.value, now + Math.max(0, castTimeSeconds))
  gcdLockUntil.value = Math.max(gcdLockUntil.value, now + Math.max(0, gcdSeconds))
}

function queueHitEvent(event: PendingHitEvent) {
  pendingHitEvents.value = [...pendingHitEvents.value, event].sort((a, b) => a.at - b.at)
}

function processPendingHitEvents() {
  if (pendingHitEvents.value.length === 0) return
  const now = timelineNowSeconds.value
  const due = pendingHitEvents.value.filter(event => event.at <= now + 1e-6)
  if (due.length === 0) return
  pendingHitEvents.value = pendingHitEvents.value.filter(event => event.at > now + 1e-6)
  for (const event of due) {
    if (event.heal != null) {
      healTargetNow(event.heal, event.label)
      continue
    }
    applyDamageToSimulation(resolveEventSplit(event), event.label, event.crit, {
      executeBelow: event.executeBelow,
      isAttack: event.isAttack,
      periodic: event.periodic,
      bypassDefense: event.bypassDefense,
      ability: event.ability,
      proc: event.proc,
    })
    if (event.hardCc > 0) addControlWindow('hard', event.hardCc)
    if (event.slowCc > 0) addControlWindow('slow', event.slowCc)
    if (event.hardCc > 0 || event.slowCc > 0) {
      recordTimelineEvent(
        t('theorycraft.practice.log.cc', {
          label: event.label,
          hard: formatDamageValue(event.hardCc),
          slow: formatDamageValue(event.slowCc),
        })
      )
    }
  }
}

function mergeTimeWindows(windows: TimeWindow[]): TimeWindow[] {
  if (windows.length <= 1) return windows
  const sorted = [...windows].sort((a, b) => a.start - b.start)
  const merged: TimeWindow[] = [sorted[0]!]
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!
    const last = merged[merged.length - 1]!
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

function addControlWindow(kind: 'hard' | 'slow', durationSeconds: number) {
  const duration = Math.max(0, Number(durationSeconds) || 0)
  if (duration <= 0) return
  const start = timelineNowSeconds.value
  const end = start + duration
  if (kind === 'hard') {
    hardControlWindows.value = mergeTimeWindows([...hardControlWindows.value, { start, end }])
  } else {
    slowControlWindows.value = mergeTimeWindows([...slowControlWindows.value, { start, end }])
  }
}

function totalWindowDuration(windows: TimeWindow[]): number {
  return windows.reduce((sum, window) => sum + Math.max(0, window.end - window.start), 0)
}

function spellIsUsable(spell: ResolvedSpellView): boolean {
  return spell.damageVsChampion != null || (spell.controlDurationVsChampion ?? 0) > 0
}

function spellLacksResource(spell: ResolvedSpellView): boolean {
  const cost = Math.max(0, Number(spell.resourceCost ?? 0))
  return (
    cost > 0 && simulatedResource.value != null && simulatedResource.value.current + 1e-6 < cost
  )
}

function useSpellDamage(spell: ResolvedSpellView) {
  if (!spellIsUsable(spell)) return
  const label = `${displaySpellSlot(spell.slot)} ${spell.name}`
  if (spell.sustainedFire?.toggle && sustainedFireState[spell.id]) {
    delete sustainedFireState[spell.id]
    recordTimelineEvent(t('theorycraft.practice.log.toggleOff', { label }))
    return
  }
  const actionLock = actionLockRemaining()
  if (actionLock > 0.001) {
    recordTimelineEvent(
      t('theorycraft.practice.log.locked', { label, seconds: formatDamageValue(actionLock) })
    )
    return
  }
  const remaining = spellRemainingCooldown(spell.id)
  if (remaining > 0.001) {
    recordTimelineEvent(
      t('theorycraft.practice.log.cooldown', { label, seconds: formatDamageValue(remaining) })
    )
    return
  }
  const cost = Math.max(0, Number(spell.resourceCost ?? 0))
  if (spellLacksResource(spell)) {
    recordTimelineEvent(
      t('theorycraft.practice.log.noResource', { label, cost: formatDamageValue(cost) })
    )
    return
  }
  if (cost > 0 && simulatedResource.value) {
    simulatedResource.value.current = Math.max(0, simulatedResource.value.current - cost)
  }
  const hitDelay = Math.max(0, Number(spell.hitDelaySeconds ?? 0))
  if (spell.sustainedFire) {
    const now = timelineNowSeconds.value
    sustainedFireState[spell.id] = { until: now + spell.sustainedFire.duration, nextShotAt: now }
    recordTimelineEvent(t('theorycraft.practice.log.toggleOn', { label }))
  } else {
    queueHitEvent({
      at: timelineNowSeconds.value + hitDelay,
      label,
      split: spell.damageVsSplit ?? emptySplit(),
      hardCc: Math.max(0, Number(spell.hardControlDurationVsChampion ?? 0)),
      slowCc: Math.max(0, Number(spell.slowDurationVsChampion ?? 0)),
      profile: spell.damageProfile,
      ability: true,
      executeBelow: spell.executeBelow,
    })
  }
  healed.value += Math.max(0, Number(spell.heal ?? 0))
  shielded.value += Math.max(0, Number(spell.shield ?? 0))
  if (sumSplit(spellbladeDamage(attackerItemIds.value, itemAttacker())) > 0) {
    spellbladeReady.value = true
  }
  const cooldown = Math.max(0, Number(spell.cooldownSeconds ?? 0))
  if (cooldown > 0) {
    spellReadyAt[spell.id] = timelineNowSeconds.value + cooldown
  }
  applyActionRecovery(0.25, 0.1)
  advanceTimeline(0.25)
}

function usePassiveDamage(passiveView: ResolvedPassiveView) {
  const label = `P ${passiveView.name}`
  const remaining = passiveRemainingCooldown()
  if (remaining > 0.001) {
    recordTimelineEvent(
      t('theorycraft.practice.log.cooldown', { label, seconds: formatDamageValue(remaining) })
    )
    return
  }
  passiveReadyAt.value =
    timelineNowSeconds.value + Math.max(0, Number(passiveView.cooldownSeconds ?? 0))
  healed.value += Math.max(0, Number(passiveView.heal ?? 0))
  shielded.value += Math.max(0, Number(passiveView.shield ?? 0))
  if (passiveView.damageVsSplit) {
    applyDamageToSimulation(
      resolveEventSplit({ split: passiveView.damageVsSplit, profile: passiveView.damageProfile }),
      label
    )
  }
  const hardCc = Number(passiveView.hardControlDurationVsChampion ?? 0)
  const slowCc = Number(passiveView.slowDurationVsChampion ?? 0)
  if (hardCc > 0) addControlWindow('hard', hardCc)
  if (slowCc > 0) addControlWindow('slow', slowCc)
  if (hardCc > 0 || slowCc > 0) {
    recordTimelineEvent(
      t('theorycraft.practice.log.cc', {
        label,
        hard: formatDamageValue(hardCc),
        slow: formatDamageValue(slowCc),
      })
    )
  }
  advanceTimeline()
}

const attackerSummonerIds = computed((): string[] =>
  ((buildStore.displayedBuild ?? buildStore.currentBuild)?.summonerSpells ?? []).map(spell =>
    String(spell?.id ?? '')
  )
)

const SUMMONER_KINDS: Record<string, ExtraActionKind> = {
  SummonerDot: 'ignite',
  SummonerBarrier: 'barrier',
  SummonerHeal: 'heal',
}

function sideExtraActions(
  side: 'self' | 'target',
  summonerIds: string[],
  itemIds: string[]
): ExtraAction[] {
  const actions: ExtraAction[] = []
  for (const id of summonerIds) {
    const kind = SUMMONER_KINDS[id]
    if (!kind || (side === 'target' && kind === 'ignite')) continue
    actions.push({
      key: `${side}:${id}`,
      side,
      kind,
      label: t(`theorycraft.practice.extras.${kind}`),
      cooldown: summonerCooldown(id) ?? 0,
    })
  }
  for (const itemId of new Set(itemIds)) {
    const potion = consumableHeal(itemId)
    if (!potion) continue
    actions.push({
      key: `${side}:${itemId}`,
      side,
      kind: 'potion',
      label: t('theorycraft.practice.extras.potion'),
      cooldown: potion.duration,
      itemId,
    })
  }
  return actions
}

/** Summoner spells and potions of the attacker (self) and of the opponent (target). */
const extraActions = computed((): ExtraAction[] => [
  ...sideExtraActions('self', attackerSummonerIds.value, attackerItemIds.value),
  ...(hasOpponent.value
    ? sideExtraActions('target', props.opponentSummonerIds ?? [], props.opponentItemIds ?? [])
    : []),
])

function extraRemainingCooldown(action: ExtraAction): number {
  return Math.max(0, Number(spellReadyAt[action.key] ?? 0) - timelineNowSeconds.value)
}

function useExtraAction(action: ExtraAction) {
  const label =
    action.side === 'target'
      ? `${action.label} (${t('theorycraft.practice.extras.opponent')})`
      : action.label
  const remaining = extraRemainingCooldown(action)
  if (remaining > 0.001) {
    recordTimelineEvent(
      t('theorycraft.practice.log.cooldown', { label, seconds: formatDamageValue(remaining) })
    )
    return
  }
  if (!ensureSimulationState()) return
  const now = timelineNowSeconds.value
  spellReadyAt[action.key] = now + action.cooldown
  const level = attackerLevelForMitigation()
  if (action.kind === 'ignite') {
    const tick = igniteTotalDamage(level) / 5
    targetGrievousUntil.value = Math.max(targetGrievousUntil.value, now + 5)
    for (let second = 1; second <= 5; second += 1) {
      queueHitEvent({
        at: now + second,
        label,
        split: { ...emptySplit(), true: tick },
        hardCc: 0,
        slowCc: 0,
        periodic: true,
      })
    }
  } else if (action.kind === 'barrier') {
    const amount = summonerBarrierShield(level)
    if (action.side === 'self') {
      shielded.value += amount
      recordTimelineEvent(
        t('theorycraft.practice.log.selfShield', { label, amount: formatDamageValue(amount) })
      )
    } else {
      const target = simulatedTarget.value!
      target.shield += amount
      targetTempShields.value = [...targetTempShields.value, { amount, until: now + 2.5 }]
      recordTimelineEvent(
        t('theorycraft.practice.log.targetShield', { label, amount: formatDamageValue(amount) })
      )
    }
  } else if (action.kind === 'heal') {
    const amount = summonerHealAmount(level)
    if (action.side === 'self') {
      healed.value += amount
      recordTimelineEvent(
        t('theorycraft.practice.log.selfHeal', { label, amount: formatDamageValue(amount) })
      )
    } else {
      healTargetNow(amount, label)
    }
  } else {
    const potion = consumableHeal(action.itemId ?? '')
    if (!potion) return
    if (action.side === 'self') {
      healed.value += potion.total
      recordTimelineEvent(
        t('theorycraft.practice.log.selfHeal', { label, amount: formatDamageValue(potion.total) })
      )
    } else {
      const perTick = potion.total / potion.duration
      for (let second = 1; second <= potion.duration; second += 1) {
        queueHitEvent({
          at: now + second,
          label,
          split: emptySplit(),
          hardCc: 0,
          slowCc: 0,
          heal: perTick,
        })
      }
    }
  }
}

const autoAttackRawDamage = computed(() => {
  const attacker = props.buildStats
  if (!attacker) return null
  return autoAttackRaw(attacker.totalAD, attacker.critChance, attacker.critDamage)
})

/** Attack damage with on-hit items (and Spellblade when charged), mitigated. */
function attackSplit(raw: number, withSpellblade = false): DamageSplit {
  return mitigateRaw(rawAttackSplit(raw, withSpellblade))
}

/** Attack damage with on-hit items, before the target's armor and magic resist. */
function rawAttackSplit(raw: number, withSpellblade = false): DamageSplit {
  const hp = currentTargetHp()
  let rawSplit = addSplit(
    { ...emptySplit(), physical: raw },
    onHitItemDamage(attackerItemIds.value, itemAttacker(), hp)
  )
  if (withSpellblade) {
    rawSplit = addSplit(rawSplit, spellbladeDamage(attackerItemIds.value, itemAttacker()))
  }
  return amplifyItemDamage(attackerItemIds.value, rawSplit, hp)
}

/** Average auto attack (crit chance included), used for previews and the damage table. */
const autoAttackSplit = computed((): DamageSplit | null =>
  autoAttackRawDamage.value ? attackSplit(autoAttackRawDamage.value.expected) : null
)

function estimatedAutoAttackDamage(): number | null {
  return autoAttackSplit.value ? sumSplit(autoAttackSplit.value) : null
}

function useAutoAttack() {
  const label = t('theorycraft.practice.autoAttack')
  const actionLock = actionLockRemaining()
  if (actionLock > 0.001) {
    recordTimelineEvent(
      t('theorycraft.practice.log.locked', { label, seconds: formatDamageValue(actionLock) })
    )
    return
  }
  const remaining = autoRemainingCooldown()
  if (remaining > 0.001) {
    recordTimelineEvent(
      t('theorycraft.practice.log.cooldown', { label, seconds: formatDamageValue(remaining) })
    )
    return
  }
  const rawDamage = autoAttackRawDamage.value
  if (!rawDamage) return
  const crit = rollCrit(props.buildStats?.critChance ?? 0)
  const split = attackSplit(crit ? rawDamage.crit : rawDamage.normal, spellbladeReady.value)
  spellbladeReady.value = false
  queueHitEvent({
    at: timelineNowSeconds.value + 0.1,
    label,
    split,
    hardCc: 0,
    slowCc: 0,
    crit,
    isAttack: true,
  })
  if (passiveTrigger.value?.attacks) procPassive(timelineNowSeconds.value + 0.1)
  autoReadyAt.value = timelineNowSeconds.value + autoAttackIntervalSeconds()
  applyActionRecovery(0.15, 0.1)
  advanceTimeline(0.15)
}

const effectiveTargetHp = computed(() => {
  const state = simulatedTarget.value
  if (!state) return 0
  return Math.max(0, state.hp + state.shield)
})

const activeHardCcRemaining = computed(() => {
  const now = timelineNowSeconds.value
  const active = hardControlWindows.value.find(window => now >= window.start && now < window.end)
  return active ? active.end - now : 0
})

const activeSlowRemaining = computed(() => {
  const now = timelineNowSeconds.value
  const active = slowControlWindows.value.find(window => now >= window.start && now < window.end)
  return active ? active.end - now : 0
})

watch([hardControlWindows, slowControlWindows], () => {
  simulatedControl.value = {
    hardCcSeconds: totalWindowDuration(hardControlWindows.value),
    slowSeconds: totalWindowDuration(slowControlWindows.value),
  }
})

const totalDealt = computed(() => sumSplit(dealtSplit.value))

const dealtShares = computed(() => splitShares(dealtSplit.value))

const combatSeconds = computed(() => {
  if (firstHitAt.value == null || lastHitAt.value == null) return 0
  return Math.max(0, lastHitAt.value - firstHitAt.value)
})

const combatDps = computed(() => dpsOf(totalDealt.value, combatSeconds.value))

const dummyBar = computed(() => {
  const state = simulatedTarget.value
  if (!state) return null
  return buildDummyBar({
    maxHp: targetMaxHp(),
    maxShield: targetInitialShield(),
    hp: state.hp,
    shield: state.shield,
    dealt: dealtSplit.value,
  })
})

const targetDead = computed(() => simulatedTarget.value != null && effectiveTargetHp.value <= 0)

function castsToKill(targetHp: number, perCastDamage: number | null | undefined): number | null {
  const damage = Number(perCastDamage ?? 0)
  if (!Number.isFinite(targetHp) || targetHp <= 0) return 0
  if (!Number.isFinite(damage) || damage <= 0) return null
  return Math.max(1, Math.ceil(targetHp / damage))
}

function enqueueAutoAttack() {
  actionQueue.value.push({ type: 'aa', label: displayAutoKey() })
}

function enqueueSpell(spell: ResolvedSpellView) {
  if (!spellIsUsable(spell)) return
  actionQueue.value.push({
    type: 'spell',
    spellId: spell.id,
    label: displaySpellSlot(spell.slot),
  })
}

function removeQueuedAction(index: number) {
  actionQueue.value.splice(index, 1)
}

function clearQueue() {
  actionQueue.value = []
}

function runQueuedActions() {
  let guard = 0
  while (actionQueue.value.length > 0 && guard < 200) {
    guard += 1
    const action = actionQueue.value[0]!
    const lock = actionLockRemaining()
    const aaCd = action.type === 'aa' ? autoRemainingCooldown() : 0
    const spellCd =
      action.type === 'spell' ? spellRemainingCooldown(String(action.spellId ?? '')) : 0
    const wait = Math.max(lock, aaCd, spellCd)
    if (wait > 0.001) {
      advanceTimeline(wait)
    }
    if (action.type === 'aa') {
      useAutoAttack()
      actionQueue.value.shift()
      continue
    }
    const spell = spells.value.find(entry => entry.id === action.spellId)
    if (spell) useSpellDamage(spell)
    actionQueue.value.shift()
  }
  flushPendingHits()
}

/** Fait avancer le temps jusqu'au dernier impact en vol (sorts à délai). */
function flushPendingHits() {
  const last = pendingHitEvents.value[pendingHitEvents.value.length - 1]
  if (!last) return
  advanceTimeline(Math.max(0.001, last.at - timelineNowSeconds.value))
}

function runQueueFromStart() {
  const queued = [...actionQueue.value]
  resetSimulation()
  actionQueue.value = queued
  runQueuedActions()
  actionQueue.value = queued
}

function displayAutoKey(): string {
  return t('theorycraft.practice.autoShort')
}

function onPracticeKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const tag = (event.target as HTMLElement | null)?.tagName ?? ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  const key = event.key.toUpperCase()
  const queue = event.shiftKey
  if (key === ' ' || key === 'SPACEBAR') {
    event.preventDefault()
    if (queue) enqueueAutoAttack()
    else useAutoAttack()
    return
  }
  if (key === 'BACKSPACE') {
    event.preventDefault()
    resetSimulation()
    return
  }
  if (key === 'ENTER') {
    event.preventDefault()
    runQueueFromStart()
    return
  }
  if (key === 'P' && passive.value) {
    event.preventDefault()
    usePassiveDamage(passive.value)
    return
  }
  const spell = spells.value.find(entry => displaySpellSlot(entry.slot) === key)
  if (!spell) return
  event.preventDefault()
  if (queue) enqueueSpell(spell)
  else useSpellDamage(spell)
}

function splitBarSegments(
  split: DamageSplit | null | undefined
): { type: DamageType; width: string }[] {
  const shares = splitShares(split ?? emptySplit())
  return DAMAGE_TYPES.filter(type => shares[type] > 0).map(type => ({
    type,
    width: `${shares[type]}%`,
  }))
}

function splitParts(split: DamageSplit | null | undefined): { type: DamageType; value: number }[] {
  if (!split) return []
  return DAMAGE_TYPES.filter(type => split[type] >= 0.5).map(type => ({
    type,
    value: split[type],
  }))
}

function resolveSpellCooldownSeconds(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number,
  withReduction: boolean
): number {
  const header = headerCooldownAtRank(
    raw.headerStats as Array<{ key?: unknown; valueText?: unknown }>,
    rank
  )
  const base = header ?? baseSpellCooldownSeconds(raw, rank)
  if (!withReduction) return base
  return cooldownAfterReduction(base, Number(props.buildStats?.cooldownReduction ?? 0))
}

function baseSpellCooldownSeconds(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): number {
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const cdEntry = (raw.dataValues ?? []).find(entry =>
    /cooldown|cd|recasttime|chargetime/i.test(String(entry.name ?? ''))
  )
  if (cdEntry) {
    const value = Number(cdEntry.values?.[rankIndex] ?? cdEntry.values?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  const cdCalc = (raw.calculations ?? []).find(calc => /cooldown|cd/i.test(String(calc.key ?? '')))
  if (cdCalc) {
    const value = Number(cdCalc.baseValues?.[rankIndex] ?? cdCalc.baseValues?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  return 0
}

function resolveSpellResourceCost(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): number {
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const costEntry = (raw.dataValues ?? []).find(entry =>
    /cost|manacost|energycost|resourcecost/i.test(String(entry.name ?? ''))
  )
  if (costEntry) {
    const value = Number(costEntry.values?.[rankIndex] ?? costEntry.values?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  const costCalc = (raw.calculations ?? []).find(calc => /cost|manacost|energycost/i.test(calc.key))
  if (costCalc) {
    const value = Number(costCalc.baseValues?.[rankIndex] ?? costCalc.baseValues?.[0] ?? 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  return headerCostAtRank(raw.headerStats as Array<{ key?: unknown; valueText?: unknown }>, rank)
}

function resolveSpellHitDelaySeconds(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): number {
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const delayEntry = (raw.dataValues ?? []).find(entry =>
    /delay|casttime|traveltime|missile|impacttime/i.test(String(entry.name ?? ''))
  )
  if (delayEntry) {
    const value = Number(delayEntry.values?.[rankIndex] ?? delayEntry.values?.[0] ?? 0)
    if (Number.isFinite(value) && value >= 0 && value <= 3) return value
  }
  const slot = String(raw.slot ?? '')
    .trim()
    .toUpperCase()
  if (slot === 'R') return 0.2
  return 0.1
}

function isDamageCalculationKey(key: string): boolean {
  const normalized = key.toLowerCase()
  if (/shield|heal|mana|cost|cooldown|cdr|speed|slow|buff|bonus|resist|armor|mr/.test(normalized)) {
    return false
  }
  return /damage|dmg|execute|detonate|impact|blast|burn|bleed|onhit|proc/.test(normalized)
}

function normalizeDamageType(value: unknown): DamageType | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === 'physical' || normalized === 'magic' || normalized === 'true')
    return normalized
  return null
}

function inferFormulaBaseDamageType(
  formula: TheorycraftSpellCalculation,
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>
): DamageType {
  const ratioTypes = (formula.ratios ?? [])
    .map((ratio: { type?: unknown }) => normalizeDamageType(ratio.type))
    .filter((ratioType): ratioType is DamageType => Boolean(ratioType))
  if (
    ratioTypes.length > 0 &&
    ratioTypes.every((ratioType: DamageType) => ratioType === ratioTypes[0])
  ) {
    return ratioTypes[0]!
  }

  const haystack = `${String(formula.key ?? '')} ${String(raw.tooltipRaw ?? '')}`.toLowerCase()
  if (/truedamage|true damage|dégâts bruts|degats bruts/.test(haystack)) return 'true'
  if (/magicdamage|magic damage|dégâts magiques|degats magiques/.test(haystack)) return 'magic'
  return 'physical'
}

function attackerLevelForMitigation(): number {
  return Math.min(Math.max(Number(props.buildStats?.level ?? props.level ?? 1), 1), 18)
}

function formatDamageValue(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (!Number.isFinite(rounded)) return '0'
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function ratioCoefficientAtRank(coefficient: number[] | number, rankIndex: number): number {
  if (Array.isArray(coefficient)) {
    if (coefficient.length === 0) return 0
    const value = coefficient[Math.min(Math.max(rankIndex, 0), coefficient.length - 1)]
    return Number.isFinite(value ?? NaN) ? Number(value) : 0
  }
  return Number.isFinite(coefficient) ? coefficient : 0
}

function ratioStatValueForVsDamage(
  stat: string,
  attacker: TheorycraftBuildStats,
  defender: TheorycraftBuildStats
): number {
  const normalized = String(stat ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const fromAttacker: Record<string, number> = {
    totalad: attacker.totalAD,
    bonusad: attacker.bonusAD,
    attackdamage: attacker.totalAD,
    ap: attacker.AP,
    abilitypower: attacker.AP,
    totalhp: attacker.totalHP,
    bonushp: attacker.bonusHP,
    bonushealth: attacker.bonusHP,
    armor: attacker.armor,
    magicresist: attacker.magicResist,
    maxmana: attacker.maxMana,
    mana: attacker.maxMana,
    lethality: Number(attackerRaw.value?.lethality ?? 0),
  }

  const fromDefender: Record<string, number> = {
    targetmaxhealth: defender.totalHP,
    targethealth: defender.totalHP,
    enemytotalhp: defender.totalHP,
    enemymxhp: defender.totalHP,
    maxhealth: defender.totalHP,
    maxhp: defender.totalHP,
  }

  if (normalized in fromDefender) return Number(fromDefender[normalized] ?? 0)
  if (normalized in fromAttacker) return Number(fromAttacker[normalized] ?? 0)
  return 0
}

function spellStatValue(stat: string): number {
  return props.buildStats ? ratioStatValueForVsDamage(stat, props.buildStats, targetStats.value) : 0
}

/** Items of the attacking build, minus the ones disabled in theorycraft. */
const attackerItemIds = computed((): string[] => {
  const build = buildStore.displayedBuild ?? buildStore.currentBuild
  const disabled = new Set(buildStore.theorycraftDisabledItemIndices)
  return (build?.items ?? [])
    .filter((_, index) => !disabled.has(index))
    .map(item => String(item?.id ?? ''))
})

function itemAttacker(): ItemAttacker {
  const stats = props.buildStats
  const raw = attackerRaw.value
  const totalAD = Number(stats?.totalAD ?? 0)
  const bonusAD = Number(stats?.bonusAD ?? 0)
  return {
    level: attackerLevelForMitigation(),
    baseAD: Math.max(0, totalAD - bonusAD),
    bonusAD,
    AP: Number(stats?.AP ?? 0),
    maxHp: Number(stats?.totalHP ?? 0),
    ranged: Number(raw?.attackRange ?? 0) >= 300,
  }
}

function currentTargetHp(): ItemTarget {
  const maxHp = targetMaxHp()
  return { maxHp, currentHp: simulatedTarget.value?.hp ?? maxHp }
}

function mitigateRaw(rawSplit: DamageSplit): DamageSplit {
  return mitigateSplit(rawSplit, targetRaw.value, attackerRaw.value, attackerLevelForMitigation())
}

/** Mitigated damage of a hit; health-dependent parts use the target's health right now. */
function resolveEventSplit(
  event: Pick<PendingHitEvent, 'split' | 'profile' | 'ability' | 'onHitRatio'>
): DamageSplit {
  const rawSplit = rawEventSplit(event)
  return rawSplit ? mitigateRaw(rawSplit) : event.split
}

/** Damage of a hit before armor and magic resist, null without a damage profile. */
function rawEventSplit(
  event: Pick<PendingHitEvent, 'profile' | 'ability' | 'onHitRatio'>
): DamageSplit | null {
  if (!event.profile) return null
  const hp = currentTargetHp()
  let rawSplit = evaluateDamageProfile(event.profile, hp)
  if (event.ability) rawSplit = addSplit(rawSplit, abilityItemDamage(attackerItemIds.value, hp))
  if (event.onHitRatio) {
    const onHit = onHitItemDamage(attackerItemIds.value, itemAttacker(), hp)
    rawSplit = addSplit(rawSplit, scaleSplit(onHit, event.onHitRatio))
  }
  return amplifyItemDamage(attackerItemIds.value, rawSplit, hp)
}

/** Button title: raw damage → damage received after armor / magic resist. */
function damageTitle(
  name: string,
  received: number | null | undefined,
  rawSplit: DamageSplit | null
): string {
  if (received == null || !rawSplit) return name
  return t('theorycraft.practice.rawToReceived', {
    name,
    raw: Math.round(sumSplit(rawSplit)),
    received: Math.round(received),
  })
}

function computeDamageVsChampion(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): {
  damage: number
  split: DamageSplit
  lethal: boolean
  tooltip: string
  profile: DamageProfile | null
} | null {
  const attacker = props.buildStats
  const defender = targetStats.value
  const defenderRaw = targetRaw.value
  if (!attacker || !defender || !defenderRaw) return null
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))

  let parts = parseTooltipDamageParts(String(raw.tooltipRaw ?? ''))
  if (parts.length === 0 && Array.isArray(raw.tooltipDetailRaws)) {
    parts = parseTooltipDamageParts(raw.tooltipDetailRaws.map(String).join(' '))
  }
  if (parts.length > 0) {
    const profile = resolveDamageProfile(
      raw as SpellDamageSource,
      parts,
      Math.min(Math.max(rank, 1), maxRank) - 1,
      spellStatValue
    )
    if (profileHasDamage(profile)) {
      const split = resolveEventSplit({ split: emptySplit(), profile, ability: Boolean(raw.slot) })
      const damage = sumSplit(split)
      const lines = splitParts(split).map(
        part => `${t(`theorycraft.practice.types.${part.type}`)}: ${formatDamageValue(part.value)}`
      )
      return {
        damage,
        split,
        lethal: effectiveTargetHp.value > 0 && damage >= effectiveTargetHp.value,
        tooltip: lines.join('\n'),
        profile,
      }
    }
  }

  const formulas = (raw.calculations ?? []).filter(entry =>
    isDamageCalculationKey(String(entry.key ?? ''))
  )
  if (formulas.length === 0) return null

  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const breakdownLines: string[] = []
  let totalSplit = emptySplit()
  const totalMitigated = formulas.reduce((sum, formula) => {
    const base = Math.max(0, Number(formula.baseValues?.[rankIndex] ?? 0))
    const baseType = inferFormulaBaseDamageType(formula, raw)
    const components: Record<DamageType, number> = {
      physical: baseType === 'physical' ? base : 0,
      magic: baseType === 'magic' ? base : 0,
      true: baseType === 'true' ? base : 0,
    }

    for (const ratio of formula.ratios ?? []) {
      const coeff = ratioCoefficientAtRank(ratio.coefficient, rankIndex)
      const statValue = ratioStatValueForVsDamage(String(ratio.stat ?? ''), attacker, defender)
      const ratioType = normalizeDamageType((ratio as { type?: unknown }).type) ?? baseType
      components[ratioType] += Math.max(0, coeff * statValue)
    }

    const mitigatedSplit = mitigateSplit(
      components,
      defenderRaw,
      attackerRaw.value,
      attackerLevelForMitigation()
    )
    totalSplit = addSplit(totalSplit, mitigatedSplit)
    const physicalMitigated = mitigatedSplit.physical
    const magicMitigated = mitigatedSplit.magic
    const trueMitigated = mitigatedSplit.true
    const exact = components.physical + components.magic + components.true
    const mitigated = physicalMitigated + magicMitigated + trueMitigated
    const ratioPart = exact - base
    breakdownLines.push(
      `${formula.key}: ${formatDamageValue(base)} + ${formatDamageValue(ratioPart)} = ${formatDamageValue(exact)} brut -> ${formatDamageValue(mitigated)} mitigé (P:${formatDamageValue(physicalMitigated)} M:${formatDamageValue(magicMitigated)} T:${formatDamageValue(trueMitigated)})`
    )
    return sum + mitigated
  }, 0)

  const targetShield = Number(defenderRaw.shield ?? 0)
  const targetHp = Number(defender.totalHP ?? 0)
  const currentEffectiveTargetHp = Math.max(
    0,
    effectiveTargetHp.value || targetHp + Math.max(0, targetShield)
  )
  const lethal = currentEffectiveTargetHp > 0 && totalMitigated >= currentEffectiveTargetHp
  breakdownLines.push(
    `Total: ${formatDamageValue(totalMitigated)} | Cible: ${formatDamageValue(targetHp)} PV + ${formatDamageValue(Math.max(0, targetShield))} bouclier`
  )
  return {
    damage: totalMitigated,
    split: totalSplit,
    lethal,
    tooltip: breakdownLines.join('\n'),
    profile: null,
  }
}

type ControlKind = 'hard' | 'airborne' | 'slow'

function detectControlKind(name: string): ControlKind | null {
  const normalized = name.toLowerCase()
  if (/airborne|knockup|knockback|pull|launch/.test(normalized)) return 'airborne'
  if (/slow/.test(normalized)) return 'slow'
  if (
    /stun|snare|root|taunt|fear|charm|sleep|silence|suppress|suppression|stasis|cc/.test(normalized)
  ) {
    return 'hard'
  }
  return null
}

function computeControlVsChampion(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number
): { duration: number; hardDuration: number; slowDuration: number; tooltip: string } | null {
  const defender = targetStats.value
  if (!defender) return null
  const defenderRaw = targetRaw.value
  const maxRank = Math.max(1, Number(raw.maxRank ?? 5))
  const rankIndex = Math.min(Math.max(rank, 1), maxRank) - 1
  const tenacity = Math.min(Math.max(Number(defenderRaw?.tenacity ?? 0), 0), 0.95)
  const entries: Array<{ label: string; duration: number; kind: ControlKind }> = []

  for (const entry of raw.dataValues ?? []) {
    const name = String(entry.name ?? '')
    const kind = detectControlKind(name)
    if (!kind) continue
    const lowered = name.toLowerCase()
    if (!/duration|time|seconds|sec|slow/.test(lowered)) continue
    const value = Number(entry.values?.[rankIndex] ?? entry.values?.[0] ?? 0)
    if (!Number.isFinite(value) || value <= 0) continue
    entries.push({
      label: name,
      duration: kind === 'airborne' ? value : value * (1 - tenacity),
      kind,
    })
  }

  for (const calculation of raw.calculations ?? []) {
    const kind = detectControlKind(calculation.key)
    if (!kind) continue
    const lowered = calculation.key.toLowerCase()
    if (!/duration|time|seconds|sec|slow/.test(lowered)) continue
    const value = Number(calculation.baseValues?.[rankIndex] ?? calculation.baseValues?.[0] ?? 0)
    if (!Number.isFinite(value) || value <= 0) continue
    entries.push({
      label: calculation.key,
      duration: kind === 'airborne' ? value : value * (1 - tenacity),
      kind,
    })
  }

  if (entries.length === 0) return null
  const { duration: total, hardDuration, slowDuration } = combineControlDurations(entries)
  const lines = entries.map(
    entry => `${entry.label}: ${formatDamageValue(entry.duration)}s (${entry.kind})`
  )
  return { duration: total, hardDuration, slowDuration, tooltip: lines.join('\n') }
}

function annotateExecuteThresholdWithHp(
  html: string,
  targetMaxHp: number | null | undefined
): string {
  if (!html) return html
  if (!Number.isFinite(targetMaxHp) || (targetMaxHp ?? 0) <= 0) return html
  return html.replace(
    /(\d+(?:[.,]\d+)?)%\s*(de ses PV|de sa vie|max health|maximum health)(?!\s*\()/gi,
    (_match, percentRaw: string, suffix: string) => {
      const pct = Number(String(percentRaw).replace(',', '.'))
      if (!Number.isFinite(pct)) return `${percentRaw}% ${suffix}`
      const hpValue = Math.round((targetMaxHp! * pct) / 100)
      return `${percentRaw}% (${hpValue} PV) ${suffix}`
    }
  )
}

function resolveSpellView(
  raw: TheorycraftSpellRuntimeData & Record<string, unknown>,
  rank: number,
  stackContext?: TheorycraftStackResolveContext | null
): Omit<ResolvedSpellView, 'id' | 'slot'> {
  const fallbackHtml = normalizeKaynFormMarkup(
    String(
      raw.descriptionHtml ?? raw.descriptionParsed ?? raw.descriptionText ?? raw.parsedText ?? ''
    )
  )

  const resolved = resolveTheorycraftSpellDescription(
    raw,
    props.buildStats,
    rank,
    fallbackHtml,
    stackContext
  )

  const resolvedDetails = resolveTheorycraftSpellDetailRaws(
    raw,
    props.buildStats,
    rank,
    stackContext
  )
  const staticDetails = Array.isArray(raw.detailedTexts)
    ? raw.detailedTexts.map(section => normalizeKaynFormMarkup(String(section ?? '')))
    : []

  const detailCandidates =
    resolvedDetails.length > 0
      ? resolvedDetails.map(section => normalizeKaynFormMarkup(section))
      : staticDetails

  const finalized = finalizeTooltipDisplay({
    summaryHtml: raw.summaryHtml ? String(raw.summaryHtml) : undefined,
    descriptionHtml: normalizeKaynFormMarkup(resolved.html),
    detailedTexts: detailCandidates,
  })
  const damageVs = computeDamageVsChampion(raw, rank)
  const controlVs = computeControlVsChampion(raw, rank)
  const targetMaxHp = Number(targetStats.value.totalHP ?? NaN)
  const rankIndex = Math.min(Math.max(rank, 1), Math.max(1, Number(raw.maxRank ?? 5))) - 1
  const executeBelow = raw.slot
    ? resolveExecuteThreshold(
        String(loadedChampion.value?.id ?? props.championId ?? ''),
        String(raw.slot),
        raw as SpellDamageSource,
        rankIndex,
        spellStatValue,
        targetMaxHp
      )
    : null
  const sustain = resolveSpellSustain(raw as SpellDamageSource, rankIndex, spellStatValue)
  const executesNow =
    executeBelow != null &&
    effectiveTargetHp.value > 0 &&
    effectiveTargetHp.value - (damageVs?.damage ?? 0) <= executeBelow
  const summaryHtml = finalized.summaryHtml
    ? annotateExecuteThresholdWithHp(finalized.summaryHtml, targetMaxHp)
    : undefined
  const descriptionHtml = annotateExecuteThresholdWithHp(finalized.descriptionHtml, targetMaxHp)
  const detailedTexts = (finalized.detailedTexts ?? []).map(section =>
    annotateExecuteThresholdWithHp(section, targetMaxHp)
  )

  return {
    name: String(raw.name ?? ''),
    maxRank: Math.max(1, Number(raw.maxRank ?? 5)),
    summaryHtml,
    showSummary: finalized.showSummary,
    descriptionHtml,
    detailedTexts,
    headerStats: Array.isArray(raw.headerStats)
      ? raw.headerStats.map((stat: SpellHeaderStat) =>
          resolveHeaderStatAtRank(stat, rank, {
            cooldownReduction: props.buildStats?.cooldownReduction ?? 0,
          })
        )
      : [],
    isDynamic: resolved.isDynamic,
    hasActivatableBuff: spellHasActivatableBuff(raw),
    damageVsChampion: damageVs?.damage ?? null,
    damageVsSplit: damageVs?.split ?? null,
    lethalVsChampion: (damageVs?.lethal ?? false) || executesNow,
    damageVsTooltip: damageVs?.tooltip ?? '',
    damageProfile: damageVs?.profile ?? null,
    executeBelow,
    heal: sustain.heal,
    shield: sustain.shield,
    controlDurationVsChampion: controlVs?.duration ?? null,
    hardControlDurationVsChampion: controlVs?.hardDuration ?? null,
    slowDurationVsChampion: controlVs?.slowDuration ?? null,
    controlVsTooltip: controlVs?.tooltip ?? '',
    // The passive (no slot) ignores ability haste.
    cooldownSeconds: resolveSpellCooldownSeconds(raw, rank, Boolean(raw.slot)),
    resourceCost: resolveSpellResourceCost(raw, rank),
    hitDelaySeconds: resolveSpellHitDelaySeconds(raw, rank),
  }
}

async function ensureChampionLoaded() {
  if (props.championData) {
    loadedChampion.value = props.championData
    return
  }
  if (!props.championId) {
    loadedChampion.value = null
    return
  }
  loading.value = true
  error.value = null
  try {
    loadedChampion.value = await loadChampion(props.championId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    loadedChampion.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.championId, props.championData] as const,
  () => {
    ensureChampionLoaded().catch(() => undefined)
  },
  { immediate: true }
)

watch(
  () => [targetStats.value.totalHP, targetRaw.value.shield, props.championId] as const,
  () => {
    resetSimulation()
  },
  { immediate: true }
)

const passive = computed((): ResolvedPassiveView | null => {
  const champion = loadedChampion.value
  const passiveRaw = champion?.passive
  if (!passiveRaw || typeof passiveRaw !== 'object') return null

  const passiveData = passiveRaw as TheorycraftSpellRuntimeData & Record<string, unknown>
  const rank = passiveRankForChampionLevel(props.level)
  const resolved = resolveSpellView(passiveData, rank, buildStackContext({ scope: 'passive' }))

  return {
    name: resolved.name,
    imageUrl: resolvePassiveImageUrl(passiveData),
    summaryHtml: resolved.summaryHtml,
    showSummary: resolved.showSummary,
    descriptionHtml: resolved.descriptionHtml,
    detailedTexts: resolved.detailedTexts,
    isDynamic: resolved.isDynamic,
    damageVsChampion: resolved.damageVsChampion,
    damageVsSplit: resolved.damageVsSplit,
    lethalVsChampion: resolved.lethalVsChampion,
    damageVsTooltip: resolved.damageVsTooltip,
    damageProfile: resolved.damageProfile,
    controlDurationVsChampion: resolved.controlDurationVsChampion,
    hardControlDurationVsChampion: resolved.hardControlDurationVsChampion,
    slowDurationVsChampion: resolved.slowDurationVsChampion,
    controlVsTooltip: resolved.controlVsTooltip,
    cooldownSeconds: resolved.cooldownSeconds,
    heal: resolved.heal,
    shield: resolved.shield,
  }
})

const spells = computed<ResolvedSpellView[]>(() => {
  const champion = loadedChampion.value
  const list = Array.isArray(champion?.spells) ? champion.spells : []

  return list.map(raw => {
    const spell = raw as TheorycraftSpellRuntimeData & Record<string, unknown>
    const id = String(spell.id ?? '')
    const maxRank = Math.max(1, Number(spell.maxRank ?? 5))
    const storeRank = buildStore.theorycraftSpellRanks[id]
    if (storeRank != null && rankBySpellId[id] !== storeRank) {
      rankBySpellId[id] = storeRank
    }
    const rank = Math.min(Math.max(rankBySpellId[id] ?? storeRank ?? 1, 1), maxRank)
    const resolved = resolveSpellView(
      spell,
      rank,
      buildStackContext({ scope: 'spell', id, slot: String(spell.slot ?? '') })
    )

    return {
      id,
      slot: String(spell.slot ?? ''),
      imageUrl: resolveAbilityImageUrl(spell),
      ...resolved,
      sustainedFire: resolveSustainedFire(spell as SpellDamageSource, rank - 1),
    }
  })
})

interface KillRow {
  key: string
  spell?: ResolvedSpellView
  slot: string
  name: string
  imageUrl?: string
  damage: number
  split: DamageSplit | null
  hits: number | null
}

/** Coups nécessaires pour tuer la cible actuelle, source par source. */
const killRows = computed((): KillRow[] => {
  const hp = effectiveTargetHp.value
  const rows: KillRow[] = []
  const aa = estimatedAutoAttackDamage()
  if (aa != null) {
    rows.push({
      key: 'aa',
      slot: displayAutoKey(),
      name: t('theorycraft.practice.autoAttack'),
      damage: aa,
      split: autoAttackSplit.value,
      hits: castsToKill(hp, aa),
    })
  }
  if (passive.value?.damageVsChampion != null) {
    rows.push({
      key: 'passive',
      slot: 'P',
      name: passive.value.name,
      imageUrl: passive.value.imageUrl,
      damage: passive.value.damageVsChampion,
      split: passive.value.damageVsSplit ?? null,
      hits: castsToKill(hp, passive.value.damageVsChampion),
    })
  }
  for (const spell of spells.value) {
    if (spell.damageVsChampion == null) continue
    rows.push({
      key: spell.id,
      slot: displaySpellSlot(spell.slot),
      name: spell.name,
      imageUrl: spell.imageUrl,
      damage: spell.damageVsChampion,
      split: spell.damageVsSplit ?? null,
      hits: castsToKill(Math.max(0, hp - (spell.executeBelow ?? 0)), spell.damageVsChampion),
      spell,
    })
  }
  const procs = comboProcDamage(procContext(), {
    attacks: aa != null,
    abilities: rows.some(row => row.key !== 'aa'),
  })
  for (const proc of procs) {
    const split = mitigateRaw(proc.split)
    const damage = sumSplit(split)
    rows.push({
      key: `proc-${proc.id}`,
      slot: '+',
      name: t(`theorycraft.practice.procs.${proc.id}`),
      damage,
      split,
      hits: null,
    })
  }
  return rows
})

/** Dégâts d'un combo complet (AA + passif + chaque sort une fois). */
const fullComboSplit = computed((): DamageSplit => {
  return killRows.value.reduce((sum, row) => addSplit(sum, row.split ?? emptySplit()), emptySplit())
})

const fullComboKills = computed(
  () => effectiveTargetHp.value > 0 && sumSplit(fullComboSplit.value) >= effectiveTargetHp.value
)

watch(
  () =>
    [
      props.championId,
      props.championData,
      loadedChampion.value,
      stackDefinitions.value,
      stackCalculationsBySource.value,
    ] as const,
  () => {
    const champion = props.championData ?? loadedChampion.value
    const championId = props.championId ?? String(champion?.id ?? '')
    if (!championId) return
    const spells = Array.isArray(champion?.spells) ? champion.spells : []
    buildStore.setTheorycraftStackContext({
      championId,
      definitions: stackDefinitions.value,
      calculationsBySource: stackCalculationsBySource.value,
      spells: spells as TheorycraftSpellRuntimeData[],
    })
  },
  { immediate: true }
)

watch(loadError, value => {
  if (value) error.value = value
})
</script>

<style scoped>
.practice-arena {
  border: 1px solid rgb(200 155 60 / 0.45);
  background:
    radial-gradient(circle at 50% 0%, rgb(200 155 60 / 0.1), transparent 60%), rgb(1 10 19 / 0.65);
  box-shadow: inset 0 0 24px rgb(0 0 0 / 0.5);
}

.practice-arena:focus-visible {
  border-color: rgb(200 155 60 / 0.9);
}

.practice-hpbar {
  position: relative;
  display: flex;
  height: 1.4rem;
  overflow: hidden;
  border: 1px solid rgb(0 0 0 / 0.8);
  border-radius: 3px;
  background: rgb(15 23 42 / 0.9);
}

.practice-hpbar > span {
  height: 100%;
  transition: width 0.25s ease-out;
}

.practice-hpbar__hp {
  background: linear-gradient(180deg, #4ade80, #15803d);
}

.practice-hpbar__shield {
  background: linear-gradient(180deg, #f8fafc, #94a3b8);
}

.practice-hpbar__lost {
  opacity: 0.75;
}

.dmg-bg-physical {
  background: #f97316;
}

.dmg-bg-magic {
  background: #818cf8;
}

.dmg-bg-true {
  background: #e2e8f0;
}

.dmg-text-physical {
  color: #fb923c;
}

.dmg-text-magic {
  color: #a5b4fc;
}

.dmg-text-true {
  color: #f1f5f9;
}

.practice-floats {
  pointer-events: none;
  position: absolute;
  inset: -0.5rem 0 auto 0;
  height: 0;
}

.practice-float {
  position: absolute;
  top: 0;
  font-size: 1.05rem;
  font-weight: 800;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.9);
  animation: practice-float-up 1.2s ease-out forwards;
}

.practice-float--lethal {
  font-size: 1.3rem;
  color: #f87171;
}
.practice-float--crit {
  font-size: 1.25rem;
  font-style: italic;
  text-shadow: 0 0 6px rgba(251, 191, 36, 0.8);
}

@keyframes practice-float-up {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1.25);
  }
  100% {
    opacity: 0;
    transform: translateY(-1.6rem) scale(1);
  }
}

.practice-status {
  margin-left: auto;
  border-radius: 3px;
  padding: 0 0.35rem;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
}

.practice-status--hard {
  background: rgb(250 204 21 / 0.25);
  color: #fde047;
}

.practice-status--slow {
  background: rgb(96 165 250 / 0.25);
  color: #93c5fd;
}

.practice-dead {
  font-weight: 800;
  color: #f87171;
}

.practice-stat {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  background: rgb(255 255 255 / 0.04);
  padding: 0.3rem;
}

.practice-stat__label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(255 255 255 / 0.55);
}

.practice-stat__value {
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 0.95);
}

.practice-type {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  border-left: 3px solid;
  border-radius: 3px;
  background: rgb(255 255 255 / 0.04);
  padding: 0.25rem 0.4rem;
}

.practice-type--physical {
  border-color: #f97316;
}

.practice-type--magic {
  border-color: #818cf8;
}

.practice-type--true {
  border-color: #e2e8f0;
}

.practice-type__label {
  color: rgb(255 255 255 / 0.65);
}

.practice-type__value {
  margin-left: auto;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 0.95);
}

.practice-type__pct {
  font-size: 0.6rem;
  color: rgb(255 255 255 / 0.5);
}

.practice-resbar {
  position: relative;
  height: 0.85rem;
  overflow: hidden;
  border-radius: 3px;
  background: rgb(15 23 42 / 0.9);
}

.practice-resbar > span:first-child {
  display: block;
  height: 100%;
  transition: width 0.25s ease-out;
}

.practice-resbar__mana {
  background: linear-gradient(180deg, #60a5fa, #1d4ed8);
}

.practice-resbar__energy {
  background: linear-gradient(180deg, #fde047, #ca8a04);
}

.practice-resbar__text {
  position: absolute;
  inset: 0;
  text-align: center;
  line-height: 0.85rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.9);
}

.practice-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.practice-action {
  position: relative;
  display: flex;
  width: 3.4rem;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  border-radius: 6px;
  padding: 0.25rem 0.2rem 0.3rem;
  background: rgb(0 0 0 / 0.35);
  transition:
    transform 0.08s ease,
    background 0.15s ease;
}

.practice-action:hover:not(:disabled) {
  background: rgb(200 155 60 / 0.18);
}

.practice-action:active:not(:disabled) {
  transform: scale(0.94);
}

.practice-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.practice-action__icon {
  display: flex;
  width: 2.6rem;
  height: 2.6rem;
  align-items: center;
  justify-content: center;
  border: 2px solid #c89b3c;
  border-radius: 4px;
  background: #000;
  object-fit: cover;
}

.practice-action__icon--aa {
  font-size: 1.3rem;
  color: #f0e6d2;
}

.practice-action--nomana .practice-action__icon {
  filter: grayscale(0.6) brightness(0.7);
  border-color: #3b82f6;
}

.practice-action__key {
  position: absolute;
  top: 2.15rem;
  right: 0.15rem;
  min-width: 1rem;
  border-radius: 2px;
  background: rgb(0 0 0 / 0.9);
  padding: 0 0.15rem;
  font-size: 0.6rem;
  font-weight: 800;
  color: #f0e6d2;
}

.practice-action__cd {
  position: absolute;
  top: 0.25rem;
  left: 50%;
  display: flex;
  width: 2.6rem;
  height: 2.6rem;
  transform: translateX(-50%);
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgb(0 0 0 / 0.65);
  font-size: 0.9rem;
  font-weight: 800;
  color: #fff;
}

.practice-action__cost {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 0.6rem;
  font-weight: 700;
  color: rgb(125 211 252);
}

.practice-action--active .practice-action__icon {
  border-color: #22c55e;
  box-shadow: 0 0 6px rgb(34 197 94 / 0.7);
}

.practice-action__on {
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 0.6rem;
  font-weight: 800;
  color: #22c55e;
}

.practice-extra {
  border: 1px solid rgb(200 155 60 / 0.5);
  border-radius: 4px;
  background: rgb(0 0 0 / 0.35);
  padding: 0.2rem 0.5rem;
  color: #f0e6d2;
}

.practice-extra--target {
  border-color: rgb(248 113 113 / 0.6);
}

.practice-extra__cd {
  margin-left: 0.25rem;
  font-weight: 800;
  color: rgb(148 163 184);
}

.practice-action__exec {
  font-size: 0.6rem;
  font-weight: 700;
  color: rgb(248 113 113);
}

.practice-action__dmg {
  font-size: 0.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 0.95);
}

.practice-splitbar {
  display: flex;
  width: 100%;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.08);
}

.practice-btn {
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.85);
}

.practice-btn:hover:not(:disabled) {
  border-color: rgb(200 155 60 / 0.8);
}

.practice-btn:disabled {
  opacity: 0.4;
}

.practice-btn--primary {
  border-color: #c89b3c;
  background: rgb(200 155 60 / 0.2);
  color: #f0e6d2;
}

.practice-chip {
  border-radius: 3px;
  background: rgb(200 155 60 / 0.2);
  padding: 0.05rem 0.4rem;
  font-weight: 700;
  color: #f0e6d2;
}

.practice-chip:hover {
  background: rgb(248 113 113 / 0.35);
  text-decoration: line-through;
}

.practice-table {
  border: 1px solid rgb(255 255 255 / 0.1);
  background: rgb(0 0 0 / 0.25);
}

.practice-row {
  border-top: 1px solid rgb(255 255 255 / 0.06);
}

.practice-row--total {
  border-top: 1px solid rgb(200 155 60 / 0.5);
}

.practice-slot {
  display: inline-flex;
  min-width: 1.4rem;
  justify-content: center;
  border-radius: 3px;
  background: rgb(0 0 0 / 0.5);
  padding: 0 0.2rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #c89b3c;
}

.practice-rank {
  display: inline-flex;
  height: 0.9rem;
  min-width: 0.9rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 2px;
  font-size: 0.55rem;
  font-weight: 700;
  color: rgb(255 255 255 / 0.7);
}

.practice-rank--on {
  border-color: #c89b3c;
  background: rgb(200 155 60 / 0.3);
  color: #f0e6d2;
}

.practice-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
}

.theorycraft-spell-entry {
  --spell-entry-border-gradient: var(
    --card-border-gradient-strong,
    linear-gradient(130deg, #bba077 0%, #9a8468 45%, #1e2328 100%)
  );
  border: 2px solid transparent;
  border-radius: 6px;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--spell-entry-border-gradient) border-box;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
}

summary::-webkit-details-marker {
  display: none;
}

.theorycraft-spell-icon {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  overflow: visible;
}

.theorycraft-spell-icon__img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 2px solid transparent;
  border-image: var(
      --card-border-gradient-strong,
      linear-gradient(130deg, #bba077 0%, #9a8468 45%, #1e2328 100%)
    )
    1;
  background: #000;
  object-fit: cover;
}

.theorycraft-spell-icon__key {
  position: absolute;
  bottom: -5px;
  right: -5px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.spell-entry-row {
  overflow: visible;
}

.theorycraft-stack-input {
  box-sizing: border-box;
  width: auto;
  min-width: 2ch;
  height: 1.2em;
  padding: 0 0.35em;
  font: inherit;
  line-height: 1;
  text-align: center;
  vertical-align: baseline;
  field-sizing: content;
  appearance: textfield;
  -moz-appearance: textfield;
}

.theorycraft-stack-input::-webkit-outer-spin-button,
.theorycraft-stack-input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

.spell-header-stats__label {
  color: rgb(252 211 77 / 0.95);
}

.spell-header-stats__value {
  font-weight: 700;
  color: rgb(255 255 255 / 0.92);
  white-space: nowrap;
}

.spell-vs-damage-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border: 1px solid rgb(200 155 60 / 0.55);
  border-radius: 0.35rem;
  background: rgb(200 155 60 / 0.12);
  color: rgb(255 231 163 / 0.95);
  padding: 0.05rem 0.35rem;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.2;
}

.spell-vs-damage-badge--lethal {
  border-color: rgb(248 113 113 / 0.7);
  background: rgb(127 29 29 / 0.25);
  color: rgb(254 202 202 / 0.98);
}

.spell-vs-damage-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.35);
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  color: rgb(255 255 255 / 0.9);
  cursor: help;
}

:deep(.tooltip-spell-description .dmg-physical),
:deep(.tooltip-spell-description physicalDamage) {
  color: rgb(248 113 113 / 1);
}

:deep(.tooltip-spell-description .dmg-magic),
:deep(.tooltip-spell-description magicDamage) {
  color: rgb(196 181 253 / 1);
}

:deep(.tooltip-spell-description .dmg-true),
:deep(.tooltip-spell-description trueDamage) {
  color: rgb(226 232 240 / 1);
}

:deep(.tooltip-spell-description .scale-ap),
:deep(.tooltip-spell-description .tooltip-tag.scale-ap) {
  color: rgb(196 181 253 / 1);
  font-weight: 700;
}

:deep(.tooltip-spell-description .scale-ad),
:deep(.tooltip-spell-description .tooltip-tag.scale-ad) {
  color: rgb(253 224 71 / 1);
  font-weight: 700;
}

:deep(.tooltip-spell-description .healing),
:deep(.tooltip-spell-description healing) {
  color: rgb(134 239 172 / 1);
}

:deep(.tooltip-spell-description .shield),
:deep(.tooltip-spell-description shield) {
  color: rgb(134 239 172 / 1);
}

:deep(.tooltip-spell-description .speed),
:deep(.tooltip-spell-description speed) {
  color: rgb(96 165 250 / 1);
}
</style>

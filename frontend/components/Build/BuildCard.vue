<!-- eslint-disable vue/no-v-html -- spell/description from game data -->
<template>
  <div
    class="build-card-wrapper"
    :class="{
      'build-card-wrapper--streamer-scaled': isLayoutScaled,
      'build-card-wrapper--screenshot': props.forScreenshot,
    }"
    :style="buildCardThemeVars"
  >
    <div
      v-if="
        !hideTopActions && (canShowReadonlyDescription || (!readonly && hasChampion) || !readonly)
      "
      class="card-top-actions"
    >
      <button
        v-if="
          (canShowReadonlyDescription || (!readonly && hasChampion)) &&
          selectionMode !== 'theorycraft'
        "
        class="card-top-action-button"
        :title="localFlipped ? 'Voir le build' : 'Voir la description'"
        type="button"
        @click.stop="localFlipped = !localFlipped"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      </button>

      <input
        v-if="!readonly"
        :value="cardAuthor"
        type="text"
        maxlength="30"
        class="card-top-author-input"
        :placeholder="t('createBuild.author')"
        @input="updateCardAuthor(($event.target as HTMLInputElement).value)"
      />

      <div v-if="!readonly" class="card-top-visibility-toggle">
        <button
          type="button"
          class="card-top-visibility-button"
          :class="{ 'is-active': cardVisibility === 'public' }"
          @click="setCardVisibility('public')"
        >
          {{ t('buildsPage.public') }}
        </button>
        <button
          type="button"
          class="card-top-visibility-button"
          :class="{ 'is-active': cardVisibility === 'private' }"
          @click="setCardVisibility('private')"
        >
          {{ t('buildsPage.private') }}
        </button>
      </div>

      <button
        v-if="!readonly"
        class="card-top-action-button"
        title="Réinitialiser la sheet"
        type="button"
        @click="resetBuild"
      >
        <Icon name="mdi:refresh" size="16px" />
      </button>
    </div>
    <div
      v-if="
        variantsPopoverOpen &&
        ((readonly && buildSubBuilds.length > 0) || (!readonly && hasChampion))
      "
      ref="variantsPopoverRef"
      class="variants-popover"
    >
      <div class="variants-popover-header">
        <span class="variants-popover-title">{{ t('buildCard.variantsTitle') }}</span>
        <div v-if="!readonly" class="variants-popover-header-actions">
          <button
            type="button"
            class="variants-popover-copy-btn"
            :disabled="totalVariantCount < 2"
            @click.stop="openCopyPicker()"
          >
            {{ t('buildCard.copyToVariants') }}
          </button>
          <button class="variants-popover-add" type="button" @click.stop="createVariantFromBack">
            {{ t('buildCard.addVariant') }}
          </button>
        </div>
      </div>
      <ul class="variants-popover-list">
        <li
          class="variants-popover-item"
          :class="{ 'variants-popover-item-active': activeVariantKey === 'main' }"
          @click.stop="selectVariant(null)"
        >
          <span class="variants-popover-dot"></span>
          <template v-if="!readonly">
            <input
              class="variants-popover-input"
              type="text"
              maxlength="40"
              :value="buildStore.currentBuild?.name || ''"
              :placeholder="t('buildCard.mainBuildTitlePlaceholder')"
              @click.stop
              @input="onMainTitleInput(($event.target as HTMLInputElement).value)"
            />
          </template>
          <span v-else class="variants-popover-label">
            {{ displayBuild?.name || t('buildCard.mainBuildName') }}
          </span>
        </li>
        <li
          v-for="(sub, idx) in buildSubBuilds"
          :key="idx"
          class="variants-popover-item"
          :class="{ 'variants-popover-item-active': activeVariantKey === idx }"
          @click.stop="selectVariant(idx)"
        >
          <span class="variants-popover-dot"></span>
          <template v-if="!readonly">
            <input
              class="variants-popover-input"
              type="text"
              maxlength="40"
              :value="sub.title || t('buildCard.variantN', { n: idx + 2 })"
              @click.stop
              @input="onSubTitleInput(idx, ($event.target as HTMLInputElement).value)"
            />
          </template>
          <span v-else class="variants-popover-label">
            {{ sub.title || t('buildCard.variantN', { n: idx + 2 }) }}
          </span>
          <button
            v-if="!readonly"
            type="button"
            class="variants-popover-remove"
            :title="t('buildCard.removeVariant')"
            @click.stop="buildStore.removeSubBuild(idx)"
          >
            ✕
          </button>
        </li>
      </ul>
      <div v-if="copyPickerOpen" class="variants-copy-picker">
        <div class="variants-copy-picker-title">{{ t('buildCard.copyPickerTitle') }}</div>
        <div class="variants-copy-picker-row">
          <label class="variants-copy-picker-label">{{ t('buildCard.copyFrom') }}</label>
          <select v-model="copySource" class="variants-copy-picker-select">
            <option value="main">
              {{ buildStore.currentBuild?.name || t('buildCard.mainBuildName') }}
            </option>
            <option v-for="(sub, idx) in buildSubBuilds" :key="idx" :value="idx">
              {{ sub.title || t('buildCard.variantN', { n: idx + 2 }) }}
            </option>
          </select>
        </div>
        <div class="variants-copy-picker-row">
          <span class="variants-copy-picker-label">{{ t('buildCard.copyTo') }}</span>
          <div class="variants-copy-destinations">
            <label class="variants-copy-option">
              <input
                type="checkbox"
                :checked="copyDestinations.includes('main')"
                :disabled="copySource === 'main'"
                @change="toggleCopyDestination('main', ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ buildStore.currentBuild?.name || t('buildCard.mainBuildName') }}</span>
            </label>
            <label v-for="(sub, idx) in buildSubBuilds" :key="idx" class="variants-copy-option">
              <input
                type="checkbox"
                :checked="copyDestinations.includes(idx)"
                :disabled="copySource === idx"
                @change="toggleCopyDestination(idx, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ sub.title || t('buildCard.variantN', { n: idx + 2 }) }}</span>
            </label>
          </div>
        </div>
        <div class="variants-copy-picker-divider" />
        <label class="variants-copy-option">
          <input type="checkbox" :checked="copyAllSelected" @change="toggleCopyAll" />
          <span>{{ t('buildCard.copyAll') }}</span>
        </label>
        <label class="variants-copy-option">
          <input v-model="copySelection.items" type="checkbox" />
          <span>{{ t('buildCard.copyItems') }}</span>
        </label>
        <label class="variants-copy-option">
          <input v-model="copySelection.runes" type="checkbox" />
          <span>{{ t('buildCard.copyRunes') }}</span>
        </label>
        <label class="variants-copy-option">
          <input v-model="copySelection.shards" type="checkbox" />
          <span>{{ t('buildCard.copyShards') }}</span>
        </label>
        <label class="variants-copy-option">
          <input v-model="copySelection.summonerSpells" type="checkbox" />
          <span>{{ t('buildCard.copySummoners') }}</span>
        </label>
        <label class="variants-copy-option">
          <input v-model="copySelection.tags" type="checkbox" />
          <span>{{ t('buildCard.copyTags') }}</span>
        </label>
        <label class="variants-copy-option">
          <input v-model="copySelection.firstThreeUps" type="checkbox" />
          <span>{{ t('buildCard.copyFirstThreeUps') }}</span>
        </label>
        <label class="variants-copy-option">
          <input v-model="copySelection.skillUpOrder" type="checkbox" />
          <span>{{ t('buildCard.copySkillUpOrder') }}</span>
        </label>
        <div class="variants-copy-picker-actions">
          <button type="button" class="variants-copy-picker-cancel" @click="closeCopyPicker()">
            {{ t('buildCard.cancel') }}
          </button>
          <button
            type="button"
            class="variants-copy-picker-apply"
            :disabled="!canApplyCopy"
            @click="applyCopySelection"
          >
            {{ t('buildCard.apply') }}
          </button>
        </div>
      </div>
    </div>
    <!-- Flip container (only in readonly mode with sub-builds) -->
    <div class="flip-container" :class="{ flipped: localFlipped }">
      <div class="build-card">
        <!-- Version (top right) -->
        <div class="build-version">{{ version }}</div>

        <div v-if="showFrontVariantsTagsStack" class="variants-tags-stack">
          <button
            v-if="showVariantTriggerButton"
            ref="variantsTriggerRef"
            class="variants-count-indicator"
            type="button"
            @click.stop="toggleVariantsPopover"
          >
            <div
              class="variants-poker-icon"
              :title="`${totalVariantCount} variante${totalVariantCount > 1 ? 's' : ''}`"
            >
              <span
                v-for="n in Math.max(1, Math.min(totalVariantCount, 4))"
                :key="`variant-card-${n}`"
                class="variants-poker-card"
                :style="{
                  transform: `translateX(${(n - 1) * 4}px) rotate(${(n - 1) * 4}deg)`,
                  zIndex: n,
                }"
              />
              <span class="variants-poker-badge">
                {{ totalVariantCount }}
              </span>
            </div>
          </button>
          <!-- Même boîte que le bouton variantes (dimensions identiques au builder / liste / capture). -->
          <div
            v-else-if="showVariantsTagColumnSpacer"
            class="variants-count-indicator variants-count-indicator--layout-spacer"
            aria-hidden="true"
          >
            <div class="variants-poker-icon">
              <span
                v-for="n in Math.max(1, Math.min(totalVariantCount, 4))"
                :key="`phantom-variant-card-${n}`"
                class="variants-poker-card"
                :style="{
                  transform: `translateX(${(n - 1) * 4}px) rotate(${(n - 1) * 4}deg)`,
                  zIndex: n,
                }"
              />
              <span class="variants-poker-badge">
                {{ totalVariantCount }}
              </span>
            </div>
          </div>

          <div v-if="!readonly || selectedBuildTags.length > 0" class="build-tags-section">
            <div class="build-tags-container">
              <button
                v-for="tag in visibleBuildTags"
                :key="tag.id"
                type="button"
                class="build-tag-chip"
                :class="[
                  selectedBuildTags.includes(tag.id)
                    ? 'build-tag-chip--selected'
                    : 'build-tag-chip--unselected',
                  selectedBuildTags.includes(tag.id) && tag.id === 'troll'
                    ? 'build-tag-chip--troll-selected'
                    : '',
                ]"
                :style="
                  selectedBuildTags.includes(tag.id)
                    ? { '--tag-g1': tag.gradient[0], '--tag-g2': tag.gradient[1] }
                    : undefined
                "
                :disabled="readonly"
                @click="!readonly && toggleBuildTag(tag.id)"
              >
                {{ tag.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Roles Section - Entre la version et le séparateur -->
        <div
          class="roles-section"
          :class="{
            'validation-blink-frame': props.highlightMissingFields && missingFieldChecks.roles,
          }"
        >
          <div class="roles-container">
            <button
              v-for="role in allRoles"
              :key="role"
              type="button"
              :class="[
                'role-icon',
                selectedRoles.includes(role) ? 'role-selected' : 'role-unselected',
              ]"
              :title="tooltipsEnabled ? getRoleName(role) : undefined"
              :disabled="readonly"
              @click="!readonly && toggleRole(role)"
            >
              <img
                :src="`/icons/roles/${role === 'adc' ? 'bot' : role}.png`"
                :alt="getRoleName(role)"
                class="role-image"
              />
            </button>
          </div>
        </div>

        <!-- Champion Section (Top) - Toujours visible -->
        <div class="champion-section">
          <!-- Portrait en forme de losange -->
          <div
            class="champion-portrait-container"
            :class="[
              regionSelectionClass('champion'),
              {
                'is-splash': showChampionSplashArt,
                'validation-blink-frame':
                  props.highlightMissingFields && missingFieldChecks.champion,
              },
            ]"
            @click="onSelectRegion('champion', $event)"
          >
            <template v-if="selectedChampion">
              <img
                v-show="!showChampionSplashArt"
                ref="championPortraitRef"
                :src="championIconSrc"
                :alt="selectedChampion.name"
                class="champion-portrait"
                loading="eager"
                decoding="sync"
                @mouseenter="onChampionMouseEnter"
                @mousemove="onChampionMouseMove"
                @mouseleave="onChampionMouseLeave"
              />
              <img
                v-show="showChampionSplashArt"
                ref="championPortraitRef"
                :src="championSplashSrc"
                :alt="selectedChampion.name"
                class="champion-portrait champion-portrait--splash"
                loading="eager"
                decoding="sync"
                @mouseenter="onChampionMouseEnter"
                @mousemove="onChampionMouseMove"
                @mouseleave="onChampionMouseLeave"
              />
            </template>
            <div v-else class="champion-portrait-placeholder"></div>
          </div>

          <!-- Titre du build / variante (fallback = nom du champion) — zone hauteur fixe + police ajustée -->
          <div ref="championTitleBoxRef" class="champion-name-box">
            <h2 ref="championNameRef" class="champion-name" :title="cardTitle || undefined">
              {{ cardTitle }}
            </h2>
          </div>

          <!-- Sorts d'invocateur (juste sous le nom) - Toujours visible -->
          <div
            class="summoner-spells-row"
            :class="{
              'validation-blink-frame':
                props.highlightMissingFields && missingFieldChecks.summonerSpells,
            }"
            @click.stop="onSelectRegion('runes', $event)"
          >
            <template v-for="(spell, index) in filteredSummonerSpells" :key="index">
              <img
                v-if="spell"
                :src="getSpellImageUrl(versionForImages, spell.image.full)"
                :alt="spell.name"
                class="summoner-spell-icon"
                :title="sheetTooltip(getSummonerSpellDisplayName(spell), 'Summoner Spell')"
                @mouseenter="onSheetElementEnter($event, 'spell', spell, 'Summoner Spell')"
                @mousemove="onSheetElementMove"
                @mouseleave="onSheetElementLeave"
              />
            </template>
            <div
              v-for="n in 2 - filteredSummonerSpells.length"
              :key="`empty-${n}`"
              class="summoner-spell-placeholder"
            ></div>
          </div>

          <!-- Ligne de séparation -->
          <div class="separator-line"></div>
        </div>

        <!-- Runes Section - Toujours visible -->
        <div
          class="runes-section"
          :class="regionSelectionClass('runes')"
          @click="onSelectRegion('runes', $event)"
        >
          <div class="runes-container">
            <!-- Keystone (grande icône à gauche) - première rune principale -->
            <div
              class="keystone-container"
              :class="{
                'validation-blink-frame':
                  props.highlightMissingFields && missingFieldChecks.runesPrimary,
              }"
            >
              <img
                v-if="keystoneRuneId"
                :src="getRuneIconById(keystoneRuneId)"
                alt="Keystone"
                class="keystone-icon"
                :title="sheetTooltip(keystoneRuneId ? getRuneNameById(keystoneRuneId) : '', 'Rune')"
                @mouseenter="onSheetElementEnter($event, 'rune', keystoneRuneId ?? 0, 'Rune')"
                @mousemove="onSheetElementMove"
                @mouseleave="onSheetElementLeave"
              />
              <div v-else class="keystone-placeholder"></div>
            </div>

            <!-- Runes principales et secondaires -->
            <div class="runes-main">
              <!-- Runes principales (3 horizontales) - Toujours visible -->
              <div
                class="primary-runes-row"
                :class="{
                  'validation-blink-frame':
                    props.highlightMissingFields && missingFieldChecks.runesPrimary,
                }"
              >
                <img
                  v-for="(runeId, index) in primaryRunesRow"
                  :key="index"
                  :src="getRuneIconById(runeId)"
                  :alt="`Rune ${index + 1}`"
                  class="primary-rune-icon"
                  :title="sheetTooltip(runeId ? getRuneNameById(runeId) : '', 'Rune')"
                  @mouseenter="onSheetElementEnter($event, 'rune', runeId, 'Rune')"
                  @mousemove="onSheetElementMove"
                  @mouseleave="onSheetElementLeave"
                />
                <div
                  v-for="n in 3 - primaryRunesRow.length"
                  :key="`empty-primary-${n}`"
                  class="primary-rune-placeholder"
                ></div>
              </div>

              <!-- Runes secondaires (path icon + 2 runes horizontales en dessous) - Toujours visible -->
              <div
                class="secondary-runes-row"
                :class="{
                  'validation-blink-frame':
                    props.highlightMissingFields && missingFieldChecks.runesSecondary,
                }"
              >
                <!-- Icône du path secondaire -->
                <div
                  v-if="secondaryPathIcon"
                  class="secondary-path-icon"
                  role="img"
                  :aria-label="secondaryPathName"
                  :title="sheetTooltip(secondaryPathName, 'Secondary Path')"
                  @mouseenter="
                    onSheetElementEnter($event, 'path', secondaryPathId ?? 0, 'Secondary Path')
                  "
                  @mousemove="onSheetElementMove"
                  @mouseleave="onSheetElementLeave"
                >
                  <span
                    class="secondary-path-icon-mask"
                    :style="{
                      backgroundColor: secondaryPathColor,
                      WebkitMaskImage: `url(${secondaryPathIcon})`,
                      maskImage: `url(${secondaryPathIcon})`,
                    }"
                  />
                </div>
                <div v-else class="secondary-path-placeholder"></div>
                <!-- Runes secondaires -->
                <img
                  v-for="(runeId, index) in filteredSecondaryRuneIds"
                  :key="index"
                  :src="getRuneIconById(runeId)"
                  :alt="`Secondary Rune ${index + 1}`"
                  class="secondary-rune-icon"
                  :title="sheetTooltip(runeId ? getRuneNameById(runeId) : '', 'Rune')"
                  @mouseenter="onSheetElementEnter($event, 'rune', runeId, 'Rune')"
                  @mousemove="onSheetElementMove"
                  @mouseleave="onSheetElementLeave"
                />
                <div
                  v-for="n in 2 - filteredSecondaryRuneIds.length"
                  :key="`empty-secondary-${n}`"
                  class="secondary-rune-placeholder"
                ></div>
              </div>
            </div>
          </div>

          <!-- Shards collés au bord droit, dans la même zone que les runes - Toujours visible -->
          <div class="shards-strip">
            <img
              v-for="(shardId, index) in filteredShardIds"
              :key="index"
              :src="getShardIconById(shardId)"
              :alt="`Shard ${index + 1}`"
              class="shard-icon-strip"
              :title="sheetTooltip(shardId ? getShardNameById(shardId) : '', 'Shard')"
              @mouseenter="onSheetElementEnter($event, 'shard', shardId, 'Shard')"
              @mousemove="onSheetElementMove"
              @mouseleave="onSheetElementLeave"
            />
            <div
              v-for="n in 3 - filteredShardIds.length"
              :key="`empty-shard-${n}`"
              class="shard-placeholder"
            ></div>
          </div>
        </div>

        <!-- Séparateur entre runes et items - Toujours visible -->
        <div class="separator-line"></div>

        <!-- Items Section - Toujours visible -->
        <div
          class="items-section"
          :class="[
            regionSelectionClass('items'),
            {
              'validation-blink-frame': props.highlightMissingFields && missingFieldChecks.items,
            },
          ]"
          @click="onSelectRegion('items', $event)"
        >
          <!-- Starting Items (2) + Boots slot (1) - Toujours visible -->
          <div
            class="starting-items-row"
            :class="{
              'validation-blink-frame':
                props.highlightMissingFields && missingFieldChecks.starterItems,
            }"
          >
            <div
              v-for="item in startingItems"
              :key="`starter-${item.id}`"
              class="item-wrapper"
              @mouseenter="onSheetElementEnter($event, 'item', item, 'Item')"
              @mousemove="onSheetElementMove"
              @mouseleave="onSheetElementLeave"
            >
              <img
                :src="getItemImageUrl(versionForImages, item.image.full)"
                :alt="item.name"
                class="item-icon"
                :title="sheetTooltip(getItemDisplayName(item), 'Item')"
              />
            </div>
            <div
              v-for="n in 2 - startingItems.length"
              :key="`empty-starting-${n}`"
              class="item-placeholder"
            ></div>

            <!-- Boots slot (always shown) -->
            <div class="boots-slot" :class="{ 'boots-slot--filled': bootsItems.length > 0 }">
              <!-- Une seule paire de bottes : icône complète -->
              <img
                v-if="bootsItems.length === 1 && bootsItems[0]"
                :src="getItemImageUrl(versionForImages, bootsItems[0].image.full)"
                :alt="bootsItems[0].name"
                class="boots-icon-single"
                :title="
                  sheetTooltip(bootsItems[0] ? getItemDisplayName(bootsItems[0]) : '', 'Boots')
                "
                @mouseenter="
                  onSheetElementEnter($event, 'item', bootsItems[0] ?? { id: '' }, 'Boots')
                "
                @mousemove="onSheetElementMove"
                @mouseleave="onSheetElementLeave"
              />

              <!-- Deux paires de bottes : image recomposée en deux moitiés -->
              <template v-else-if="bootsItems.length >= 2">
                <div
                  class="boots-item-split boots-item-left"
                  :style="getBootBackgroundStyle(bootsItems[0])"
                  :title="
                    sheetTooltip(bootsItems[0] ? getItemDisplayName(bootsItems[0]) : '', 'Boots')
                  "
                  @mouseenter="
                    onSheetElementEnter($event, 'item', bootsItems[0] ?? { id: '' }, 'Boots')
                  "
                  @mousemove="onSheetElementMove"
                  @mouseleave="onSheetElementLeave"
                ></div>
                <div
                  class="boots-item-split boots-item-right"
                  :style="getBootBackgroundStyle(bootsItems[1])"
                  :title="
                    sheetTooltip(bootsItems[1] ? getItemDisplayName(bootsItems[1]) : '', 'Boots')
                  "
                  @mouseenter="
                    onSheetElementEnter($event, 'item', bootsItems[1] ?? { id: '' }, 'Boots')
                  "
                  @mousemove="onSheetElementMove"
                  @mouseleave="onSheetElementLeave"
                ></div>
              </template>

              <div v-if="bootsItems.length === 0" class="item-placeholder"></div>
            </div>
          </div>

          <!-- Core Items Paths - Toujours visible -->
          <div class="core-items-paths">
            <!-- Path 1 (3 items avec flèches) -->
            <div class="items-path">
              <template v-for="(item, index) in coreItemsPath1" :key="`path1-${item.id}`">
                <div
                  class="item-wrapper"
                  @mouseenter="onSheetElementEnter($event, 'item', item, 'Item')"
                  @mousemove="onSheetElementMove"
                  @mouseleave="onSheetElementLeave"
                >
                  <img
                    :src="getItemImageUrl(versionForImages, item.image.full)"
                    :alt="item.name"
                    class="item-icon"
                    :title="sheetTooltip(getItemDisplayName(item), 'Item')"
                  />
                </div>
                <span v-if="index < coreItemsPath1.length - 1" class="arrow-right">→</span>
              </template>
              <template
                v-for="(n, idx) in Array(Math.max(0, 3 - coreItemsPath1.length)).fill(0)"
                :key="`empty-path1-${idx}`"
              >
                <span v-if="idx === 0 && coreItemsPath1.length > 0" class="arrow-right">→</span>
                <div class="item-placeholder"></div>
                <span v-if="idx < Math.max(0, 3 - coreItemsPath1.length - 1)" class="arrow-right"
                  >→</span
                >
              </template>
            </div>

            <!-- Path 2 (3 items avec flèches) -->
            <div class="items-path">
              <template v-for="(item, index) in coreItemsPath2" :key="`path2-${item.id}`">
                <div
                  class="item-wrapper"
                  @mouseenter="onSheetElementEnter($event, 'item', item, 'Item')"
                  @mousemove="onSheetElementMove"
                  @mouseleave="onSheetElementLeave"
                >
                  <img
                    :src="getItemImageUrl(versionForImages, item.image.full)"
                    :alt="item.name"
                    class="item-icon"
                    :title="sheetTooltip(getItemDisplayName(item), 'Item')"
                  />
                </div>
                <span v-if="index < coreItemsPath2.length - 1" class="arrow-right">→</span>
              </template>
              <template
                v-for="(n, idx) in Array(Math.max(0, 3 - coreItemsPath2.length)).fill(0)"
                :key="`empty-path2-${idx}`"
              >
                <span v-if="idx === 0 && coreItemsPath2.length > 0" class="arrow-right">→</span>
                <div class="item-placeholder"></div>
                <span v-if="idx < Math.max(0, 3 - coreItemsPath2.length - 1)" class="arrow-right"
                  >→</span
                >
              </template>
            </div>
          </div>
        </div>

        <!-- First Three Ups Section (Between items and skills) - Toujours visible -->
        <div
          class="first-three-ups-section"
          :class="{
            'validation-blink-frame':
              props.highlightMissingFields && missingFieldChecks.firstThreeUps,
          }"
        >
          <div class="first-three-ups-vertical">
            <div
              v-for="(slot, index) in firstThreeUpSlots"
              :key="index"
              class="first-three-ups-item"
            >
              <div
                class="skill-icon-wrapper skill-slot-trigger"
                :class="{ 'skill-slot-trigger--editable': canEditSkillOrder }"
                @click.stop="toggleSkillDropdown(`first-${index}`)"
              >
                <img
                  v-if="slot.spell"
                  :src="
                    getChampionSpellImageUrl(
                      versionForImages,
                      selectedChampion?.id || '',
                      slot.spell.image.full
                    )
                  "
                  :alt="slot.spell.name"
                  class="skill-icon"
                  :title="
                    tooltipsEnabled
                      ? slot.spell.name
                      : canEditSkillOrder
                        ? t('skills.selectSkill')
                        : undefined
                  "
                />
                <div v-else class="skill-placeholder"></div>
                <span v-if="slot.key" class="skill-key">
                  {{ t(`skills.key.${slot.key}`) }}
                </span>
                <span class="level-badge">{{ index + 1 }}</span>
              </div>
              <div
                v-if="canEditSkillOrder && openSkillDropdown === `first-${index}`"
                class="skill-slot-dropdown"
                @click.stop
              >
                <button
                  v-for="spell in availableSkillSpells"
                  :key="spell.key"
                  type="button"
                  class="skill-slot-dropdown-option"
                  :class="{
                    'is-active': slot.key === spell.key,
                    'is-disabled': isFirstThreeUpSelected(spell.key, index),
                  }"
                  :disabled="isFirstThreeUpSelected(spell.key, index)"
                  :title="
                    tooltipsEnabled
                      ? slot.key === spell.key
                        ? t('skills.clickToDeselect')
                        : isFirstThreeUpSelected(spell.key, index)
                          ? t('skills.alreadyUsedElsewhere')
                          : t('skills.select')
                      : undefined
                  "
                  @click="toggleFirstThreeUp(index, spell.key)"
                >
                  <img
                    :src="
                      getChampionSpellImageUrl(
                        versionForImages,
                        selectedChampion?.id || '',
                        spell.image.full
                      )
                    "
                    :alt="spell.name"
                    class="skill-slot-dropdown-icon"
                  />
                  <span class="skill-slot-dropdown-label">{{ t(`skills.key.${spell.key}`) }}</span>
                </button>
              </div>
              <span v-if="index < 2 && !forScreenshot" class="arrow-down">↓</span>
            </div>
          </div>
        </div>

        <!-- Skill Order Section (Right) - Toujours visible (même disposition que first three ups : clé sur l'image) -->
        <div
          class="skill-order-section"
          :class="{
            'validation-blink-frame':
              props.highlightMissingFields && missingFieldChecks.skillUpOrder,
          }"
        >
          <div class="skill-order-vertical">
            <div v-for="(slot, index) in skillOrderSlots" :key="index" class="skill-order-item">
              <div
                class="skill-icon-wrapper skill-slot-trigger"
                :class="{ 'skill-slot-trigger--editable': canEditSkillOrder }"
                @click.stop="toggleSkillDropdown(`order-${index}`)"
              >
                <img
                  v-if="slot.spell"
                  :src="
                    getChampionSpellImageUrl(
                      versionForImages,
                      selectedChampion?.id || '',
                      slot.spell.image.full
                    )
                  "
                  :alt="slot.spell.name"
                  class="skill-icon"
                  :title="
                    tooltipsEnabled
                      ? slot.spell.name
                      : canEditSkillOrder
                        ? t('skills.selectSkill')
                        : undefined
                  "
                />
                <div v-else class="skill-placeholder"></div>
                <span v-if="slot.key" class="skill-key">
                  {{ t(`skills.key.${slot.key}`) }}
                </span>
                <span class="max-badge">MAX</span>
              </div>
              <div
                v-if="canEditSkillOrder && openSkillDropdown === `order-${index}`"
                class="skill-slot-dropdown"
                @click.stop
              >
                <button
                  v-for="spell in availableSkillSpells"
                  :key="spell.key"
                  type="button"
                  class="skill-slot-dropdown-option"
                  :class="{
                    'is-active': slot.key === spell.key,
                    'is-disabled': isSkillUpOrderSelected(spell.key, index),
                  }"
                  :disabled="isSkillUpOrderSelected(spell.key, index)"
                  :title="
                    tooltipsEnabled
                      ? slot.key === spell.key
                        ? t('skills.clickToDeselect')
                        : isSkillUpOrderSelected(spell.key, index)
                          ? t('skills.alreadyUsedElsewhere')
                          : t('skills.select')
                      : undefined
                  "
                  @click="toggleSkillUpOrder(index, spell.key)"
                >
                  <img
                    :src="
                      getChampionSpellImageUrl(
                        versionForImages,
                        selectedChampion?.id || '',
                        spell.image.full
                      )
                    "
                    :alt="spell.name"
                    class="skill-slot-dropdown-icon"
                  />
                  <span class="skill-slot-dropdown-label">{{ t(`skills.key.${spell.key}`) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Lelanation (bottom left) -->
        <div class="build-footer">lelanation.fr</div>

        <!-- Tooltip (rendered via Teleport to body to avoid z-index issues with grid stacking context) -->
        <Teleport to="body">
          <div
            v-if="showTooltip && selectedChampion"
            ref="tooltipRef"
            class="tooltip-box tooltip-box-fixed z-[9999] rounded-lg border border-accent bg-background shadow-lg"
            :style="tooltipFixedStyle"
            @mouseenter="onChampionTooltipMouseEnter"
            @mouseleave="onChampionTooltipMouseLeave"
          >
            <!-- Tooltip content (same as before) -->
            <div class="tooltip-top">
              <div class="tooltip-present">
                <img
                  :src="getChampionImageUrl(versionForImages, selectedChampion.image.full)"
                  :alt="selectedChampion.name"
                  class="tooltip-champion-image"
                />
                <div
                  v-if="selectedChampion.tags && selectedChampion.tags.length > 0"
                  class="tooltip-tags-container"
                >
                  <div class="tooltip-tags">
                    {{ translatedTags }}
                  </div>
                </div>
                <div class="tooltip-text">
                  <div class="tooltip-champion-name">{{ selectedChampion.name }}</div>
                  <div class="tooltip-champion-title">{{ selectedChampion.title }}</div>
                </div>
              </div>
            </div>

            <hr class="tooltip-separator" />

            <div class="tooltip-body">
              <div class="tooltip-spells">
                <div
                  v-if="
                    selectedChampion.passive &&
                    selectedChampion.passive.image &&
                    selectedChampion.passive.image.full &&
                    selectedChampion.passive.image.full !== selectedChampion.image.full
                  "
                  class="tooltip-spell"
                >
                  <div class="tooltip-spell-img-container">
                    <img
                      :src="
                        getChampionPassiveImageUrl(
                          versionForImages,
                          selectedChampion.passive.image.full
                        )
                      "
                      :alt="selectedChampion.passive.name"
                      class="tooltip-spell-img"
                    />
                  </div>
                  <div class="tooltip-spell-content">
                    <div class="tooltip-spell-name">
                      Passive: {{ selectedChampion.passive.name }}
                    </div>
                    <div
                      v-if="passiveTooltipMeta"
                      class="tooltip-spell-meta tooltip-game-description"
                      v-html="passiveTooltipMeta"
                    />
                    <div
                      v-if="passiveTooltipBody"
                      class="tooltip-spell-description tooltip-game-description"
                      v-html="passiveTooltipBody"
                    />
                  </div>
                </div>

                <div
                  v-for="(spell, index) in formattedSpells"
                  :key="spell.id || index"
                  class="tooltip-spell"
                >
                  <div v-if="spell && spell.image" class="tooltip-spell-wrapper">
                    <div
                      class="tooltip-spell-img-container"
                      :data-spell-key="['Q', 'W', 'E', 'R'][index]"
                    >
                      <img
                        :src="
                          getChampionSpellImageUrl(
                            versionForImages,
                            selectedChampion.id,
                            spell.image.full
                          )
                        "
                        :alt="spell.name"
                        class="tooltip-spell-img"
                      />
                    </div>
                    <div class="tooltip-spell-content">
                      <div class="tooltip-spell-name">
                        {{ ['Q', 'W', 'E', 'R'][index] }}: {{ spell.name }}
                      </div>
                      <div
                        v-if="spellTooltipMeta(spell)"
                        class="tooltip-spell-meta tooltip-game-description"
                        v-html="spellTooltipMeta(spell)"
                      />
                      <div
                        v-if="spellTooltipBody(spell)"
                        class="tooltip-spell-description tooltip-game-description"
                        v-html="spellTooltipBody(spell)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Teleport>

        <!-- Sheet element tooltip (items, runes, spells, shards) — même structure que ItemSelector / RuneSelector -->
        <Teleport to="body">
          <div
            v-if="sheetElementTooltip.show && sheetElementTooltipResolved"
            ref="sheetElementTooltipRef"
            class="sheet-element-tooltip-wrapper pointer-events-none fixed z-[9999] rounded-lg border border-accent bg-background shadow-lg"
            :style="sheetElementTooltipFixedStyle"
          >
            <!-- Item: comme ItemSelector -->
            <template v-if="sheetElementTooltipResolved.type === 'item'">
              <div class="item-tooltip">
                <div class="item-tooltip-content">
                  <div class="item-tooltip-header">
                    <img
                      :src="
                        getItemImageUrl(
                          versionForImages,
                          sheetElementTooltipResolved.item.image.full
                        )
                      "
                      :alt="sheetElementTooltipResolved.item.name"
                      class="item-tooltip-image"
                    />
                    <div class="item-tooltip-text">
                      <div class="item-tooltip-name">
                        {{ sheetElementTooltipResolved.item.name }}
                      </div>
                      <div class="item-tooltip-price">
                        {{ sheetElementTooltipResolved.item.gold?.total ?? 0 }}
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="sheetElementTooltipResolved.item.plaintext"
                    class="item-tooltip-plaintext"
                  >
                    {{ sheetElementTooltipResolved.item.plaintext }}
                  </div>
                  <!-- eslint-disable vue/no-v-html -->
                  <div
                    v-if="sheetElementTooltipResolved.item.description"
                    class="item-tooltip-description"
                    v-html="sheetElementTooltipResolved.item.description"
                  />
                  <!-- eslint-enable vue/no-v-html -->
                </div>
              </div>
            </template>
            <!-- Rune: comme RuneSelector -->
            <template v-else-if="sheetElementTooltipResolved.type === 'rune'">
              <div class="rune-tooltip">
                <div class="rune-tooltip-content">
                  <div class="rune-tooltip-header">
                    <div class="rune-tooltip-name">{{ sheetElementTooltipResolved.rune.name }}</div>
                  </div>
                  <!-- eslint-disable vue/no-v-html -->
                  <div
                    v-if="sheetElementTooltipResolved.rune.descriptionHtml"
                    class="rune-tooltip-description tooltip-game-description"
                    v-html="sheetElementTooltipResolved.rune.descriptionHtml"
                  />
                  <!-- eslint-enable vue/no-v-html -->
                </div>
              </div>
            </template>
            <!-- Spell: image + nom + description -->
            <template v-else-if="sheetElementTooltipResolved.type === 'spell'">
              <div class="item-tooltip">
                <div class="item-tooltip-content">
                  <div class="item-tooltip-header">
                    <img
                      v-if="
                        (sheetElementTooltipResolved.spell as { image?: { full: string } }).image
                          ?.full
                      "
                      :src="
                        getSpellImageUrl(
                          versionForImages,
                          (sheetElementTooltipResolved.spell as { image?: { full: string } }).image!
                            .full
                        )
                      "
                      :alt="sheetElementTooltipResolved.spell.name"
                      class="item-tooltip-image"
                    />
                    <div class="item-tooltip-text">
                      <div class="item-tooltip-name">
                        {{ sheetElementTooltipResolved.spell.name }}
                      </div>
                    </div>
                  </div>
                  <!-- eslint-disable vue/no-v-html -->
                  <div
                    v-if="sheetElementTooltipResolved.spell.description"
                    class="item-tooltip-description tooltip-game-description"
                    v-html="sheetElementTooltipResolved.spell.description"
                  />
                  <!-- eslint-enable vue/no-v-html -->
                </div>
              </div>
            </template>
            <template v-else-if="sheetElementTooltipResolved.type === 'shard'">
              <div class="item-tooltip">
                <div class="item-tooltip-content">
                  <div class="item-tooltip-header">
                    <div class="item-tooltip-text">
                      <div class="item-tooltip-name">
                        {{ sheetElementTooltipResolved.name }}
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="sheetElementTooltipResolved.description"
                    class="item-tooltip-description"
                  >
                    {{ sheetElementTooltipResolved.description }}
                  </div>
                </div>
              </div>
            </template>
            <!-- Path: icône colorée + nom -->
            <template v-else-if="sheetElementTooltipResolved.type === 'path'">
              <div class="rune-tooltip px-3 py-2">
                <div class="rune-tooltip-header">
                  <span
                    v-if="sheetPathTooltipMaskStyle"
                    class="rune-path-tooltip-icon"
                    role="img"
                    :aria-label="sheetElementTooltipResolved.name"
                    :style="sheetPathTooltipMaskStyle"
                  />
                  <div class="rune-tooltip-name text-sm font-semibold text-accent">
                    {{ sheetElementTooltipResolved.name }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </Teleport>
      </div>

      <!-- Face arrière : description ou stats theorycraft -->
      <div v-if="canShowCardBack" class="build-card-back">
        <TheorycraftCardStatsBack
          v-if="flipBackFace === 'stats'"
          :stats="buildStore.calculatedStats"
          :level="buildStore.statsLevel"
          :partype="(selectedChampion as { partype?: string } | null)?.partype"
          :active-item-count="theorycraftActiveItemCount"
          :stack-count="theorycraftStackCount"
        />
        <template v-else>
          <div
            v-if="showBackHeader"
            class="back-header"
            :class="{ 'back-header--without-selector': !showBackVariantSelector }"
          >
            <div class="back-header-slot back-header-slot--left">
              <button
                v-if="showBackVariantSelector && !forScreenshot"
                ref="variantsTriggerRef"
                class="variants-count-indicator variants-count-indicator--back"
                type="button"
                @click.stop="toggleVariantsPopover"
              >
                <div
                  class="variants-poker-icon"
                  :title="`${totalVariantCount} variante${totalVariantCount > 1 ? 's' : ''}`"
                >
                  <span
                    v-for="n in Math.max(1, Math.min(totalVariantCount, 4))"
                    :key="`back-variant-card-${n}`"
                    class="variants-poker-card"
                    :style="{
                      transform: `translateX(${(n - 1) * 4}px) rotate(${(n - 1) * 4}deg)`,
                      zIndex: n,
                    }"
                  />
                  <span class="variants-poker-badge">
                    {{ totalVariantCount }}
                  </span>
                </div>
              </button>
            </div>
            <span class="back-title">
              {{ activeDescriptionTitle }}
            </span>
            <div class="back-header-slot back-header-slot--right">
              <label
                v-if="showDescriptionToggle"
                class="back-description-toggle"
                :class="{ 'is-disabled': readonly }"
              >
                <input
                  class="back-description-toggle-input"
                  type="checkbox"
                  :checked="descriptionMode === 'single'"
                  :disabled="readonly"
                  @change="toggleCommonDescription(($event.target as HTMLInputElement).checked)"
                />
                <span
                  class="back-description-toggle-track"
                  :class="{ 'is-active': descriptionMode === 'single' }"
                >
                  <span class="back-description-toggle-thumb" />
                </span>
              </label>
            </div>
          </div>
          <div class="back-description-panel">
            <DescriptionVideoPreviews
              v-if="activeDescriptionValue?.trim()"
              class="back-description-previews"
              :text="activeDescriptionValue"
            />
            <DescriptionEditor
              v-if="!readonly"
              :model-value="activeDescriptionValue"
              @update:model-value="updateActiveDescription"
            />
            <!-- eslint-disable vue/no-v-html -->
            <div v-else class="back-description-readonly" v-html="readonlyDescriptionHtml"></div>
            <!-- eslint-enable vue/no-v-html -->
          </div>
        </template>
      </div>
    </div>
    <!-- end .flip-container -->

    <!-- Items Manager (under the card): drag & drop, remove & reset items (seulement si pas readonly) -->
    <div v-if="!readonly" class="items-manager">
      <div class="items-manager-header">
        <div class="items-manager-tabs">
          <button
            class="items-manager-tab-btn"
            :class="{ 'is-active': !showItemStats }"
            type="button"
            @click="showItemStats = false"
          >
            {{ t('buildCard.itemsManagement') }}
          </button>
          <button
            class="items-manager-tab-btn"
            :class="{ 'is-active': showItemStats }"
            type="button"
            @click="showItemStats = true"
          >
            Stats items
          </button>
        </div>
        <div class="items-manager-header-actions">
          <span
            v-if="isTheorycraftItemsToggleMode && buildItems.length > 0"
            class="items-manager-active-count"
          >
            {{ theorycraftActiveItemsLabel }}
          </span>
          <button class="items-reset-btn" type="button" @click="resetItemsOnly">
            {{ t('buildCard.resetItems') }}
          </button>
        </div>
      </div>
      <div v-if="!showItemStats">
        <p v-if="isTheorycraftItemsToggleMode && buildItems.length > 0" class="items-manager-hint">
          {{ t('buildCard.itemsClickToToggle') }}
        </p>
        <p v-if="itemsToggleLimitMessage" class="items-manager-limit-message">
          {{ itemsToggleLimitMessage }}
        </p>
        <div v-if="buildItems.length === 0" class="items-manager-empty">
          {{ t('buildCard.noItems') }}
        </div>
        <div v-else>
          <div class="items-manager-groups">
            <div class="items-manager-group">
              <span class="items-manager-group-label">Starters</span>
              <div class="items-manager-inline">
                <template
                  v-for="(entry, rowIndex) in managerStarterItems"
                  :key="`starter-${entry.index}-${entry.item.id}`"
                >
                  <div class="items-manager-inline-cell">
                    <img
                      :src="getItemImageUrl(versionForImages, entry.item.image.full)"
                      :alt="entry.item.name"
                      class="items-manager-inline-icon"
                      :class="itemManagerIconClass(entry.index)"
                      :title="itemManagerTitle(entry)"
                      :draggable="!props.build && !isTheorycraftItemsToggleMode"
                      @click="onItemManagerClick(entry.index)"
                      @dragstart="onItemDragStart(entry.index, $event)"
                      @dragover="onItemDragOver(entry.index, $event)"
                      @drop="onItemDrop(entry.index, $event)"
                      @dragend="onItemDragEnd"
                    />
                    <TheorycraftItemStackControls
                      v-if="isTheorycraftItemsToggleMode"
                      :index="entry.index"
                      :item-id="entry.item.id"
                    />
                  </div>
                  <span
                    v-if="rowIndex < managerStarterItems.length - 1"
                    class="items-manager-inline-separator"
                    >→</span
                  >
                </template>
                <span v-if="managerStarterItems.length === 0" class="items-manager-empty">-</span>
              </div>
            </div>

            <div class="items-manager-group">
              <span class="items-manager-group-label">Bottes</span>
              <div class="items-manager-inline">
                <template
                  v-for="(entry, rowIndex) in managerBootsItems"
                  :key="`boots-${entry.index}-${entry.item.id}`"
                >
                  <div class="items-manager-inline-cell">
                    <img
                      :src="getItemImageUrl(versionForImages, entry.item.image.full)"
                      :alt="entry.item.name"
                      class="items-manager-inline-icon"
                      :class="itemManagerIconClass(entry.index)"
                      :title="itemManagerTitle(entry)"
                      :draggable="!props.build && !isTheorycraftItemsToggleMode"
                      @click="onItemManagerClick(entry.index)"
                      @dragstart="onItemDragStart(entry.index, $event)"
                      @dragover="onItemDragOver(entry.index, $event)"
                      @drop="onItemDrop(entry.index, $event)"
                      @dragend="onItemDragEnd"
                    />
                    <TheorycraftItemStackControls
                      v-if="isTheorycraftItemsToggleMode"
                      :index="entry.index"
                      :item-id="entry.item.id"
                    />
                  </div>
                  <span
                    v-if="rowIndex < managerBootsItems.length - 1"
                    class="items-manager-inline-separator"
                    >→</span
                  >
                </template>
                <span v-if="managerBootsItems.length === 0" class="items-manager-empty">-</span>
              </div>
            </div>

            <div class="items-manager-group">
              <span class="items-manager-group-label">Core</span>
              <div class="items-manager-inline">
                <template
                  v-for="(entry, rowIndex) in managerCoreItems"
                  :key="`core-${entry.index}-${entry.item.id}`"
                >
                  <div class="items-manager-inline-cell">
                    <img
                      :src="getItemImageUrl(versionForImages, entry.item.image.full)"
                      :alt="entry.item.name"
                      class="items-manager-inline-icon"
                      :class="itemManagerIconClass(entry.index)"
                      :title="itemManagerTitle(entry)"
                      :draggable="!props.build && !isTheorycraftItemsToggleMode"
                      @click="onItemManagerClick(entry.index)"
                      @dragstart="onItemDragStart(entry.index, $event)"
                      @dragover="onItemDragOver(entry.index, $event)"
                      @drop="onItemDrop(entry.index, $event)"
                      @dragend="onItemDragEnd"
                    />
                    <TheorycraftItemStackControls
                      v-if="isTheorycraftItemsToggleMode"
                      :index="entry.index"
                      :item-id="entry.item.id"
                    />
                  </div>
                  <span
                    v-if="rowIndex < managerCoreItems.length - 1"
                    class="items-manager-inline-separator"
                    >→</span
                  >
                </template>
                <span v-if="managerCoreItems.length === 0" class="items-manager-empty">-</span>
              </div>
            </div>

            <div class="items-manager-group">
              <span class="items-manager-group-label">Final</span>
              <div class="items-manager-inline">
                <template
                  v-for="(entry, rowIndex) in managerFinalItems"
                  :key="`final-${entry.index}-${entry.item.id}`"
                >
                  <div class="items-manager-inline-cell">
                    <img
                      :src="getItemImageUrl(versionForImages, entry.item.image.full)"
                      :alt="entry.item.name"
                      class="items-manager-inline-icon"
                      :class="itemManagerIconClass(entry.index)"
                      :title="itemManagerTitle(entry)"
                      :draggable="!props.build && !isTheorycraftItemsToggleMode"
                      @click="onItemManagerClick(entry.index)"
                      @dragstart="onItemDragStart(entry.index, $event)"
                      @dragover="onItemDragOver(entry.index, $event)"
                      @drop="onItemDrop(entry.index, $event)"
                      @dragend="onItemDragEnd"
                    />
                    <TheorycraftItemStackControls
                      v-if="isTheorycraftItemsToggleMode"
                      :index="entry.index"
                      :item-id="entry.item.id"
                    />
                  </div>
                  <span
                    v-if="rowIndex < managerFinalItems.length - 1"
                    class="items-manager-inline-separator"
                    >→</span
                  >
                </template>
                <span v-if="managerFinalItems.length === 0" class="items-manager-empty">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="items-manager-stats">
        <p class="items-manager-stats-note">
          {{ t('buildCard.itemsStatsNote') }}
        </p>
        <div v-if="itemStatsRows.length === 0" class="items-manager-empty">
          {{ t('buildCard.itemsStatsEmpty') }}
        </div>
        <div v-else class="items-manager-stats-grid">
          <div v-for="row in itemStatsRows" :key="row.key" class="items-manager-stats-row">
            <span class="items-manager-stats-label">{{ row.label }}</span>
            <span class="items-manager-stats-value">{{ row.value }}</span>
          </div>
        </div>
        <div
          v-if="isTheorycraftItemsToggleMode && theorycraftItemModifierRows.length > 0"
          class="items-manager-modifiers"
        >
          <p class="items-manager-modifiers__title">{{ t('theorycraft.items.modifiersTitle') }}</p>
          <div class="items-manager-modifiers__grid">
            <div
              v-for="(row, index) in theorycraftItemModifierRows"
              :key="`modifier-${row.itemId}-${index}`"
              class="items-manager-modifiers__row"
            >
              <span class="items-manager-modifiers__label">{{ row.label }}</span>
              <span class="items-manager-modifiers__value">{{ row.detail }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted, onMounted, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { isBootsItem, isStarterItem } from '@lelanation/builds-ui'
import { sumStarterDrainStats, getGoldPer10FromItem } from '@lelanation/builds-stats'
import type { Build, SubBuild, Item, Role, SkillOrder } from '@lelanation/shared-types'
import { activeItemLimitLabel } from '~/utils/theorycraftItems'
import { useBuildStore } from '~/stores/BuildStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import {
  getChampionImageUrl,
  getChampionSplashImageUrl,
  getChampionSpellImageUrl,
  getChampionPassiveImageUrl,
  getSpellImageUrl,
  getRunePathColor,
  getRunePathImageUrl,
  getRunePathMaskStyle,
  getRuneImageUrl,
  getItemImageUrl,
} from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'
import { formatLethality, formatPenetrationPercentFlat } from '~/utils/formatItemStats'
import { linkifyDescription } from '~/utils/linkifyDescription'
import { sanitizeDescriptionHtml } from '~/utils/sanitizeDescriptionHtml'
import {
  formatSpellDetailedTextsHtml,
  formatSpellHeaderStatsHtml,
  formatSummonerSpellTooltipHtml,
  resolveSpellTooltipBodyHtml,
} from '~/utils/gameTooltipFormatter'
import { resolveSummonerSpellFromRef } from '~/utils/summonerSpellResolver'
import { fixedTooltipStyleFromPointer, type TooltipPointer } from '~/utils/tooltipPosition'
import { formatRuneTooltipHtml } from '~/utils/formatTooltipMarkupHtml'
import DescriptionEditor from '~/components/Build/DescriptionEditor.vue'
import TheorycraftCardStatsBack from '~/components/Build/TheorycraftCardStatsBack.vue'
import TheorycraftItemStackControls from '~/components/Build/TheorycraftItemStackControls.vue'
import DescriptionVideoPreviews from '~/components/Build/DescriptionVideoPreviews.vue'

interface RegionsPayload {
  regionsData: Record<string, [string, string]>
  championMapping: Record<string, string>
}

const DEFAULT_REGION_COLORS: [string, string] = ['#BBA077', '#1E2328']
let regionsPayloadPromise: Promise<RegionsPayload | null> | null = null

const loadRegionsPayload = (): Promise<RegionsPayload | null> => {
  if (!import.meta.client) return Promise.resolve(null)
  if (!regionsPayloadPromise) {
    regionsPayloadPromise = $fetch<RegionsPayload>('/data/regions.json').catch(() => null)
  }
  return regionsPayloadPromise
}

interface Props {
  build?: Build | null // Build optionnel - si non fourni, utilise currentBuild du store
  readonly?: boolean // Si true, désactive les interactions (bouton reset, toggle rôles, etc.)
  sheetTooltips?: boolean // Active les tooltips de la sheet (summoners/runes/shards/items)
  hideTopActions?: boolean
  highlightMissingFields?: boolean
  /** En readonly : variante à afficher par défaut (null = build principal). Ex. quand la recherche ne matche qu'une variante. */
  initialDisplayedVariantIndex?: number | null
  /** Capture PNG serveur : masque flèches / chrome superflu. */
  forScreenshot?: boolean
  /**
   * Capture : true/force splash ou false/portrait. `null` = préférence utilisateur.
   * (Une prop `boolean` optionnelle seule se voit appliquer `false` par défaut par Vue → cassait le mode splash.)
   */
  championSplashOverride?: boolean | null
  /** Mode theorycraft : clic sur une zone émet select-region au lieu de naviguer. */
  selectionMode?: 'none' | 'theorycraft'
  /** Région actuellement sélectionnée (surbrillance en mode theorycraft). */
  activeSelectionRegion?: 'champion' | 'items' | 'runes' | null
  /** Contenu affiché au verso de la card lors du flip. */
  flipBackFace?: 'description' | 'stats'
  /** Contrôle externe du flip (ex. bouton stats theorycraft). */
  flipped?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  build: null,
  readonly: false,
  sheetTooltips: false,
  hideTopActions: false,
  highlightMissingFields: false,
  initialDisplayedVariantIndex: null,
  forScreenshot: false,
  championSplashOverride: null,
  selectionMode: 'none',
  activeSelectionRegion: null,
  flipBackFace: 'description',
  flipped: undefined,
})
type BuildTag = NonNullable<Build['tags']>[number]

const emit = defineEmits<{
  /** Émis quand la variante affichée change. null = build principal. */
  'variant-change': [subIndex: number | null]
  /** Mode theorycraft : clic sur une zone éditable de la card. */
  'select-region': ['champion' | 'items' | 'runes']
  'update:flipped': [value: boolean]
}>()

const buildStore = useBuildStore()
const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()
const localePath = useLocalePath()
const route = useRoute()
const { locale, t } = useI18n()
const { isLayoutScaled } = useLayoutScaled()
const hideTopActions = computed(() => props.hideTopActions)

function regionSelectionClass(region: 'champion' | 'items' | 'runes'): Record<string, boolean> {
  return {
    'build-card-region--selectable': props.selectionMode === 'theorycraft',
    'build-card-region--active':
      props.selectionMode === 'theorycraft' && props.activeSelectionRegion === region,
  }
}

function onSelectRegion(region: 'champion' | 'items' | 'runes', event?: MouseEvent) {
  if (props.selectionMode !== 'theorycraft' || props.readonly) return
  event?.stopPropagation()
  emit('select-region', region)
}

// Global tooltip preference (shared state via composable)
const { tooltipsEnabled } = useTooltipsPreference()
const { championSplashEnabled } = useChampionSplashPreference()
const showChampionSplashArt = computed(() => {
  const o = props.championSplashOverride
  if (o === true || o === false) return o
  return championSplashEnabled.value
})

// effectiveSheetTooltips: respect both the prop and the global preference
const effectiveSheetTooltips = computed(() => props.sheetTooltips && tooltipsEnabled.value)

// ── Flip (mode readonly) ──────────────────────────────────────────────────
const localFlipped = ref(false)

watch(
  () => props.flipped,
  value => {
    if (typeof value !== 'boolean') return
    if (localFlipped.value !== value) localFlipped.value = value
  },
  { immediate: true }
)

watch(localFlipped, value => {
  if (typeof props.flipped === 'boolean') emit('update:flipped', value)
})
/** Index de la variante affichée localement (null = build principal). Utilisé en mode readonly. */
const localDisplayedSubIndex = ref<number | null>(null)

// En readonly, initialiser la variante affichée depuis la prop (ex. recherche qui ne matche qu'une variante)
watch(
  () => [props.build?.id, props.initialDisplayedVariantIndex] as const,
  ([_buildId, initialIdx]) => {
    if (!props.readonly || !props.build) return
    const idx = initialIdx ?? null
    const subs = (props.build.subBuilds ?? []) as SubBuild[]
    if (idx === null || (typeof idx === 'number' && idx >= 0 && idx < subs.length)) {
      localDisplayedSubIndex.value = idx
    }
  },
  { immediate: true }
)
const variantsPopoverOpen = ref(false)
const variantsPopoverRef = ref<HTMLElement | null>(null)
const variantsTriggerRef = ref<HTMLElement | null>(null)
const championTitleBoxRef = ref<HTMLElement | null>(null)
const championNameRef = ref<HTMLElement | null>(null)
const copyPickerOpen = ref(false)
const copySource = ref<'main' | number>('main')
const copyDestinations = ref<('main' | number)[]>([])
const openSkillDropdown = ref<string | null>(null)
const copySelection = ref({
  items: true,
  runes: true,
  shards: true,
  summonerSpells: true,
  tags: true,
  firstThreeUps: false,
  skillUpOrder: false,
})

/** Liste des sous-builds du build affiché (prop ou store). */
const buildSubBuilds = computed<SubBuild[]>(() => {
  const b = props.build ?? buildStore.currentBuild
  return (b?.subBuilds as SubBuild[] | undefined) ?? []
})
const totalVariantCount = computed(() => buildSubBuilds.value.length + 1)

const hasChampion = computed(() => !!buildStore.currentBuild?.champion)
const activeVariantKey = computed<'main' | number>(() =>
  props.readonly ? (localDisplayedSubIndex.value ?? 'main') : buildStore.displayedVariant
)
const descriptionMode = computed(
  () => (props.build ?? buildStore.currentBuild)?.descriptionMode ?? 'single'
)
const canShowReadonlyDescription = computed(
  () => props.readonly && Boolean(activeDescriptionValue.value?.trim())
)
const canShowCardBack = computed(() => {
  if (props.flipBackFace === 'stats' && props.selectionMode === 'theorycraft') {
    return hasChampion.value
  }
  return canShowReadonlyDescription.value || (!props.readonly && hasChampion.value)
})
const isBuilderPage = computed(
  () => route.path.includes('/builds/create') || route.path.includes('/builds/edit/')
)
const canEditSkillOrder = computed(
  () =>
    (isBuilderPage.value || props.selectionMode === 'theorycraft') &&
    !props.readonly &&
    !props.build
)
const showBackHeader = computed(() => isBuilderPage.value || showBackVariantSelector.value)
const showDescriptionToggle = computed(() => isBuilderPage.value && buildSubBuilds.value.length > 0)
const showBackVariantSelector = computed(
  () => buildSubBuilds.value.length > 0 && descriptionMode.value === 'multiple'
)
const copyAllSelected = computed(
  () =>
    copySelection.value.items &&
    copySelection.value.runes &&
    copySelection.value.shards &&
    copySelection.value.summonerSpells &&
    copySelection.value.tags &&
    copySelection.value.firstThreeUps &&
    copySelection.value.skillUpOrder
)
const hasCopySelection = computed(
  () =>
    copySelection.value.items ||
    copySelection.value.runes ||
    copySelection.value.shards ||
    copySelection.value.summonerSpells ||
    copySelection.value.tags ||
    copySelection.value.firstThreeUps ||
    copySelection.value.skillUpOrder
)
const canApplyCopy = computed(() => hasCopySelection.value && copyDestinations.value.length > 0)
const regionsPayload = ref<RegionsPayload | null>(null)

const cardAuthor = computed(() => buildStore.currentBuild?.author ?? '')
const cardVisibility = computed<'public' | 'private'>(() => {
  return (buildStore.currentBuild?.visibility as 'public' | 'private' | undefined) ?? 'public'
})

const activeDescriptionTitle = computed(() => {
  if (!isBuilderPage.value) {
    return 'Description'
  }
  if (descriptionMode.value === 'single' || buildSubBuilds.value.length === 0) {
    return 'Description commune'
  }
  return 'Description unique'
})

const activeDescriptionValue = computed(() => {
  const build = props.build ?? buildStore.currentBuild
  if (!build) return ''
  if (descriptionMode.value === 'single' || buildSubBuilds.value.length === 0) {
    return build.description ?? ''
  }
  if (activeVariantKey.value === 'main') {
    return build.description ?? ''
  }
  return build.subBuilds?.[activeVariantKey.value]?.description ?? ''
})
const readonlyDescriptionHtml = computed(() => {
  const text = activeDescriptionValue.value?.trim()
  if (!text) return 'Aucune description'
  if (text.includes('<')) return sanitizeDescriptionHtml(text)
  return linkifyDescription(text)
})

function selectVariant(idx: number | null) {
  if (props.readonly) {
    localDisplayedSubIndex.value = idx
    emit('variant-change', idx)
  } else if (idx === null) {
    buildStore.showMainBuild()
  } else {
    buildStore.showSubBuild(idx)
  }
  variantsPopoverOpen.value = false
}

function createVariantFromBack() {
  buildStore.createSubBuild()
}

function toggleVariantsPopover() {
  variantsPopoverOpen.value = !variantsPopoverOpen.value
  if (!variantsPopoverOpen.value) closeCopyPicker()
}

function toggleFlipped() {
  localFlipped.value = !localFlipped.value
}

function setDescMode(mode: 'single' | 'multiple') {
  if (props.readonly || props.build) return
  buildStore.setDescriptionMode(mode)
}

function toggleCommonDescription(enabled: boolean) {
  setDescMode(enabled ? 'single' : 'multiple')
}

function updateActiveDescription(value: string) {
  if (props.readonly || props.build) return
  if (descriptionMode.value === 'single' || activeVariantKey.value === 'main') {
    buildStore.setDescription(value)
    return
  }
  buildStore.setSubBuildDescription(activeVariantKey.value, value)
}

function openCopyPicker() {
  if (props.readonly || props.build) return
  copySource.value = buildStore.displayedVariant
  copyDestinations.value = []
  copyPickerOpen.value = true
}

function closeCopyPicker() {
  copyPickerOpen.value = false
  copyDestinations.value = []
}

function toggleCopyDestination(key: 'main' | number, checked: boolean) {
  if (checked) {
    if (!copyDestinations.value.includes(key))
      copyDestinations.value = [...copyDestinations.value, key]
  } else {
    copyDestinations.value = copyDestinations.value.filter(k => k !== key)
  }
}

function toggleCopyAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  copySelection.value = {
    items: checked,
    runes: checked,
    shards: checked,
    summonerSpells: checked,
    tags: checked,
    firstThreeUps: checked,
    skillUpOrder: checked,
  }
}

function applyCopySelection() {
  if (props.readonly || props.build) return
  const source =
    copySource.value === 'main' || copySource.value === null ? 'main' : copySource.value
  const fields = {
    items: copySelection.value.items,
    runes: copySelection.value.runes,
    shards: copySelection.value.shards,
    summonerSpells: copySelection.value.summonerSpells,
    tags: copySelection.value.tags,
    firstThreeUps: copySelection.value.firstThreeUps,
    skillUpOrder: copySelection.value.skillUpOrder,
  }
  for (const dest of copyDestinations.value) {
    if (dest === source) continue
    const destKey = dest === 'main' || dest === null ? 'main' : dest
    buildStore.copyVariantFieldsTo(source, destKey, fields)
  }
  closeCopyPicker()
  variantsPopoverOpen.value = false
}

function onDocumentPointerDown(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target) return
  const targetElement = target as HTMLElement

  if (
    openSkillDropdown.value &&
    !targetElement.closest('.skill-slot-dropdown') &&
    !targetElement.closest('.skill-slot-trigger')
  ) {
    openSkillDropdown.value = null
  }

  if (!variantsPopoverOpen.value) return
  if (variantsPopoverRef.value?.contains(target) || variantsTriggerRef.value?.contains(target))
    return
  variantsPopoverOpen.value = false
  closeCopyPicker()
}

function onMainTitleInput(title: string) {
  if (props.readonly || props.build) return
  buildStore.setName(title)
}

function onSubTitleInput(index: number, title: string) {
  if (props.readonly || props.build) return
  buildStore.setSubBuildTitle(index, title)
}

function updateCardAuthor(author: string) {
  if (props.readonly || props.build) return
  buildStore.setAuthor(author)
}

function setCardVisibility(visibility: 'public' | 'private') {
  if (props.readonly || props.build) return
  buildStore.setVisibility(visibility)
}

/** Nom d'affichage de l'item — résolu depuis itemsStore (comme dans ItemSelector) */
function getItemDisplayName(item: { id: string; name?: string }): string {
  return itemsStore.items.find(i => i.id === item.id)?.name ?? item.name ?? item.id
}

/** Nom d'affichage d'un sort d'invocateur — résolu depuis summonerSpellsStore */
function getSummonerSpellDisplayName(
  spell: { id?: string; key?: string; name?: string } | null | undefined
): string {
  if (!spell) return ''
  const id = String(spell.id ?? spell.key ?? '')
  if (id) {
    const found = summonerSpellsStore.getSpellById(id)
    if (found?.name) return found.name
  }
  return spell.name ?? ''
}

function sheetTooltip(label?: string | null, fallback = ''): string {
  if (!effectiveSheetTooltips.value) return ''
  return label?.trim() || fallback
}

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const showTooltip = ref(false)
const tooltipRef = ref<HTMLElement | null>(null)
const championPortraitRef = ref<HTMLElement | null>(null)

// Fixed positioning for the teleported tooltip (follows cursor)
const tooltipFixedStyle = ref<Record<string, string>>({})
const tooltipPointer = ref<TooltipPointer>({ x: 0, y: 0 })

function setTooltipPointer(event: MouseEvent) {
  tooltipPointer.value = { x: event.clientX, y: event.clientY }
}

function applyChampionTooltipPosition() {
  if (!tooltipRef.value || !showTooltip.value) return
  tooltipFixedStyle.value = fixedTooltipStyleFromPointer(tooltipRef.value, tooltipPointer.value)
}

const onChampionMouseEnter = (event: MouseEvent) => {
  if (!tooltipsEnabled.value) return
  setTooltipPointer(event)
  showTooltip.value = true
  championPortraitRef.value = event.currentTarget as HTMLElement
}

const onChampionMouseMove = (event: MouseEvent) => {
  if (!showTooltip.value) return
  setTooltipPointer(event)
  applyChampionTooltipPosition()
}

let championTooltipHideTimer: ReturnType<typeof setTimeout> | null = null

const onChampionMouseLeave = () => {
  championTooltipHideTimer = setTimeout(() => {
    showTooltip.value = false
  }, 120)
}

const onChampionTooltipMouseEnter = () => {
  if (championTooltipHideTimer) {
    clearTimeout(championTooltipHideTimer)
    championTooltipHideTimer = null
  }
  showTooltip.value = true
}

const onChampionTooltipMouseLeave = () => {
  if (championTooltipHideTimer) {
    clearTimeout(championTooltipHideTimer)
    championTooltipHideTimer = null
  }
  showTooltip.value = false
}

// ── Sheet element tooltip (items, runes, spells, shards) — contenu résolu de façon réactive ───
type SheetTooltipType = 'item' | 'rune' | 'spell' | 'shard' | 'path'
type SheetTooltipPayload =
  | { id: string; name?: string }
  | number
  | { id?: string; key?: string; name?: string }

const sheetElementTooltip = ref<{
  show: boolean
  type: SheetTooltipType
  payload: SheetTooltipPayload
  fallback: string
  anchorEl: HTMLElement | null
}>({
  show: false,
  type: 'item',
  payload: { id: '' },
  fallback: '',
  anchorEl: null,
})
const sheetElementTooltipRef = ref<HTMLElement | null>(null)
const sheetElementTooltipFixedStyle = ref<Record<string, string>>({})

function onSheetElementEnter(
  ev: MouseEvent,
  type: SheetTooltipType,
  payload: SheetTooltipPayload,
  fallback: string
) {
  if (!effectiveSheetTooltips.value) return
  setTooltipPointer(ev)
  const el = ev.currentTarget as HTMLElement
  sheetElementTooltip.value = { show: true, type, payload, fallback: fallback || '', anchorEl: el }
}

function onSheetElementMove(ev: MouseEvent) {
  if (!sheetElementTooltip.value.show) return
  setTooltipPointer(ev)
  applySheetElementTooltipPosition()
}

function onSheetElementLeave() {
  sheetElementTooltip.value = { ...sheetElementTooltip.value, show: false, anchorEl: null }
}

// Données complètes pour le tooltip (comme ItemSelector/RuneSelector)
const sheetElementTooltipResolved = computed(() => {
  const tt = sheetElementTooltip.value
  if (!tt.show) return null
  switch (tt.type) {
    case 'item': {
      const p = tt.payload as { id: string; name?: string }
      const item = itemsStore.items.find(i => i.id === p?.id)
      return item ? { type: 'item' as const, item } : null
    }
    case 'rune': {
      const id = tt.payload as number
      const rune = findRuneInStore(id)
      if (!rune) return null
      return {
        type: 'rune' as const,
        rune: {
          ...rune,
          descriptionHtml: formatRuneTooltipHtml(rune),
        },
      }
    }
    case 'spell': {
      const p = tt.payload as {
        id?: string
        key?: string
        name?: string
        image?: { full?: string }
      }
      const spell = resolveSummonerSpellFromRef(
        p,
        summonerSpellsStore.getSpellById,
        summonerSpellsStore.spells
      )
      return spell
        ? {
            type: 'spell' as const,
            spell: { ...spell, description: formatSummonerSpellTooltipHtml(spell) },
          }
        : null
    }
    case 'shard': {
      const id = tt.payload as number
      const name = getShardNameById(id) || tt.fallback
      const description = getShardDescriptionById(id)
      return { type: 'shard' as const, name, description }
    }
    case 'path': {
      const id = tt.payload as number
      const path = runesStore.getRunePathById(id)
      if (!path) return { type: 'path' as const, name: tt.fallback }
      return {
        type: 'path' as const,
        name: path.name,
        pathId: path.id,
        pathIcon: path.icon,
      }
    }
    default:
      return null
  }
})

const sheetPathTooltipMaskStyle = computed(() => {
  const resolved = sheetElementTooltipResolved.value
  if (!resolved || resolved.type !== 'path' || !resolved.pathIcon) return null
  return getRunePathMaskStyle(
    versionForImages.value,
    resolved.pathIcon,
    resolved.pathId,
    resolved.name
  )
})

function applySheetElementTooltipPosition() {
  const tooltipEl = sheetElementTooltipRef.value
  if (!sheetElementTooltip.value.show || !tooltipEl) return
  sheetElementTooltipFixedStyle.value = fixedTooltipStyleFromPointer(
    tooltipEl,
    tooltipPointer.value
  )
}

watch(
  () => sheetElementTooltip.value.show,
  async newValue => {
    if (newValue) {
      await nextTick()
      applySheetElementTooltipPosition()
      window.addEventListener('resize', applySheetElementTooltipPosition)
    } else {
      window.removeEventListener('resize', applySheetElementTooltipPosition)
    }
  }
)

watch(sheetElementTooltipResolved, async () => {
  if (!sheetElementTooltip.value.show) return
  await nextTick()
  applySheetElementTooltipPosition()
})

onUnmounted(() => {
  window.removeEventListener('resize', applySheetElementTooltipPosition)
})

// Utiliser le build en prop si fourni, sinon le build courant du store
// En mode readonly avec une variante sélectionnée, on fusionne le sub-build avec le build parent
const displayBuild = computed<Build | null>(() => {
  const baseBuild = props.build || buildStore.currentBuild
  if (!baseBuild) return null

  // Mode builder (pas de prop build) : utiliser displayedBuild du store
  if (!props.build) {
    return buildStore.displayedBuild ?? baseBuild
  }

  // Mode readonly : utiliser la variante locale si sélectionnée
  if (props.readonly && localDisplayedSubIndex.value !== null) {
    const sub = baseBuild.subBuilds?.[localDisplayedSubIndex.value] as SubBuild | undefined
    if (sub) {
      return {
        ...baseBuild,
        items: sub.items,
        runes: sub.runes,
        shards: sub.shards,
        summonerSpells: sub.summonerSpells,
        skillOrder: sub.skillOrder,
        roles: sub.roles,
        tags: sub.tags !== undefined ? sub.tags : (baseBuild.tags ?? []),
        description: sub.description ?? baseBuild.description,
        gameVersion: sub.gameVersion || baseBuild.gameVersion,
      } as Build
    }
  }

  return baseBuild
})

const missingFieldChecks = computed(() => {
  // En builder, utiliser le build affiche (main ou variante) pour surligner
  // les champs manquants du contexte courant.
  const build = displayBuild.value ?? (props.build || buildStore.currentBuild)
  const firstThreeUps = build?.skillOrder?.firstThreeUps ?? []
  const skillUpOrder = build?.skillOrder?.skillUpOrder ?? []
  const items = build?.items ?? []
  const hasStarter = items.some(i => isStarterItem(i as any))
  const roles = build?.roles ?? []

  return {
    champion: !build?.champion,
    items: !build?.items || build.items.length === 0,
    starterItems: items.length === 0 ? false : !hasStarter,
    roles: roles.length === 0,
    runesPrimary: !(build?.runes?.primary?.pathId && build.runes.primary.keystone),
    runesSecondary: !build?.runes?.secondary?.pathId,
    summonerSpells: !(
      build?.summonerSpells &&
      build.summonerSpells.length === 2 &&
      build.summonerSpells[0] &&
      build.summonerSpells[1]
    ),
    firstThreeUps: firstThreeUps.length !== 3 || firstThreeUps.some(skillKey => !skillKey),
    skillUpOrder: skillUpOrder.length !== 3 || skillUpOrder.some(skillKey => !skillKey),
  }
})

const normalizePercentStat = (value: number | undefined): number => {
  const raw = value ?? 0
  if (!Number.isFinite(raw)) return 0
  return Math.abs(raw) <= 1 ? raw * 100 : raw
}

const selectedChampion = computed(() => {
  const champion = displayBuild.value?.champion || null
  if (!champion) return null
  const fullChampion = (championsStore.champions ?? []).find(c => c.id === champion.id)
  const merged = fullChampion ?? champion
  if (!Array.isArray(merged.spells)) {
    return { ...merged, spells: [] }
  }
  return merged
})

watch(
  () => [selectedChampion.value?.id, riotLocale.value] as const,
  ([championId, lang]) => {
    if (!championId) return
    championsStore.loadChampionDetails(championId, lang).catch(() => undefined)
  },
  { immediate: true }
)

const hexToRgba = (hexColor: string, alpha: number): string => {
  const normalized = hexColor.trim().replace('#', '')
  const isShortHex = normalized.length === 3
  const isLongHex = normalized.length === 6
  if (!isShortHex && !isLongHex) return `rgb(31 79 122 / ${alpha})`
  const fullHex = isShortHex
    ? normalized
        .split('')
        .map(char => `${char}${char}`)
        .join('')
    : normalized
  const r = parseInt(fullHex.slice(0, 2), 16)
  const g = parseInt(fullHex.slice(2, 4), 16)
  const b = parseInt(fullHex.slice(4, 6), 16)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

const hexToRgb = (hexColor: string): [number, number, number] => {
  const normalized = hexColor.trim().replace('#', '')
  const isShortHex = normalized.length === 3
  const isLongHex = normalized.length === 6
  if (!isShortHex && !isLongHex) return [31, 79, 122]
  const fullHex = isShortHex
    ? normalized
        .split('')
        .map(char => `${char}${char}`)
        .join('')
    : normalized
  return [
    parseInt(fullHex.slice(0, 2), 16),
    parseInt(fullHex.slice(2, 4), 16),
    parseInt(fullHex.slice(4, 6), 16),
  ]
}

const mixHexColors = (a: string, b: string, weightA = 0.5): string => {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const wa = Math.max(0, Math.min(1, weightA))
  const wb = 1 - wa
  const r = Math.round(ar * wa + br * wb)
  const g = Math.round(ag * wa + bg * wb)
  const bCh = Math.round(ab * wa + bb * wb)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bCh.toString(16).padStart(2, '0')}`
}

const selectedRegionColors = computed<[string, string]>(() => {
  const championId = selectedChampion.value?.id
  if (!championId) return DEFAULT_REGION_COLORS
  const payload = regionsPayload.value
  if (!payload) return DEFAULT_REGION_COLORS
  const regionKey = payload.championMapping[championId]
  const palette = regionKey ? payload.regionsData[regionKey] : undefined
  return palette ?? DEFAULT_REGION_COLORS
})

const buildCardThemeVars = computed<CSSProperties>(() => {
  const [primaryColor, secondaryColor] = selectedRegionColors.value
  const midColor = mixHexColors(primaryColor, secondaryColor, 0.4)
  return {
    '--card-border-color': primaryColor,
    '--card-border-color-soft': hexToRgba(primaryColor, 0.45),
    '--card-border-gradient-strong': `linear-gradient(130deg, ${primaryColor} 0%, ${midColor} 45%, ${secondaryColor} 100%)`,
    '--card-border-gradient-soft': `linear-gradient(130deg, ${hexToRgba(primaryColor, 0.7)} 0%, ${hexToRgba(midColor, 0.72)} 45%, ${hexToRgba(secondaryColor, 0.82)} 100%)`,
  }
})

const championIconSrc = computed(() => {
  const champion = selectedChampion.value
  if (!champion) return ''
  return getChampionImageUrl(versionForImages.value, champion.image.full)
})

const championSplashSrc = computed(() => {
  const champion = selectedChampion.value
  if (!champion) return ''
  return getChampionSplashImageUrl(versionForImages.value, champion.id)
})

const isDefaultBuildName = (name: string | null | undefined): boolean => {
  if (!name) return true
  const trimmed = name.trim()
  if (!trimmed) return true
  return trimmed.toLowerCase() === 'new build'
}

const cardTitle = computed(() => {
  // Mode builder (pas de build en prop) : utiliser currentBuild + displayedVariant
  if (!props.build && buildStore.currentBuild) {
    const b = buildStore.currentBuild
    if (buildStore.displayedVariant === 'main') {
      if (!isDefaultBuildName(b.name)) {
        return b.name as string
      }
      return selectedChampion.value ? selectedChampion.value.name.toUpperCase() : ''
    }
    const idx = buildStore.displayedVariant as number
    const sub = (b.subBuilds as SubBuild[] | undefined)?.[idx]
    if (sub?.title && sub.title.trim().length > 0) {
      return sub.title
    }
    if (!isDefaultBuildName(b.name)) {
      return b.name as string
    }
    return selectedChampion.value ? selectedChampion.value.name.toUpperCase() : ''
  }

  // Mode readonly avec build en prop : utiliser sub sélectionné localement si présent
  const b = props.build as Build | null
  if (b) {
    if (props.readonly && localDisplayedSubIndex.value !== null) {
      const subs = b.subBuilds as SubBuild[] | undefined
      const sub = subs?.[localDisplayedSubIndex.value]
      if (sub?.title && sub.title.trim().length > 0) {
        return sub.title
      }
    }
    if (!isDefaultBuildName(b.name)) {
      return b.name as string
    }
  }

  // Fallback : nom du champion en majuscules
  return selectedChampion.value ? selectedChampion.value.name.toUpperCase() : ''
})

const CHAMPION_TITLE_FONT_MAX_PX = 15
const CHAMPION_TITLE_FONT_MIN_PX = 8
let championTitleFitRaf = 0
let championTitleResizeObserver: ResizeObserver | null = null

/** Force layout so scrollWidth/scrollHeight reflect the latest font/size. */
function flushLayout(node: HTMLElement): number {
  return node.offsetHeight
}

function fitsChampionTitleInBox(el: HTMLElement, box: HTMLElement): boolean {
  flushLayout(box)
  const tol = 1
  return el.scrollHeight <= box.clientHeight + tol && el.scrollWidth <= box.clientWidth + tol
}

function fitChampionTitle() {
  if (!import.meta.client) return
  const box = championTitleBoxRef.value
  const el = championNameRef.value
  if (!box || !el) return

  el.style.fontSize = `${CHAMPION_TITLE_FONT_MAX_PX}px`
  flushLayout(box)

  if (fitsChampionTitleInBox(el, box)) return

  let low = CHAMPION_TITLE_FONT_MIN_PX
  let high = CHAMPION_TITLE_FONT_MAX_PX
  let best = low
  while (low <= high - 0.25) {
    const mid = (low + high) / 2
    el.style.fontSize = `${mid}px`
    flushLayout(el)
    if (fitsChampionTitleInBox(el, box)) {
      best = mid
      low = mid + 0.25
    } else {
      high = mid - 0.25
    }
  }
  el.style.fontSize = `${best}px`
}

function scheduleFitChampionTitle() {
  if (!import.meta.client) return
  cancelAnimationFrame(championTitleFitRaf)
  championTitleFitRaf = requestAnimationFrame(() => {
    nextTick(() => fitChampionTitle())
  })
}

watch(cardTitle, () => nextTick(() => scheduleFitChampionTitle()))
watch(isLayoutScaled, () => nextTick(() => scheduleFitChampionTitle()))
watch(showChampionSplashArt, () => nextTick(() => scheduleFitChampionTitle()))

const { version: defaultVersion } = useGameVersion()
// Version affichée (build ou courante)
const version = computed(() => displayBuild.value?.gameVersion || defaultVersion.value)
// Version pour les URLs d'images : toujours la version courante (assets disponibles côté serveur)
const versionForImages = defaultVersion

// Rôles
const allRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support']
const selectedRoles = computed(() => displayBuild.value?.roles || [])
/** Paires alignées sur `public/data/regions.json` (shurima, freljord, void, ionia). */
const orderedBuildTags: Array<{ id: BuildTag; label: string; gradient: [string, string] }> = [
  { id: 'pro', label: 'Pro', gradient: ['#bd9700', '#704b00'] },
  { id: 'otp', label: 'OTP', gradient: ['#00b4dd', '#003366'] },
  { id: 'exotique', label: 'Exotique', gradient: ['#6e008a', '#420042'] },
  { id: 'troll', label: 'Troll', gradient: ['#e4b5e4', '#36bfb1'] },
]
const selectedBuildTags = computed(() => displayBuild.value?.tags ?? [])
const visibleBuildTags = computed(() =>
  props.readonly
    ? orderedBuildTags.filter(tag => selectedBuildTags.value.includes(tag.id))
    : orderedBuildTags
)

/** Colonne gauche : bouton variantes + tags (tags toujours sous le bouton quand les deux sont visibles). */
/** Bouton poker variantes (masqué en capture / sans contexte). */
const showVariantTriggerButton = computed(
  () =>
    !props.forScreenshot &&
    ((props.readonly && buildSubBuilds.value.length > 0) || (!props.readonly && hasChampion.value))
)

const showFrontVariantsTagsStack = computed(() => {
  const variantShown = showVariantTriggerButton.value
  const tagsShown = !props.readonly || selectedBuildTags.value.length > 0
  return variantShown || tagsShown
})

/** Même décalage vertical des tags que lorsque le bouton variantes est présent. */
const showVariantsTagColumnSpacer = computed(
  () =>
    showFrontVariantsTagsStack.value &&
    !showVariantTriggerButton.value &&
    (!props.readonly || selectedBuildTags.value.length > 0)
)

const getRoleName = (role: Role): string => {
  const names: Record<Role, string> = {
    top: 'Top',
    jungle: 'Jungle',
    mid: 'Mid',
    adc: 'ADC',
    support: 'Support',
  }
  return names[role]
}

const toggleRole = (role: Role) => {
  if (props.readonly || props.build) return // Ne pas modifier si readonly ou si build en prop
  const currentRoles = selectedRoles.value
  if (currentRoles.includes(role)) {
    // Retirer le rôle
    buildStore.setRoles(currentRoles.filter(r => r !== role))
  } else {
    // Ajouter le rôle
    buildStore.setRoles([...currentRoles, role])
  }
}

const toggleBuildTag = (tag: BuildTag) => {
  if (props.readonly || props.build) return
  const currentTags = selectedBuildTags.value
  if (currentTags.includes(tag)) {
    buildStore.setTags(currentTags.filter(t => t !== tag))
    return
  }
  if (tag === 'troll') {
    buildStore.setTags(['troll'])
    return
  }
  const withoutTroll = currentTags.filter(t => t !== 'troll')
  buildStore.setTags([...withoutTroll, tag])
}

// Get selected runes, spells, and shards
const selectedPrimaryRunes = computed(() => displayBuild.value?.runes)
const selectedSecondaryRunes = computed(() => displayBuild.value?.runes)
const selectedSummonerSpells = computed(() => displayBuild.value?.summonerSpells || [])
const filteredSummonerSpells = computed(() => {
  return selectedSummonerSpells.value.filter(spell => spell !== null && spell !== undefined)
})
const selectedShards = computed(() => displayBuild.value?.shards)
const buildItems = computed(() => {
  const items = displayBuild.value?.items || []
  return items.map(item => {
    const latest = itemsStore.items.find(i => i.id === item.id)
    if (!latest) return item
    return {
      ...latest,
      ...item,
      stats: latest.stats ?? item.stats,
      gold: latest.gold ?? item.gold,
      image: latest.image ?? item.image,
      tags: latest.tags ?? item.tags,
    }
  })
})

const theorycraftActiveItemCount = computed(() => {
  if (props.selectionMode !== 'theorycraft') return 0
  const disabled = new Set(buildStore.theorycraftDisabledItemIndices)
  return buildItems.value.filter((_, index) => !disabled.has(index)).length
})

const theorycraftStackCount = computed(() =>
  Object.values(buildStore.theorycraftStackCounts).reduce(
    (sum, count) => sum + (Number.isFinite(count) && count > 0 ? count : 0),
    0
  )
)

const theorycraftItemModifierRows = computed(() =>
  buildStore.theorycraftItemModifierLines.map(row => ({
    ...row,
    label: row.labelKey ? t(row.labelKey) : row.label,
  }))
)
const showItemStats = ref(false)
const draggingItemIndex = ref<number | null>(null)
const dragOverItemIndex = ref<number | null>(null)
const itemsToggleLimitMessage = ref<string | null>(null)
let itemsToggleLimitTimer: ReturnType<typeof setTimeout> | null = null

const isTheorycraftItemsToggleMode = computed(() => props.selectionMode === 'theorycraft')

const itemsForManagerStats = computed(() => {
  if (isTheorycraftItemsToggleMode.value) {
    return buildStore.getTheorycraftItemsForStats()
  }
  return buildItems.value
})

const theorycraftActiveItemsLabel = computed(() => {
  if (!isTheorycraftItemsToggleMode.value) return ''
  const roles = displayBuild.value?.roles ?? []
  return activeItemLimitLabel(
    buildItems.value,
    new Set(buildStore.theorycraftDisabledItemIndices),
    roles
  )
})

function itemManagerIconClass(index: number) {
  return {
    'items-manager-inline-icon--dragging': draggingItemIndex.value === index,
    'items-manager-inline-icon--drag-over':
      dragOverItemIndex.value === index && draggingItemIndex.value !== index,
    'items-manager-inline-icon--inactive':
      isTheorycraftItemsToggleMode.value && buildStore.isTheorycraftItemDisabled(index),
    'items-manager-inline-icon--toggle': isTheorycraftItemsToggleMode.value,
  }
}

function itemManagerTitle(entry: { item: Item; index: number }) {
  const name = tooltipsEnabled.value ? getItemDisplayName(entry.item) : entry.item.name
  if (!isTheorycraftItemsToggleMode.value) return name
  const state = buildStore.isTheorycraftItemDisabled(entry.index)
    ? t('buildCard.itemsDisabledForStats')
    : t('buildCard.itemsEnabledForStats')
  return `${name} — ${state}`
}

function onItemManagerClick(index: number) {
  if (!isTheorycraftItemsToggleMode.value) return
  const result = buildStore.toggleTheorycraftItemForStats(index)
  if (result === 'limit_reached') {
    itemsToggleLimitMessage.value = t('buildCard.itemsActiveLimitReached')
    if (itemsToggleLimitTimer) clearTimeout(itemsToggleLimitTimer)
    itemsToggleLimitTimer = setTimeout(() => {
      itemsToggleLimitMessage.value = null
      itemsToggleLimitTimer = null
    }, 2500)
  }
}

const clearDragState = () => {
  draggingItemIndex.value = null
  dragOverItemIndex.value = null
}

const onItemDragStart = (index: number, event: DragEvent) => {
  if (props.readonly || props.build) return
  draggingItemIndex.value = index
  dragOverItemIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

const onItemDragOver = (index: number, event: DragEvent) => {
  if (props.readonly || props.build || draggingItemIndex.value === null) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverItemIndex.value = index
}

const onItemDrop = (index: number, event: DragEvent) => {
  if (props.readonly || props.build) return
  event.preventDefault()

  const from = draggingItemIndex.value
  const to = index
  if (from === null || from === to) {
    clearDragState()
    return
  }

  const nextItems = [...buildItems.value]
  const [moved] = nextItems.splice(from, 1)
  if (!moved) {
    clearDragState()
    return
  }
  nextItems.splice(to, 0, moved)
  buildStore.setItems(nextItems)
  clearDragState()
}

const onItemDragEnd = () => {
  clearDragState()
}

// isBootsItem and isStarterItem imported from @lelanation/builds-ui

// Starting items (2 premiers - starter items only)
const startingItems = computed(() => {
  return buildItems.value.filter(item => isStarterItem(item)).slice(0, 2)
})

// Boots items (can have 2, they share 1 slot)
const bootsItems = computed(() => {
  return buildItems.value.filter(item => isBootsItem(item)).slice(0, 2)
})

// Core items (items restants après starter et boots, organisés en 2 chemins)
const coreItems = computed(() => {
  const starterIds = new Set(startingItems.value.map(i => i.id))
  const bootsIds = new Set(bootsItems.value.map(i => i.id))
  return buildItems.value.filter(item => !starterIds.has(item.id) && !bootsIds.has(item.id))
})

// Path 1 : premier chemin (jusqu'à 3 items)
const coreItemsPath1 = computed(() => {
  return coreItems.value.slice(0, 3)
})

// Path 2 : deuxième chemin (jusqu'à 3 items)
const coreItemsPath2 = computed(() => {
  return coreItems.value.slice(3, 6)
})

// First Three Ups - Les 3 premiers "up" (niveaux 1, 2, 3)
type AbilityKey = 'Q' | 'W' | 'E' | 'R'
type SkillSlotSpell = { key: AbilityKey; image: { full: string }; name: string }
type SkillSlotState = { key: AbilityKey | null; spell: SkillSlotSpell | null }

const createEmptySkillOrder = (): SkillOrder => ({
  firstThreeUps: [null as any, null as any, null as any],
  skillUpOrder: [null as any, null as any, null as any],
})

function getChampionSpellBySlot(
  champion: { spells?: Array<{ slot?: string; image?: { full?: string }; name?: string }> } | null,
  key: AbilityKey
) {
  const spells = champion?.spells
  if (!Array.isArray(spells) || spells.length === 0) return undefined
  const slotOrder: AbilityKey[] = ['Q', 'W', 'E', 'R']
  return (
    spells.find(s => String(s?.slot ?? '').toUpperCase() === key) ?? spells[slotOrder.indexOf(key)]
  )
}

const availableSkillSpells = computed<SkillSlotSpell[]>(() => {
  const champion = selectedChampion.value
  if (!champion) return []
  return (['Q', 'W', 'E', 'R'] as AbilityKey[])
    .map(key => {
      const spell = getChampionSpellBySlot(champion, key)
      if (!spell?.image?.full) return null
      return {
        key,
        image: spell.image,
        name: spell.name,
      }
    })
    .filter(Boolean) as SkillSlotSpell[]
})

const getSkillSlotSpell = (ability: AbilityKey | null | undefined): SkillSlotSpell | null => {
  if (!ability) return null
  return availableSkillSpells.value.find(spell => spell.key === ability) ?? null
}

const ensureSkillOrderInitialized = () => {
  if (props.readonly || props.build) return
  buildStore.ensureCurrentBuild()
  if (!buildStore.displayedBuild?.skillOrder) {
    buildStore.setSkillOrder(createEmptySkillOrder())
  }
}

const firstThreeUpSlots = computed<SkillSlotState[]>(() => {
  const raw = displayBuild.value?.skillOrder?.firstThreeUps
  const firstThreeUps = Array.isArray(raw) ? raw : []
  return Array.from({ length: 3 }, (_, index) => {
    const key = (firstThreeUps[index] as AbilityKey | null | undefined) ?? null
    return {
      key,
      spell: getSkillSlotSpell(key),
    }
  })
})

const skillOrderSlots = computed<SkillSlotState[]>(() => {
  const raw = displayBuild.value?.skillOrder?.skillUpOrder
  const skillUpOrder = Array.isArray(raw) ? raw : []
  return Array.from({ length: 3 }, (_, index) => {
    const key = (skillUpOrder[index] as AbilityKey | null | undefined) ?? null
    return {
      key,
      spell: getSkillSlotSpell(key),
    }
  })
})

const toggleSkillDropdown = (slotId: string) => {
  if (!canEditSkillOrder.value || !selectedChampion.value) return
  ensureSkillOrderInitialized()
  openSkillDropdown.value = openSkillDropdown.value === slotId ? null : slotId
}

const toggleFirstThreeUp = (index: number, ability: AbilityKey) => {
  ensureSkillOrderInitialized()
  const skillOrder = buildStore.displayedBuild?.skillOrder ?? createEmptySkillOrder()
  const firstThreeUps = Array.isArray(skillOrder.firstThreeUps)
    ? skillOrder.firstThreeUps
    : createEmptySkillOrder().firstThreeUps
  const current = firstThreeUps[index] ?? null
  const nextFirstThreeUps = [...firstThreeUps] as Array<AbilityKey | null>
  nextFirstThreeUps[index] = current === ability ? null : ability
  buildStore.setSkillOrder({
    ...skillOrder,
    firstThreeUps: nextFirstThreeUps as SkillOrder['firstThreeUps'],
  })
  openSkillDropdown.value = null
}

const toggleSkillUpOrder = (index: number, ability: AbilityKey) => {
  ensureSkillOrderInitialized()
  const skillOrder = buildStore.displayedBuild?.skillOrder ?? createEmptySkillOrder()
  const skillUpOrder = Array.isArray(skillOrder.skillUpOrder)
    ? skillOrder.skillUpOrder
    : createEmptySkillOrder().skillUpOrder
  const current = skillUpOrder[index] ?? null
  const nextSkillUpOrder = [...skillUpOrder] as Array<AbilityKey | null>
  nextSkillUpOrder[index] = current === ability ? null : ability
  buildStore.setSkillOrder({
    ...skillOrder,
    skillUpOrder: nextSkillUpOrder as SkillOrder['skillUpOrder'],
  })
  openSkillDropdown.value = null
}

// Règle : un même spell ne peut pas être monté deux niveaux consécutifs (1==2 ou 2==3 interdit),
// mais peut réapparaître en 1 et 3 (ex: Q → W → Q est valide).
const isFirstThreeUpSelected = (spellId: AbilityKey, currentIndex: number): boolean => {
  const ups = displayBuild.value?.skillOrder?.firstThreeUps
  if (!ups) return false
  const adjacentIndices = currentIndex === 0 ? [1] : currentIndex === 1 ? [0, 2] : [1]
  return adjacentIndices.some(idx => ups[idx] === spellId)
}

// Règle stricte : les 3 compétences à maxer doivent toutes être différentes.
const isSkillUpOrderSelected = (spellId: AbilityKey, currentIndex: number): boolean => {
  const order = displayBuild.value?.skillOrder?.skillUpOrder
  if (!order) return false
  return order.some((selected, idx) => idx !== currentIndex && selected === spellId)
}

// Keystone (première rune principale)
const keystoneRuneId = computed(() => {
  if (!selectedPrimaryRunes.value?.primary?.keystone) return null
  return selectedPrimaryRunes.value.primary.keystone
})

// Runes principales (keystone + 3 slots) - exclure keystone pour la ligne horizontale
const primaryRunesRow = computed(() => {
  if (!selectedPrimaryRunes.value?.primary) return []
  return [
    selectedPrimaryRunes.value.primary.slot1,
    selectedPrimaryRunes.value.primary.slot2,
    selectedPrimaryRunes.value.primary.slot3,
  ].filter(id => id && id !== 0)
})

// Secondary rune path
const secondaryPathId = computed(() => selectedSecondaryRunes.value?.secondary?.pathId ?? null)
const secondaryPath = computed(() =>
  secondaryPathId.value ? runesStore.getRunePathById(secondaryPathId.value) : null
)

const secondaryPathIcon = computed(() => {
  if (!secondaryPath.value) return null
  return getRunePathImageUrl(
    versionForImages.value,
    secondaryPath.value.icon,
    secondaryPath.value.id,
    secondaryPath.value.name
  )
})
const secondaryPathColor = computed(() =>
  secondaryPath.value
    ? getRunePathColor(secondaryPath.value.icon, secondaryPath.value.id, secondaryPath.value.name)
    : 'transparent'
)

const secondaryPathName = computed(() => secondaryPath.value?.name ?? '')

const filteredSecondaryRuneIds = computed(() => {
  if (!selectedSecondaryRunes.value?.secondary) return []
  return [
    selectedSecondaryRunes.value.secondary.slot1,
    selectedSecondaryRunes.value.secondary.slot2,
  ].filter(id => id && id !== 0)
})

// Find a rune by id across all loaded paths
function findRuneInStore(runeId: number) {
  for (const path of runesStore.runePaths ?? []) {
    const slots = Array.isArray(path?.slots) ? path.slots : []
    for (const slot of slots) {
      const runes = Array.isArray(slot?.runes) ? slot.runes : []
      for (const rune of runes) {
        if (rune.id === runeId) return rune
      }
    }
  }
  return null
}

const getRuneIconById = (runeId: number): string => {
  const rune = findRuneInStore(runeId)
  return rune ? getRuneImageUrl(versionForImages.value, rune.icon) : ''
}

const getRuneNameById = (runeId: number): string => findRuneInStore(runeId)?.name ?? ''

// Shards metadata (icon + label)
const shardIcons: Record<number, string> = {
  5008: '/icons/shards/adaptative.png',
  5005: '/icons/shards/speed.png',
  5006: '/icons/shards/move.png',
  5010: '/icons/shards/move.png',
  5007: '/icons/shards/cdr.png',
  5001: '/icons/shards/growth.png',
  5002: '/icons/shards/growth.png',
  5011: '/icons/shards/hp.png',
  5003: '/icons/shards/tenacity.png',
  5013: '/icons/shards/tenacity.png',
}

const getShardIconById = (shardId: number): string =>
  shardIcons[shardId] || '/icons/shards/adaptative.png'

const getShardNameById = (shardId: number): string => t(`runes.shards.${shardId}.name`, '')
const getShardDescriptionById = (shardId: number): string => t(`runes.shards.${shardId}.desc`, '')

const filteredShardIds = computed(() => {
  if (!selectedShards.value) return []
  return [
    selectedShards.value.slot1,
    selectedShards.value.slot2,
    selectedShards.value.slot3,
  ].filter(id => id && id !== 0)
})

// Translate tags
const translatedTags = computed(() => {
  if (!selectedChampion.value?.tags) return ''
  return selectedChampion.value.tags
    .map((tag: string) => (tag === 'Fighter' ? 'Combattant' : tag === 'Marksman' ? 'Tireur' : tag))
    .join(', ')
})

const RESOURCE_LABEL_BY_PARTYPE: Record<string, { fr: string; en: string }> = {
  Energy: { fr: 'Énergie', en: 'Energy' },
  Mana: { fr: 'Mana', en: 'Mana' },
  Fury: { fr: 'Fureur', en: 'Fury' },
  Rage: { fr: 'Rage', en: 'Rage' },
}

function normalizeSpellHeaderStatsForChampion(stats: any[], partype?: string) {
  if (!partype || !RESOURCE_LABEL_BY_PARTYPE[partype]) return stats
  const label = RESOURCE_LABEL_BY_PARTYPE[partype][riotLocale.value === 'en_US' ? 'en' : 'fr']
  return stats.map(stat => {
    if (stat?.key !== 'cost') return stat
    const valueText = String(stat.valueText ?? '').replace(/\s*Mana\s*$/i, ` ${label}`)
    return { ...stat, valueText, valueHtml: valueText }
  })
}

function spellTooltipMeta(spell: any) {
  const stats = spell?.headerStats
  if (!Array.isArray(stats) || stats.length === 0) return ''
  const partype = (selectedChampion.value as { partype?: string } | null)?.partype
  return formatSpellHeaderStatsHtml(normalizeSpellHeaderStatsForChampion(stats, partype))
}

function spellTooltipBody(spell: any) {
  if (!spell) return ''
  const body = resolveSpellTooltipBodyHtml(spell)
  const details = formatSpellDetailedTextsHtml(spell)
  return [body, details].filter(Boolean).join('<br>')
}

const passiveTooltipMeta = computed(() => {
  const passive = selectedChampion.value?.passive as
    | { headerStats?: Parameters<typeof formatSpellHeaderStatsHtml>[0] }
    | undefined
  return passive ? spellTooltipMeta(passive) : ''
})

const passiveTooltipBody = computed(() => {
  const passive = selectedChampion.value?.passive
  if (!passive) return ''
  return spellTooltipBody(passive)
})

const formattedSpells = computed(() => {
  if (!Array.isArray(selectedChampion.value?.spells) || selectedChampion.value.spells.length === 0)
    return []
  return selectedChampion.value.spells
})

watch(showTooltip, async newValue => {
  if (newValue) {
    await nextTick()
    applyChampionTooltipPosition()
    window.addEventListener('resize', applyChampionTooltipPosition)
  } else {
    window.removeEventListener('resize', applyChampionTooltipPosition)
  }
})

onUnmounted(() => {
  if (championTooltipHideTimer) clearTimeout(championTooltipHideTimer)
  window.removeEventListener('resize', applyChampionTooltipPosition)
  document.removeEventListener('mousedown', onDocumentPointerDown)
  championTitleResizeObserver?.disconnect()
  championTitleResizeObserver = null
  cancelAnimationFrame(championTitleFitRaf)
})

// Reset build function
const resetBuild = () => {
  if (props.readonly || props.build) return // Ne pas modifier si readonly ou si build en prop
  localFlipped.value = false
  localDisplayedSubIndex.value = null
  showItemStats.value = false
  buildStore.createNewBuild()
  if (props.selectionMode === 'theorycraft') return
  navigateTo(localePath('/builds/create/champion'))
}

const resetItemsOnly = () => {
  if (props.readonly || props.build) return // Ne pas modifier si readonly ou si build en prop
  buildStore.setItems([])
}

const getBootBackgroundStyle = (item?: Item | null) => {
  if (!item) return {}
  return {
    backgroundImage: `url(${getItemImageUrl(versionForImages.value, item.image.full)})`,
  }
}

const itemStatsTotals = computed(() => {
  const totals = {
    health: 0,
    mana: 0,
    attackDamage: 0,
    abilityPower: 0,
    armor: 0,
    magicResist: 0,
    attackSpeedPercent: 0,
    critChancePercent: 0,
    critDamagePercent: 0,
    lifeStealPercent: 0,
    spellVampPercent: 0,
    omnivampPercent: 0,
    movementSpeedFlat: 0,
    movementSpeedPercent: 0,
    healthRegen: 0,
    manaRegen: 0,
    lethality: 0,
    percentLethality: 0,
    armorPenPercent: 0,
    armorPenFlat: 0,
    magicPenPercent: 0,
    magicPenFlat: 0,
    tenacityPercent: 0,
    abilityHaste: 0,
    hpRegenPercent: 0,
    mpRegenPercent: 0,
    healShieldPowerPercent: 0,
    goldPer10: 0,
  }

  const nonStarter = itemsForManagerStats.value.filter(item => !isStarterItem(item))
  let firstBootKept = false
  const itemsForStats = nonStarter.filter(item => {
    if (!isBootsItem(item)) return true
    if (firstBootKept) return false
    firstBootKept = true
    return true
  })

  for (const item of itemsForStats) {
    totals.goldPer10 += getGoldPer10FromItem(item)
    if (!item.stats) continue
    totals.health += item.stats.FlatHPPoolMod || 0
    totals.mana += item.stats.FlatMPPoolMod || 0
    totals.attackDamage += item.stats.FlatPhysicalDamageMod || 0
    totals.abilityPower += item.stats.FlatMagicDamageMod || 0
    totals.armor += item.stats.FlatArmorMod || 0
    totals.magicResist += item.stats.FlatSpellBlockMod || 0
    totals.attackSpeedPercent += normalizePercentStat(item.stats.PercentAttackSpeedMod)
    totals.critChancePercent += item.stats.FlatCritChanceMod || 0
    totals.critDamagePercent += item.stats.FlatCritDamageMod || 0
    totals.lifeStealPercent += normalizePercentStat(item.stats.PercentLifeStealMod)
    totals.spellVampPercent += normalizePercentStat(
      item.stats.PercentSpellVampMod ??
        (item.stats as { PercentSpellVamp?: number }).PercentSpellVamp
    )
    totals.movementSpeedFlat += item.stats.FlatMovementSpeedMod || 0
    totals.movementSpeedPercent += normalizePercentStat(item.stats.PercentMovementSpeedMod)
    totals.healthRegen += item.stats.FlatHPRegenMod || 0
    totals.manaRegen += item.stats.FlatMPRegenMod || 0
    totals.hpRegenPercent += normalizePercentStat(item.stats.PercentHPRegenMod)
    totals.mpRegenPercent += normalizePercentStat(item.stats.PercentMPRegenMod)
    totals.healShieldPowerPercent += normalizePercentStat(
      (item.stats as { PercentHealShieldPower?: number }).PercentHealShieldPower
    )
    totals.armorPenPercent += normalizePercentStat(item.stats.rPercentArmorPenetrationMod)
    totals.armorPenFlat +=
      ((item.stats as Record<string, number | undefined>).rFlatArmorPenetrationMod as number) || 0
    totals.magicPenPercent += normalizePercentStat(item.stats.rPercentSpellPenetrationMod)
    totals.magicPenFlat +=
      ((item.stats as Record<string, number | undefined>).rFlatSpellPenetrationMod as number) || 0
    totals.tenacityPercent +=
      normalizePercentStat((item.stats as any).PercentTenacity ?? 0) +
      ((item.stats as any).FlatTenacity || 0)
    totals.abilityHaste += item.stats.rFlatCooldownModPerLevel || 0
    totals.lethality += (item.stats as any).FlatLethality || 0
    totals.percentLethality +=
      normalizePercentStat((item.stats as any).rPercentLethalityMod ?? 0) +
      normalizePercentStat((item.stats as any).PercentLethalityMod ?? 0)
    totals.omnivampPercent +=
      ((item.stats as any).FlatOmnivamp || 0) +
      normalizePercentStat((item.stats as any).PercentOmnivamp || 0)
  }

  const starterDrain = sumStarterDrainStats(itemsForManagerStats.value)
  totals.lifeStealPercent += starterDrain.lifeSteal
  totals.spellVampPercent += starterDrain.spellVamp
  totals.omnivampPercent += starterDrain.omnivamp

  return totals
})

const itemStatsRows = computed(() => {
  const s = itemStatsTotals.value
  const rows: Array<{ key: string; label: string; value: string }> = []
  const add = (key: string, label: string, value: number, suffix = '', digits = 0) => {
    if (!Number.isFinite(value) || Math.abs(value) < 0.01) return
    rows.push({ key, label, value: `+${value.toFixed(digits)}${suffix}` })
  }
  const addLethality = () => {
    const lethStr = formatLethality(s.lethality, s.percentLethality / 100)
    if (lethStr) rows.push({ key: 'lethality', label: 'Létalité', value: `+${lethStr}` })
  }
  add('health', 'PV', s.health)
  add('mana', 'Mana', s.mana)
  add('attackDamage', 'AD', s.attackDamage)
  add('abilityPower', 'AP', s.abilityPower)
  add('armor', 'Armure', s.armor)
  add('magicResist', 'RM', s.magicResist)
  add('attackSpeedPercent', 'Vitesse d’attaque', s.attackSpeedPercent, '%', 1)
  add('critChancePercent', 'Critique', s.critChancePercent, '%', 1)
  add('critDamagePercent', 'Dégâts critiques', s.critDamagePercent, '%', 1)
  add('lifeStealPercent', 'Vol de vie', s.lifeStealPercent, '%', 1)
  add('spellVampPercent', 'Vol de sort', s.spellVampPercent, '%', 1)
  add('omnivampPercent', 'Omnivamp', s.omnivampPercent, '%', 1)
  add('movementSpeedFlat', 'Vitesse déplacement (flat)', s.movementSpeedFlat)
  add('movementSpeedPercent', 'Vitesse déplacement', s.movementSpeedPercent, '%', 1)
  add('healthRegen', 'Régénération PV', s.healthRegen, '', 1)
  add('manaRegen', 'Régénération mana', s.manaRegen, '', 1)
  add('hpRegenPercent', 'Régén. PV (% base)', s.hpRegenPercent, '%', 1)
  add('mpRegenPercent', 'Régén. mana (% base)', s.mpRegenPercent, '%', 1)
  add('healShieldPowerPercent', t('stats.labels.healShieldPower'), s.healShieldPowerPercent, '%', 1)
  add('goldPer10', 'PO / 10 s', s.goldPer10, '', 0)
  addLethality()
  {
    const str = formatPenetrationPercentFlat(s.armorPenPercent, s.armorPenFlat)
    if (str) {
      rows.push({
        key: 'armorPen',
        label: `${t('stats.labels.armorPenetration')} ${t('stats.penetrationValueLegend')}`,
        value: `+${str}`,
      })
    }
  }
  {
    const str = formatPenetrationPercentFlat(s.magicPenPercent, s.magicPenFlat)
    if (str) {
      rows.push({
        key: 'magicPen',
        label: `${t('stats.labels.magicPenetration')} ${t('stats.penetrationValueLegend')}`,
        value: `+${str}`,
      })
    }
  }
  add('tenacityPercent', 'Ténacité', s.tenacityPercent, '%', 1)
  add('abilityHaste', 'Hâte', s.abilityHaste)
  return rows
})

const buildItemsWithIndex = computed(() => {
  return buildItems.value.map((item, index) => ({ item, index }))
})

const managerBuckets = computed(() => {
  const starterItems: Array<{ item: Item; index: number }> = []
  const bootsItems: Array<{ item: Item; index: number }> = []
  const coreItems: Array<{ item: Item; index: number }> = []

  for (const entry of buildItemsWithIndex.value) {
    if (isStarterItem(entry.item) && starterItems.length < 2) {
      starterItems.push(entry)
      continue
    }

    if (isBootsItem(entry.item) && !isStarterItem(entry.item) && bootsItems.length < 2) {
      bootsItems.push(entry)
      continue
    }

    coreItems.push(entry)
  }

  return { starterItems, bootsItems, coreItems }
})

const managerStarterItems = computed(() => {
  return managerBuckets.value.starterItems
})

const managerBootsItems = computed(() => {
  return managerBuckets.value.bootsItems
})

const managerCoreItems = computed(() => {
  return managerBuckets.value.coreItems.slice(0, 3)
})

const managerFinalItems = computed(() => {
  return managerBuckets.value.coreItems.slice(3)
})

// Persistance automatique - sauvegarder à chaque modification (seulement si pas de build en prop)
watch(
  () => buildStore.currentBuild,
  newBuild => {
    if (newBuild && !props.build) {
      // Sauvegarder automatiquement dans localStorage seulement si on utilise currentBuild
      try {
        const buildData = JSON.stringify(newBuild)
        localStorage.setItem(buildStore.getCurrentDraftStorageKey(), buildData)
      } catch (error) {
        // Ignore storage errors
      }
    }
  },
  { deep: true }
)

// Charger le build sauvegardé au montage (seulement si pas de build en prop)
onMounted(() => {
  loadRegionsPayload().then(payload => {
    regionsPayload.value = payload
  })

  const locale = riotLocale.value
  // Ensure we have full champion payload (spells/passive) for readonly cards and old lightweight builds.
  if (championsStore.status === 'idle' && championsStore.champions.length === 0) {
    championsStore.loadChampions(locale).catch(() => undefined)
  }
  // Load item / rune / spell data for sheet tooltips (same stores as the builder)
  if (itemsStore.status === 'idle' || itemsStore.items.length === 0) {
    itemsStore.loadItems(locale).catch(() => undefined)
  }
  if (runesStore.status === 'idle' || runesStore.runePaths.length === 0) {
    runesStore.loadRunes(locale).catch(() => undefined)
  }
  if (summonerSpellsStore.status === 'idle' || summonerSpellsStore.spells.length === 0) {
    summonerSpellsStore.loadSummonerSpells(locale).catch(() => undefined)
  }
  if (!props.build && !buildStore.currentBuild) {
    buildStore.ensureCurrentBuild()
  }
  document.addEventListener('mousedown', onDocumentPointerDown)

  nextTick(() => {
    scheduleFitChampionTitle()
    const box = championTitleBoxRef.value
    if (box && typeof ResizeObserver !== 'undefined') {
      championTitleResizeObserver = new ResizeObserver(() => scheduleFitChampionTitle())
      championTitleResizeObserver.observe(box)
    }
  })
})

watch(locale, () => {
  if (championsStore.status !== 'loading') {
    championsStore.loadChampions(riotLocale.value).catch(() => undefined)
  }
  itemsStore.loadItems(riotLocale.value).catch(() => undefined)
  runesStore.loadRunes(riotLocale.value).catch(() => undefined)
  summonerSpellsStore.loadSummonerSpells(riotLocale.value).catch(() => undefined)
})

defineExpose({
  toggleFlipped,
})
</script>

<style scoped>
.build-card-wrapper {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  --build-card-width: 300px;
  --card-border-color: var(--color-blue-300);
  --card-border-color-soft: rgb(0 90 130 / 0.45);
}

.build-card-wrapper--streamer-scaled .flip-container {
  zoom: 1.3;
  transform-origin: top left;
}

.build-card-wrapper--streamer-scaled {
  --build-card-width: 390px;
  min-height: 585px;
}

.card-top-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-top-author-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.3);
  background: rgba(8, 16, 31, 0.92);
  color: rgba(255, 255, 255, 0.9);
  padding: 0 8px;
  font-size: 11px;
}

.card-top-author-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.card-top-author-input:focus {
  outline: none;
  border-color: var(--color-gold-300);
}

.card-top-visibility-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 9999px;
  border: 1px solid rgba(200, 155, 60, 0.35);
  background: rgba(8, 16, 31, 0.92);
  flex: 0 0 auto;
}

.card-top-visibility-button {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.62);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.card-top-visibility-button.is-active {
  color: white;
}

.card-top-visibility-button.is-active:first-child {
  background: rgba(22, 163, 74, 0.9);
}

.card-top-visibility-button.is-active:last-child {
  background: rgba(220, 38, 38, 0.9);
}

.variants-popover {
  position: absolute;
  top: 32px;
  left: 0;
  z-index: 40;
  width: 300px;
  max-height: 360px;
  padding: 10px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 8px;
  background: rgba(8, 16, 31, 0.96);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}

.variants-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.variants-popover-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-gold-300);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.variants-popover-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.variants-popover-copy-btn {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(200, 155, 60, 0.35);
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  cursor: pointer;
}

.variants-popover-copy-btn:hover:not(:disabled) {
  background: rgba(200, 155, 60, 0.12);
  color: var(--color-gold-300);
}

.variants-popover-copy-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.variants-popover-add {
  padding: 4px 8px;
  border-radius: 9999px;
  border: 1px solid rgba(200, 155, 60, 0.5);
  background: rgba(200, 155, 60, 0.14);
  color: var(--color-gold-300);
  font-size: 11px;
  cursor: pointer;
}

.variants-popover-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.variants-popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.22);
  background: rgba(0, 0, 0, 0.22);
  cursor: pointer;
}

.variants-popover-item-active {
  border-color: var(--color-gold-300);
  background: rgba(200, 155, 60, 0.16);
}

.variants-popover-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-gold-300);
  flex-shrink: 0;
}

.variants-popover-input,
.variants-popover-label {
  flex: 1;
  min-width: 0;
}

.variants-popover-input {
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid rgba(200, 155, 60, 0.5);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 12px;
}

.variants-popover-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}

.variants-popover-copy,
.variants-popover-remove {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(200, 155, 60, 0.35);
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.86);
  font-size: 11px;
  cursor: pointer;
}

.variants-popover-remove {
  color: rgba(248, 113, 113, 0.95);
}

.variants-popover-copy:disabled {
  opacity: 0.45;
  cursor: default;
}

.variants-copy-picker {
  margin-top: 10px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.25);
  background: #08101f;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.variants-copy-picker-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-gold-300);
}

.variants-copy-picker-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.variants-copy-picker-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
}

.variants-copy-picker-select {
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid rgba(200, 155, 60, 0.35);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 12px;
  width: 100%;
}

.variants-copy-destinations {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.variants-copy-picker-divider {
  height: 1px;
  background: rgba(200, 155, 60, 0.18);
  margin: 6px 0 2px;
}

.variants-copy-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}

.variants-copy-option input {
  accent-color: var(--color-gold-300);
}

.variants-copy-picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.variants-copy-picker-cancel,
.variants-copy-picker-apply {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.35);
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  cursor: pointer;
}

.variants-copy-picker-apply {
  background: rgba(200, 155, 60, 0.14);
  color: var(--color-gold-300);
}

.variants-copy-picker-apply:disabled {
  opacity: 0.45;
  cursor: default;
}

.card-top-action-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-gold-300);
  border-radius: 4px;
  color: var(--color-gold-300);
  cursor: pointer;
  transition: all 0.2s ease;
}

.card-top-action-button:hover {
  background: rgba(0, 0, 0, 0.5);
  transform: rotate(180deg);
}

/* ── Flip animation ── */
.flip-container {
  position: relative;
  width: 300px;
  height: 450px;
  perspective: 900px;
}

.flip-container .build-card {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition: transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d;
  transform: rotateY(0deg);
}

.flip-container.flipped .build-card {
  transform: rotateY(-180deg);
}

.build-card-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 300px;
  height: 450px;
  background: var(--gradient-primary-mirror);
  border: 2px solid transparent;
  border-image: var(--card-border-gradient-strong) 1;
  border-radius: 6px;
  padding: 16px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: rotateY(180deg);
  transition: transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.flip-container.flipped .build-card-back {
  transform: rotateY(0deg);
}

.back-header {
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-gold-400);
}

.back-header--without-selector {
  grid-template-columns: 6px 1fr 42px;
}

.back-header-slot {
  width: 42px;
  display: flex;
  align-items: center;
}

.back-header-slot--left {
  justify-content: flex-start;
}

.back-header-slot--right {
  justify-content: flex-end;
}

.back-title {
  min-width: 0;
  font-size: clamp(10px, 0.8vw, 13px);
  font-weight: 700;
  color: var(--color-gold-300);
  letter-spacing: clamp(0.6px, 0.12vw, 1.2px);
  text-transform: uppercase;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
}

.variants-count-indicator--back {
  position: static;
  margin-right: 0;
  flex-shrink: 0;
}

.back-description-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 4px;
  border-radius: 9999px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  flex-shrink: 0;
}

.back-description-toggle.is-disabled {
  opacity: 0.6;
  cursor: default;
}

.back-description-toggle-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.back-description-toggle-track {
  width: 30px;
  height: 16px;
  padding: 2px;
  border-radius: 9999px;
  background: rgb(var(--rgb-text) / 0.35);
  display: inline-flex;
  align-items: center;
  transition: background-color 0.2s ease;
}

.back-description-toggle-track.is-active {
  background: rgb(var(--rgb-accent) / 0.7);
}

.back-description-toggle-thumb {
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: rgb(var(--rgb-background));
  transition: transform 0.2s ease;
}

.back-description-toggle-track.is-active .back-description-toggle-thumb {
  transform: translateX(14px);
}

.back-description-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.back-description-previews {
  margin-bottom: 8px;
  max-height: 165px;
  overflow-y: auto;
  padding-right: 2px;
}

.back-description-textarea {
  flex: 1;
  min-height: 220px;
  resize: none;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  background: rgba(0, 0, 0, 0.26);
  color: #fff;
  font-size: clamp(10px, 0.82vw, 12px);
  line-height: 1.4;
}

.back-description-readonly {
  flex: 1;
  min-height: 220px;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.88);
  font-size: clamp(10px, 0.82vw, 12px);
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-y: auto;
}

.back-description-readonly :deep(a) {
  color: var(--color-gold-300);
  text-decoration: underline;
  pointer-events: auto;
}

.back-variants-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
}

.back-variant-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.3);
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.15s ease;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
}

.back-variant-item:hover {
  background: rgba(200, 155, 60, 0.15);
  border-color: var(--color-gold-300);
}

.back-variant-active {
  background: rgba(200, 155, 60, 0.2) !important;
  border-color: var(--color-gold-300) !important;
  color: var(--color-gold-300) !important;
}

.back-variant-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-gold-300);
  flex-shrink: 0;
}

.back-variant-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.back-variant-input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid rgba(200, 155, 60, 0.7);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
}

.back-variant-input:focus {
  outline: none;
  border-color: var(--color-gold-300);
  box-shadow: 0 0 0 1px var(--color-gold-300);
}

.back-variant-remove {
  border: none;
  background: transparent;
  color: rgba(248, 113, 113, 0.9);
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}

.back-variant-remove:hover {
  color: #fecaca;
}

.build-card {
  position: relative;
  width: 300px;
  height: 450px;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-strong) border-box;
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.validation-blink-frame {
  border-radius: 8px;
  animation: validation-blink-red 1s ease-in-out infinite;
}

@keyframes validation-blink-red {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(248, 113, 113, 0.18),
      0 0 0 0 rgba(220, 38, 38, 0);
  }

  50% {
    box-shadow:
      0 0 0 1px rgba(248, 113, 113, 0.95),
      0 0 18px rgba(220, 38, 38, 0.7);
  }
}

.build-version {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.roles-section {
  position: absolute;
  top: 30px;
  right: 8px; /* Aligné à droite comme la version */
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.roles-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.role-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.role-unselected {
  opacity: 0.3;
  filter: grayscale(100%);
}

.role-selected {
  opacity: 1;
  filter: grayscale(0%);
  background: rgba(200, 155, 60, 0.1);
}

.role-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.variants-tags-stack {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 15px;
}

.variants-tags-stack > .variants-count-indicator {
  position: static;
}

/* Espace réservé : même classes que le bouton sauf visibilité (liste sans bouton, capture, etc.). */
.variants-count-indicator--layout-spacer {
  visibility: hidden;
  pointer-events: none;
  flex-shrink: 0;
}

.build-tags-section {
  display: flex;
  justify-content: flex-start;
  width: max-content;
  max-width: 128px;
}

.build-tags-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
  width: 100%;
}

.build-tag-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  border-radius: 9999px;
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(15, 23, 42, 0.25);
  color: rgba(203, 213, 225, 0.82);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
  padding: 2px 6px;
  min-height: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 5px;
}

.build-tag-chip:disabled {
  cursor: default;
}

.build-tag-chip--selected {
  color: rgba(255, 255, 255, 0.95);
  border-color: rgb(255 255 255 / 0.38);
  background: linear-gradient(130deg, var(--tag-g1) 0%, var(--tag-g2) 100%);
  filter: grayscale(0%);
}

.build-tag-chip--selected.build-tag-chip--troll-selected {
  color: rgba(12, 12, 14, 0.94);
  border-color: rgb(12 12 14 / 0.35);
}

.build-tag-chip--unselected {
  filter: grayscale(100%);
}

.variants-count-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.38);
  border: 1px solid rgb(200 155 60 / 0.4);
  color: rgb(240 230 210 / 0.82);
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
}

.variants-poker-icon {
  position: relative;
  width: 28px;
  height: 20px;
  flex: 0 0 auto;
}

.variants-poker-card {
  position: absolute;
  top: 1px;
  left: 0;
  width: 14px;
  height: 18px;
  border-radius: 3px;
  border: 1px solid rgb(240 230 210 / 0.85);
  background: linear-gradient(145deg, rgb(18 32 58 / 0.96), rgb(8 16 31 / 0.96));
  box-shadow: 0 1px 3px rgb(0 0 0 / 35%);
  transform-origin: bottom left;
}

.variants-poker-card::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 2px;
  border: 1px solid rgb(200 155 60 / 0.4);
}

.variants-poker-badge {
  position: absolute;
  right: -4px;
  bottom: -2px;
  min-width: 12px;
  height: 12px;
  padding: 0 3px;
  border-radius: 9999px;
  background: var(--color-gold-300);
  color: var(--color-background, #0a1428);
  font-size: 8px;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
  z-index: 6;
}

.build-card-region--selectable {
  cursor: pointer;
  border-radius: 6px;
  transition:
    box-shadow 0.15s ease,
    outline-color 0.15s ease;
}

.build-card-region--selectable:hover {
  box-shadow: 0 0 0 1px rgba(200, 155, 60, 0.45);
}

.build-card-region--active {
  box-shadow: 0 0 0 2px rgba(200, 155, 60, 0.85);
  outline: 1px solid rgba(200, 155, 60, 0.35);
}

/* Champion Section */
.champion-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}

.champion-portrait-container {
  width: 72px;
  height: 72px;
  position: relative;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.champion-portrait-container.is-splash {
  width: 200px;
  margin-left: 3px;
}

/* Bordure losange (carré tourné) teintée par la région */
.champion-portrait-container::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 88%;
  height: 88%;
  transform: translate(-50%, -50%) rotate(45deg);
  border: 2px solid transparent;
  border-image: var(--card-border-gradient-strong) 1;
  box-sizing: border-box;
  background: transparent;
  z-index: 2;
  pointer-events: none;
}

.champion-portrait-container.is-splash::before {
  display: none;
}

/* Image du champion en losange (88%) */
.champion-portrait {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 88%;
  height: 88%;
  transform: translate(-50%, -50%);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  object-fit: cover;
  cursor: pointer;
  z-index: 1;
}

.champion-portrait--splash {
  width: 100%;
  height: 100%;
  clip-path: none;
  transform: translate(-50%, -50%);
  object-fit: contain;
  image-rendering: auto;
}

.champion-portrait-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 88%;
  height: 88%;
  transform: translate(-50%, -50%);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed var(--color-primary-light);
  opacity: 0.3;
  z-index: 1;
}

.champion-name-box {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 6px;
  padding: 0 4px;
  box-sizing: border-box;
}

.champion-name {
  width: 100%;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-primary-light);
  text-align: center;
  letter-spacing: 1px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  overflow-wrap: anywhere;
  word-break: break-word;
  hyphens: auto;
  overflow: hidden;
}

.separator-line {
  width: 100%;
  height: 1px;
  background: var(--card-border-gradient-strong);
  opacity: 0.8;
  margin: 8px 0;
  display: block;
  position: relative;
  z-index: 1;
}

.summoner-spells-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 6px;
  margin-bottom: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.summoner-spell-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-strong) border-box;
  object-fit: cover;
}

.summoner-spell-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px dashed var(--color-blue-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

/* Runes Section */
.runes-section {
  margin: -6px 0 3px;
  position: relative;
  padding-right: 40px; /* espace réservé pour la colonne de shards à droite */
  min-height: 84px;
  display: flex;
  align-items: center;
}

.runes-container {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 84px;
}

.keystone-container {
  flex-shrink: 0;
  width: 84px;
  height: 84px;
}

.keystone-icon {
  width: 84px !important;
  height: 84px !important;
  min-width: 84px !important;
  min-height: 84px !important;
  max-width: 84px !important;
  max-height: 84px !important;
  border-radius: 50%;
  border: none;
  object-fit: cover;
  flex: 0 0 84px;
  display: block;
}

.keystone-placeholder {
  width: 84px !important;
  height: 84px !important;
  min-width: 84px !important;
  min-height: 84px !important;
  max-width: 84px !important;
  max-height: 84px !important;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
  flex: 0 0 84px;
}

.runes-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
  min-height: 84px;
}

.primary-runes-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.primary-runes-row > .primary-rune-icon {
  width: 35px !important;
  height: 35px !important;
  min-width: 35px !important;
  min-height: 35px !important;
  max-width: 35px !important;
  max-height: 35px !important;
  border-radius: 50%;
  border: none;
  object-fit: cover;
  flex: 0 0 35px;
  display: block;
}

.primary-runes-row > .primary-rune-placeholder {
  width: 35px !important;
  height: 35px !important;
  min-width: 35px !important;
  min-height: 35px !important;
  max-width: 35px !important;
  max-height: 35px !important;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
  flex: 0 0 35px;
}

.shards-vertical {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 4px;
}

.shard-icon-small {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-strong) border-box;
  object-fit: cover;
}

/* Colonne de shards à droite, dans la même zone que les runes */
.shards-strip {
  position: absolute;
  top: 0;
  right: 8px;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.shard-icon-strip {
  width: 25px;
  height: 25px;
  border-radius: 3px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-strong) border-box;
  object-fit: cover;
}

.shard-placeholder {
  width: 25px;
  height: 25px;
  border-radius: 3px;
  border: 1px dashed var(--color-blue-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

.secondary-runes-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.secondary-runes-row > .secondary-path-icon {
  width: 35px;
  height: 35px;
  min-width: 35px;
  min-height: 35px;
  max-width: 35px;
  max-height: 35px;
  border-radius: 50%;
  border: none;
  transform: translateY(1px);
  flex: 0 0 35px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.secondary-runes-row > .secondary-path-icon > .secondary-path-icon-mask {
  width: 100%;
  height: 100%;
  display: block;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.secondary-runes-row > .secondary-path-placeholder {
  width: 35px;
  height: 35px;
  min-width: 35px;
  min-height: 35px;
  max-width: 35px;
  max-height: 35px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
  transform: translateY(1px);
  flex: 0 0 35px;
}

.secondary-runes-row > .secondary-rune-icon {
  width: 35px;
  height: 35px;
  min-width: 35px;
  min-height: 35px;
  max-width: 35px;
  max-height: 35px;
  border-radius: 50%;
  border: none;
  object-fit: cover;
  flex: 0 0 35px;
  display: block;
}

.secondary-runes-row > .secondary-rune-placeholder {
  width: 35px;
  height: 35px;
  min-width: 35px;
  min-height: 35px;
  max-width: 35px;
  max-height: 35px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
  flex: 0 0 35px;
}
/* Items Section - alignée avec les cases skills (top: 300px, lignes 38px + gap 6px) */
.items-section {
  position: absolute;
  top: 300px;
  left: 10px;
  margin: 0;
  padding-left: 0;
  z-index: 5;
}

.starting-items-row {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  min-height: 38px;
  margin-bottom: 6px;
  padding-left: 0;
  /* Centrer par rapport à un path de 3 items (32px * 3 + 14px * 2 flèches = 124px) */
  margin-left: 27px;
}

.boots-slot {
  width: 32px;
  height: 32px;
  position: relative;
  border-radius: 4px;
  border: 1px dashed var(--color-primary-light);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.boots-slot--filled {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-soft) border-box;
}

.boots-icon-single {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.boots-item-split {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  cursor: default;
  background-size: 32px 32px;
  background-repeat: no-repeat;
}

.boots-item-left {
  left: 0;
  background-position: left center;
}

.boots-item-right {
  right: 0;
  background-position: right center;
}

/* Items manager (below card) */
.items-manager {
  width: var(--build-card-width);
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.15);
}

.items-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.items-manager-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.items-manager-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.items-reset-btn {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
}

.items-manager-tab-btn {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  opacity: 0.82;
}

.items-reset-btn:hover {
  background: rgba(0, 0, 0, 0.55);
}

.items-manager-tab-btn:hover {
  background: rgba(200, 155, 60, 0.28);
}

.items-manager-tab-btn.is-active {
  background: rgba(200, 155, 60, 0.22);
  border-color: rgba(200, 155, 60, 0.5);
  opacity: 1;
}

.items-manager-empty {
  font-size: 12px;
  opacity: 0.7;
}

.items-manager-inline {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  overflow-x: auto;
  white-space: nowrap;
  padding-bottom: 4px;
}

.items-manager-inline-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: top;
}

.items-manager-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.items-manager-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.items-manager-group-label {
  width: 56px;
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  opacity: 0.85;
}

.items-manager-inline-icon--inactive {
  opacity: 0.35;
  filter: grayscale(1);
}

.items-manager-inline-icon--toggle {
  cursor: pointer;
}

.items-manager-hint,
.items-manager-limit-message,
.items-manager-active-count {
  font-size: 11px;
  line-height: 1.3;
}

.items-manager-hint {
  margin: 0 0 8px;
  color: rgb(255 255 255 / 0.65);
}

.items-manager-limit-message {
  margin: 0 0 8px;
  color: #f87171;
}

.items-manager-active-count {
  color: var(--color-gold-300, #c89b3c);
  font-weight: 600;
  white-space: nowrap;
}

.items-manager-inline-icon {
  width: 25px;
  height: 25px;
  margin-top: 5px;
  border-radius: 4px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-strong) 1;
  flex: 0 0 auto;
  cursor: grab;
  transition:
    transform 0.12s ease,
    opacity 0.12s ease,
    box-shadow 0.12s ease;
}

.items-manager-inline-icon--dragging {
  opacity: 0.45;
  cursor: grabbing;
}

.items-manager-inline-icon--drag-over {
  box-shadow: 0 0 0 1px var(--color-gold-300);
}

.items-manager-inline-separator {
  font-size: 12px;
  color: var(--color-gold-300);
  opacity: 0.9;
  flex: 0 0 auto;
}

.items-manager-stats {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.items-manager-stats-note {
  font-size: 11px;
  opacity: 0.75;
  margin-bottom: 6px;
}

.items-manager-stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.items-manager-stats-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}

.items-manager-stats-label {
  opacity: 0.85;
}

.items-manager-stats-value {
  color: var(--color-gold-300);
  font-weight: 600;
}

.items-manager-modifiers {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgb(200 155 60 / 0.25);
}

.items-manager-modifiers__title {
  margin: 0 0 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(252 211 77 / 0.9);
}

.items-manager-modifiers__grid {
  display: grid;
  gap: 0.35rem;
}

.items-manager-modifiers__row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.7rem;
}

.items-manager-modifiers__label {
  color: rgb(255 255 255 / 0.7);
}

.items-manager-modifiers__value {
  font-weight: 700;
  color: rgb(196 181 253 / 1);
  text-align: right;
}

.core-items-paths {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.items-path {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  min-height: 38px;
}

.item-wrapper {
  position: relative;
  cursor: default;
}

.item-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-soft) border-box;
  object-fit: cover;
  display: block;
}

.item-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px dashed var(--color-primary-light);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

.arrow-right {
  color: var(--color-gold-400);
  font-size: 14px;
  font-weight: bold;
}

/* Capture PNG : masque seulement les ↓ entre sorts ; les → entre items core/finaux restent */
.build-card-wrapper--screenshot .arrow-down {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  font-size: 0 !important;
  line-height: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

/* First Three Ups Section */
.first-three-ups-section {
  position: absolute;
  left: 200px; /* Positionné pour avoir le même espace entre items (~120px) et skill order (~280px) */
  top: 303px; /* Descendu pour s'aligner avec les items */
  z-index: 10;
}

.first-three-ups-vertical {
  display: flex;
  flex-direction: column;
  gap: 6px; /* Même gap que les items */
  align-items: center;
}

.first-three-ups-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 32px;
  min-height: 38px;
}

.first-three-ups-item .skill-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.first-three-ups-item .skill-placeholder-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.first-three-ups-item .skill-icon {
  position: relative;
}

.first-three-ups-item .skill-key {
  position: absolute;
  bottom: -5px;
  right: -5px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300);
  font-size: 10px;
  font-weight: bold;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  z-index: 1;
}

.first-three-ups-item .level-badge {
  position: absolute;
  top: -7px;
  left: -7px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--color-gold-300);
  color: var(--color-blue-600);
  font-size: 9px;
  font-weight: bold;
  z-index: 1;
}

.skill-order-item .max-badge {
  position: absolute;
  top: -7px;
  left: -7px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 13px;
  padding: 0 3px;
  border-radius: 9999px;
  background-color: #7dd3fc;
  color: #082f49;
  font-size: 6px;
  font-weight: bold;
  line-height: 1;
  text-transform: uppercase;
  z-index: 1;
}

/* Skill Order Section */
.skill-order-section {
  position: absolute;
  right: 20px; /* Décalé de 20px du bord droit */
  top: 303px; /* Descendu pour s'aligner avec les items */
}

.skill-order-vertical {
  display: flex;
  flex-direction: column;
  gap: 6px; /* Même gap que les items */
  align-items: center;
}

.skill-order-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 32px;
  min-height: 38px;
}

/* Wrapper pour positionner la clé (Q/W/E/R) sur l'icône, comme first-three-ups */
.skill-order-item .skill-icon-wrapper,
.skill-order-item .skill-placeholder-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.skill-order-item .skill-icon {
  position: relative;
}

.skill-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 2px solid black;
  object-fit: cover;
}

.skill-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px dashed var(--color-blue-200);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

/* Fond opaque pour lisibilité à l'écran */
.skill-key {
  position: absolute;
  bottom: -5px;
  right: -5px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300);
  font-size: 10px;
  font-weight: bold;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  z-index: 1;
}

.skill-slot-trigger--editable {
  cursor: pointer;
}

.skill-slot-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 15;
  min-width: 84px;
  padding: 4px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  border-radius: 8px;
  background: rgba(8, 16, 31, 0.98);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.38);
}

.skill-slot-dropdown-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.skill-slot-dropdown-option:hover {
  background: rgba(200, 155, 60, 0.18);
}

.skill-slot-dropdown-option.is-active {
  background: rgba(200, 155, 60, 0.22);
}

.skill-slot-dropdown-option.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.skill-slot-dropdown-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid transparent;
  border-image: var(--card-border-gradient-soft) 1;
  object-fit: cover;
  flex: 0 0 auto;
}

.skill-slot-dropdown-label {
  font-size: 11px;
  font-weight: 700;
}

.arrow-down {
  position: absolute;
  left: 50%;
  bottom: -6px;
  transform: translateX(-50%);
  color: var(--color-gold-400);
  font-size: 8px;
  font-weight: bold;
  line-height: 1;
  z-index: 2;
}

/* Footer */
.build-footer {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

/* Tooltip styles */
.tooltip-box-fixed {
  pointer-events: auto;
  overscroll-behavior: contain;
}

.tooltip-box {
  width: max-content;
  max-width: min(1280px, calc(100vw - 1rem));
  min-width: min(520px, calc(100vw - 1rem));
  max-height: 92vh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1.2em;
  display: flex;
  flex-direction: column;
  background: #08101f !important;
  border: 1px solid rgb(125 211 252 / 0.75) !important;
}

@media (max-width: 768px) {
  .tooltip-box {
    max-width: calc(100vw - 1rem);
    min-width: min(320px, calc(100vw - 1rem));
    padding: 1em;
  }
}

@media (max-width: 480px) {
  .tooltip-box {
    max-width: calc(100vw - 0.5rem);
    min-width: min(280px, calc(100vw - 0.5rem));
    padding: 0.8em;
  }
}

.tooltip-top {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.tooltip-present {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.75em;
  width: 100%;
}

.tooltip-champion-image {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
  flex-shrink: 0;
}

.tooltip-text {
  display: flex;
  flex-direction: column;
  text-align: right;
  flex: 1;
  min-width: 0;
}

.tooltip-champion-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  line-height: 1.2;
}

.tooltip-champion-title {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.8);
  line-height: 1.3;
}

.tooltip-tags-container {
  padding: 0.15em 0.55em;
  border: 1px solid rgba(125, 211, 252, 0.4);
  border-radius: 999px;
  background: rgba(125, 211, 252, 0.1);
  flex-shrink: 0;
}

.tooltip-tags {
  font-size: 0.72rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.1;
  white-space: nowrap;
}

.tooltip-separator {
  background-color: rgb(var(--rgb-accent));
  width: 100%;
  height: 1px;
  border: 0;
  margin: 0.5em 0;
  opacity: 0.2;
  flex-shrink: 0;
}

.tooltip-body {
  flex: 1;
  overflow: visible;
  min-height: 0;
}

.tooltip-spells {
  display: flex;
  flex-direction: column;
  gap: 0.8em;
  margin-top: 1em;
}

.tooltip-spell {
  flex-shrink: 0;
  display: flex;
  gap: 0.75em;
}

.tooltip-spell-wrapper {
  display: flex;
  gap: 0.75em;
  width: 100%;
}

.tooltip-spell-img-container {
  border: 1px solid rgb(var(--rgb-accent));
  position: relative;
  margin-top: 0.1em;
  height: 2.5em;
  width: 2.5em;
  flex-shrink: 0;
  border-radius: 4px;
}

.tooltip-spell-img-container[data-spell-key='Q']::before {
  content: 'Q';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='W']::before {
  content: 'W';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='E']::before {
  content: 'E';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='R']::before {
  content: 'R';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.tooltip-spell-content {
  flex: 1;
  min-width: 0;
}

.tooltip-spell-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
  line-height: 1.3;
  margin-bottom: 4px;
}

.tooltip-spell-description {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.4;
}

/* Force meta labels style inside v-html content in scoped component. */
.tooltip-spell-description :deep(.tooltip-spell-meta-key),
.tooltip-spell-meta :deep(.tooltip-spell-meta-key) {
  color: rgb(252 211 77 / 1) !important;
  font-size: inherit !important;
  font-weight: 600 !important;
}

.tooltip-spell-description :deep(.tooltip-spell-meta-line) {
  display: block;
}

.tooltip-spell-meta.tooltip-game-description {
  font-size: 0.8rem;
  line-height: 1.4;
  color: rgb(var(--rgb-text) / 0.7);
}

.tooltip-box :deep(.tooltip-spell-description .tooltip-icon),
.tooltip-box :deep(.tooltip-spell-meta .tooltip-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.9em;
  height: 0.9em;
  margin-right: 0.15em;
  vertical-align: middle;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  flex-shrink: 0;
}

.tooltip-box :deep(.tooltip-icon.tooltip-icon-physical) {
  background-image: url('/icons/statsicon/AD.png');
}

.tooltip-box :deep(.tooltip-icon.tooltip-icon-magic) {
  background-image: url('/icons/statsicon/ap.png');
}

.tooltip-box :deep(.tooltip-icon.tooltip-icon-heal) {
  background-image: url('/icons/statsicon/Health_regeneration.svg');
}

.tooltip-box :deep(.tooltip-icon.tooltip-icon-speed) {
  background-image: url('/icons/statsicon/Movement_speed.png');
}

.tooltip-box :deep(.tooltip-icon.tooltip-icon-true::before) {
  content: '◆';
  color: rgb(226 232 240);
  font-size: 0.75em;
}

.tooltip-box :deep(.tooltip-icon.tooltip-icon-shield::before) {
  content: '◈';
  color: rgb(134 239 172);
  font-size: 0.85em;
}

.tooltip-box :deep(.dmg-physical) {
  color: rgb(248 113 113) !important;
}

.tooltip-box :deep(.dmg-magic) {
  color: rgb(196 181 253) !important;
}

.tooltip-box :deep(.dmg-true) {
  color: rgb(226 232 240) !important;
}

.tooltip-box :deep(.status-cc) {
  color: rgb(56 189 248) !important;
  font-weight: 600;
}

.tooltip-box :deep(.recast),
.tooltip-box :deep(.active) {
  color: rgb(147 197 253) !important;
  font-weight: 600;
}

.tooltip-box :deep(.keyword-stealth),
.tooltip-box :deep(.keyword),
.tooltip-box :deep(.keyword-major) {
  color: rgb(191 219 254) !important;
  font-weight: 600;
}

.tooltip-box :deep(.scale-ad),
.tooltip-box :deep(.tooltip-tag.scale-ad) {
  color: rgb(253 224 71) !important;
  font-weight: 700;
}

.tooltip-box :deep(.scale-ap),
.tooltip-box :deep(.tooltip-tag.scale-ap) {
  color: rgb(196 181 253) !important;
  font-weight: 700;
}

.tooltip-box :deep(.scale-hp),
.tooltip-box :deep(.tooltip-tag.scale-hp) {
  color: rgb(134 239 172) !important;
  font-weight: 700;
}

.tooltip-box :deep(.scale-mana),
.tooltip-box :deep(.tooltip-tag.scale-mana) {
  color: rgb(96 165 250) !important;
  font-weight: 700;
}

.tooltip-box :deep(.scale-armor),
.tooltip-box :deep(.tooltip-tag.scale-armor),
.tooltip-box :deep(.tooltip-tag-scalearmor),
.tooltip-box :deep(.tooltip-tag.tooltip-tag-scalearmor) {
  color: rgb(251 191 36) !important;
  font-weight: 700;
}

.tooltip-box :deep(.scale-mr),
.tooltip-box :deep(.tooltip-tag.scale-mr),
.tooltip-box :deep(.tooltip-tag-scalemr),
.tooltip-box :deep(.tooltip-tag.tooltip-tag-scalemr) {
  color: rgb(129 140 248) !important;
  font-weight: 700;
}

.tooltip-box :deep(.shield),
.tooltip-box :deep(.healing) {
  color: rgb(134 239 172) !important;
}

.tooltip-box :deep(.kayn-form-shadow),
.tooltip-box :deep(font[color='#8484fb']),
.tooltip-box :deep(font[color='#8484FB']) {
  color: #8484fb !important;
  font-weight: 700;
}

.tooltip-box :deep(.kayn-form-darkin),
.tooltip-box :deep(font[color='#fe5c50']),
.tooltip-box :deep(font[color='#FE5C50']) {
  color: #fe5c50 !important;
  font-weight: 700;
}

/* Icon + damage colors: global rules in assets/css/main.css (.tooltip-box …) */

/* Sheet element tooltips (item / rune / spell) — même rendu que ItemSelector / RuneSelector */
.sheet-element-tooltip-wrapper {
  background: #08101f !important;
  border: 1px solid rgb(125 211 252 / 0.75) !important;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip) {
  width: max-content;
  max-width: min(480px, calc(100vw - 2rem));
  min-width: min(280px, calc(100vw - 2rem));
  padding: 1em;
  display: flex;
  flex-direction: column;
  overflow: visible;
  background: transparent !important;
  border: none !important;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-content) {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-header) {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-image) {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
  flex-shrink: 0;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-text) {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-name) {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  line-height: 1.2;
  margin-bottom: 0.25rem;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-price) {
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.8);
  line-height: 1.3;
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-plaintext) {
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.9);
  line-height: 1.4;
  font-style: italic;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sheet-element-tooltip-wrapper :deep(.item-tooltip-description) {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.4;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sheet-element-tooltip-wrapper :deep(.rune-tooltip) {
  max-width: 300px;
  padding: 0.75rem;
  pointer-events: none;
  background: transparent !important;
  border: none !important;
}

.sheet-element-tooltip-wrapper :deep(.rune-tooltip-content) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sheet-element-tooltip-wrapper :deep(.rune-tooltip-header) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sheet-element-tooltip-wrapper :deep(.rune-tooltip-name) {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  line-height: 1.2;
}

.sheet-element-tooltip-wrapper :deep(.rune-tooltip-header) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sheet-element-tooltip-wrapper :deep(.rune-path-tooltip-icon) {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
}

.sheet-element-tooltip-wrapper :deep(.rune-tooltip-description) {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text));
  line-height: 1.4;
  opacity: 0.9;
}

.sheet-element-tooltip-wrapper :deep(.sheet-tooltip-simple) {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
}

/* Dernier mot sur le mode capture : ↓ sorts uniquement */
.build-card-wrapper--screenshot .arrow-down {
  display: none !important;
  position: absolute !important;
  clip-path: inset(50%) !important;
  opacity: 0 !important;
}
</style>

<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'champion'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div class="mb-6 flex flex-col items-start gap-4 md:flex-row">
        <!-- Step Content (Top on mobile, Left on desktop) -->
        <div class="w-full flex-1 md:order-2">
          <ChampionSelector />
        </div>

        <!-- Build Card (Bottom on mobile, Right on desktop) -->
        <div class="build-card-wrapper w-full flex-shrink-0 md:order-1">
          <BuildCard :sheet-tooltips="true" />
        </div>
      </div>
      <!-- Popup confirmation changement de champion -->
      <div
        v-if="buildStore.pendingChampionChange"
        class="champion-confirm-overlay"
        @click.self="buildStore.cancelChampionChange()"
      >
        <div class="champion-confirm-modal">
          <p class="champion-confirm-title">Changer de champion ?</p>
          <p class="champion-confirm-body">
            Vous allez perdre toutes les variantes de ce build. Cette action est irréversible.
          </p>
          <div class="champion-confirm-actions">
            <button class="btn-cancel" @click="buildStore.cancelChampionChange()">Annuler</button>
            <button class="btn-confirm" @click="buildStore.confirmChampionChange()">
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Champion',
  meta: [
    {
      name: 'description',
      content: 'Sélectionnez un champion pour créer votre build League of Legends',
    },
  ],
})

const buildStore = useBuildStore()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

watch(hasChampion, newValue => {
  if (newValue && route.path.includes('/builds/create/champion')) {
    router.push(localePath('/builds/create/rune'))
  }
})

onMounted(() => {
  // Only create a new build if one doesn't exist
  // Don't reset an existing build
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }
})
</script>

<style scoped>
.build-card-wrapper {
  width: 293.9px;
}

@media (max-width: 768px) {
  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}

.champion-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.champion-confirm-modal {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  border: 1px solid rgba(200, 155, 60, 0.6);
  background:
    radial-gradient(circle at top, rgba(200, 155, 60, 0.18), transparent 55%), rgba(9, 14, 28, 0.96);
  padding: 20px 22px 18px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.75);
}

.champion-confirm-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #f0e6d2;
}

.champion-confirm-body {
  margin: 0 0 14px;
  font-size: 13px;
  color: rgba(240, 230, 210, 0.8);
}

.champion-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-cancel {
  background: transparent;
  color: rgba(240, 230, 210, 0.85);
  border-color: rgba(148, 163, 184, 0.7);
}

.btn-cancel:hover {
  border-color: rgba(200, 155, 60, 0.7);
  color: #f0e6d2;
}

.btn-confirm {
  background: rgba(220, 38, 38, 0.85);
  color: #fee2e2;
  border-color: rgba(248, 113, 113, 0.9);
}

.btn-confirm:hover {
  background: rgba(220, 38, 38, 0.95);
  border-color: rgba(248, 113, 113, 1);
}
</style>

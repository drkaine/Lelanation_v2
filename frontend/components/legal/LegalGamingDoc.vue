<!-- eslint-disable vue/no-v-html -- trusted i18n content from locale JSON -->
<template>
  <div class="lg-page text-text">
    <header class="lg-hero">
      <div class="lg-hero-inner">
        <p class="lg-eyebrow">
          <Icon :name="heroIcon" size="16px" />
          {{ t('legalTest.eyebrow') }}
        </p>
        <h1 class="lg-title">{{ t(`${doc}.title`) }}</h1>
        <p class="lg-subtitle">{{ t(`legalTest.${doc}Subtitle`) }}</p>
        <p class="lg-updated">{{ t(`${doc}.lastUpdate`) }} {{ lastUpdateDate }}</p>
      </div>
    </header>

    <div class="lg-container">
      <nav class="lg-toc" :aria-label="t('legalTest.toc')">
        <p class="lg-toc-title">{{ t('legalTest.toc') }}</p>
        <ol>
          <li v-for="entry in toc" :key="entry.anchor">
            <a :href="`#${entry.anchor}`" class="lg-toc-link">
              <span class="lg-toc-index">{{ entry.index }}</span>
              {{ t(entry.titleKey) }}
            </a>
          </li>
        </ol>
        <NuxtLink :to="localePath(otherDocPath)" class="lg-toc-other">
          <Icon name="mdi:arrow-right" size="16px" />
          {{ t(`${otherDoc}.title`) }}
        </NuxtLink>
      </nav>

      <div class="lg-sections">
        <section
          v-for="(section, i) in sections"
          :id="toc[i]!.anchor"
          :key="section.key"
          class="lg-section"
        >
          <h2 class="lg-h2">
            <span class="lg-h2-index">{{ toc[i]!.index }}</span>
            <Icon :name="section.icon" size="22px" class="lg-h2-icon" />
            {{ t(toc[i]!.titleKey) }}
          </h2>
          <div class="lg-body">
            <template v-for="(block, j) in section.blocks" :key="j">
              <h3 v-if="block.kind === 'h3'" class="lg-h3">{{ t(block.text) }}</h3>
              <p v-else-if="block.kind === 'p' && block.html" v-html="t(block.text)" />
              <p v-else-if="block.kind === 'p'">{{ t(block.text) }}</p>
              <ul v-else-if="block.kind === 'list'" class="lg-list">
                <li v-for="item in block.items" :key="item">{{ t(item) }}</li>
              </ul>
              <a
                v-else-if="block.kind === 'link'"
                :href="t(block.href)"
                target="_blank"
                rel="noopener noreferrer"
                class="lg-link"
              >
                <Icon name="mdi:open-in-new" size="16px" />
                {{ t(block.label) }}
              </a>
            </template>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LEGAL_DOCS, legalToc, type LegalDoc } from '~/utils/legalPageGaming'

const props = defineProps<{ doc: LegalDoc }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const sections = computed(() => LEGAL_DOCS[props.doc])
const toc = computed(() => legalToc(props.doc))
const otherDoc = computed<LegalDoc>(() => (props.doc === 'privacy' ? 'legal' : 'privacy'))
const otherDocPath = computed(() => `/${otherDoc.value}`)
const heroIcon = computed(() =>
  props.doc === 'privacy' ? 'mdi:shield-lock-outline' : 'mdi:file-document-outline'
)

const lastUpdateDate = computed(() =>
  new Date().toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
)
</script>

<style scoped>
/* Couleurs : uniquement les tokens du site (même langage que la home). */
.lg-page {
  width: 100%;
  padding-bottom: 3rem;
}

.lg-hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.3);
  background:
    radial-gradient(ellipse at 85% 0%, rgb(var(--rgb-accent) / 0.14), transparent 60%),
    var(--color-blue-600);
}

.lg-hero-inner {
  padding: 3rem 16px 2rem;
}

@media (min-width: 640px) {
  .lg-hero-inner {
    padding-inline: 2rem;
  }
}

.lg-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(var(--rgb-accent) / 0.75);
}

.lg-title {
  margin-top: 0.35rem;
  font-size: clamp(2rem, 5vw, 3.75rem);
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-accent);
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.5);
}

.lg-subtitle {
  margin-top: 0.75rem;
  max-width: 40rem;
  font-size: 1.05rem;
  color: rgb(var(--rgb-text) / 0.8);
}

.lg-updated {
  margin-top: 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.55);
}

.lg-container {
  display: grid;
  gap: 2rem;
  padding: 2rem 16px 0;
}

@media (min-width: 640px) {
  .lg-container {
    padding-inline: 2rem;
  }
}

@media (min-width: 1024px) {
  .lg-container {
    grid-template-columns: 16rem minmax(0, 52rem);
  }
}

.lg-toc {
  align-self: start;
  border: 1px solid rgb(var(--rgb-accent) / 0.25);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-chrome) / 0.6);
  padding: 1rem;
}

@media (min-width: 1024px) {
  .lg-toc {
    position: sticky;
    top: 5rem;
  }
}

.lg-toc-title {
  margin-bottom: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.6);
}

.lg-toc-link {
  display: flex;
  gap: 0.6rem;
  border-radius: 0.375rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
  color: rgb(var(--rgb-text) / 0.8);
  transition: background 0.15s;
}

.lg-toc-link:hover {
  background: rgb(var(--rgb-accent) / 0.12);
  color: var(--color-text);
}

.lg-toc-index {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--color-accent);
}

.lg-toc-other {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border-top: 1px solid rgb(var(--rgb-accent) / 0.2);
  padding-top: 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-accent);
}

.lg-toc-other:hover {
  text-decoration: underline;
}

.lg-sections {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.lg-section {
  scroll-margin-top: 5rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.18);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-chrome) / 0.45);
  padding: 1.25rem;
}

@media (min-width: 640px) {
  .lg-section {
    padding: 1.5rem 1.75rem;
  }
}

.lg-h2 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.2rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-accent);
}

.lg-h2-index {
  font-size: 0.85rem;
  color: rgb(var(--rgb-accent) / 0.7);
  font-variant-numeric: tabular-nums;
}

.lg-h2-icon {
  color: var(--color-accent);
}

.lg-body {
  margin-top: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  line-height: 1.65;
  color: rgb(var(--rgb-text) / 0.82);
}

.lg-h3 {
  margin-top: 0.6rem;
  font-weight: 800;
  color: var(--color-text);
}

.lg-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lg-list li {
  position: relative;
  padding-left: 1.1rem;
}

.lg-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.65em;
  width: 6px;
  height: 6px;
  transform: rotate(45deg);
  background: var(--color-accent);
}

.lg-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: fit-content;
  font-weight: 700;
  color: var(--color-accent);
  word-break: break-all;
}

.lg-link:hover {
  text-decoration: underline;
}

.lg-body :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
}

.lg-body :deep(strong) {
  color: var(--color-text);
}
</style>

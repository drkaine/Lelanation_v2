<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { setConsent } from "../consent";
import { getSettings, setSettings } from "../settings";

const emit = defineEmits<{ (e: "accepted"): void }>();

const locale = ref<"fr" | "en">("fr");
const consentChecked = ref(false);

// Image from web via cachedimg protocol (downloads once, stores in app cache)
const avatarUrl = "cachedimg://localhost/static/lelariva-quality.png";

const t = computed(() => {
  const d = {
    fr: {
      language: "Langue",
      title: "Lelanation Companion",
      subtitle:
        "Application locale pour importer rapidement des builds dans le client League of Legends.",
      dataTitle: "Donnees touchees par l'application",
      dataRead: "Ce qui est lu localement (PC):",
      dataReadItems: [
        "Le lockfile Riot local pour se connecter a l'API locale du client LoL.",
        "Les metadonnees du dernier match (matchId, platformId/region) via l'API locale LCU.",
      ],
      dataSent: "Ce qui est envoye au serveur Lelanation:",
      dataSentItems: [
        "matchId",
        "region (euw1, eun1, tr1, ru, me1)",
      ],
      dataLocal: "Ce qui reste uniquement sur votre appareil:",
      dataLocalItems: [
        "favoris locaux",
        "parametres d'import (runes, items, sorts)",
        "consentement",
      ],
      dataNoSend:
        "Aucune capture d'ecran, aucun token Riot, aucun mot de passe Windows, aucun chat n'est collecte.",
      legal: "Politique de confidentialite",
      consent:
        "J'accepte explicitement l'envoi du matchId et de la region apres mes parties.",
      continue: "Accepter et continuer",
    },
    en: {
      language: "Language",
      title: "Lelanation Companion",
      subtitle:
        "Local app to quickly import builds into the League of Legends client.",
      dataTitle: "Data accessed by the app",
      dataRead: "What is read locally (your PC):",
      dataReadItems: [
        "The local Riot lockfile to authenticate against the local LoL client API.",
        "Latest match metadata (matchId, platformId/region) from the local LCU API.",
      ],
      dataSent: "What is sent to the Lelanation server:",
      dataSentItems: [
        "matchId",
        "region (euw1, eun1, tr1, ru, me1)",
      ],
      dataLocal: "What stays only on your device:",
      dataLocalItems: [
        "local favorites",
        "import settings (runes, items, spells)",
        "consent choice",
      ],
      dataNoSend:
        "No screenshots, no Riot token, no Windows password, and no chat messages are collected.",
      legal: "Privacy policy",
      consent:
        "I explicitly agree to send matchId and region after my games.",
      continue: "Accept and continue",
    },
  } as const;
  return d[locale.value];
});

function accept() {
  if (!consentChecked.value) return;
  setConsent();
  emit("accepted");
}

onMounted(() => {
  const saved = getSettings().language;
  if (saved === "fr" || saved === "en") {
    locale.value = saved;
    return;
  }
  const lang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "fr";
  locale.value = lang.startsWith("fr") ? "fr" : "en";
});

watch(locale, (next) => {
  setSettings({ language: next });
});
</script>

<template>
  <div class="consent-shell">
    <div class="consent">
      <div class="lang-row">
        <label for="lang">{{ t.language }}</label>
        <select id="lang" v-model="locale">
          <option value="fr">Francais</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="hero">
        <div class="avatar-wrap">
          <img :src="avatarUrl" alt="Lelariva" class="avatar" />
        </div>
        <div class="hero-text">
          <h1>{{ t.title }}</h1>
          <p>{{ t.subtitle }}</p>
        </div>
      </div>

      <section class="data-box">
        <h2>{{ t.dataTitle }}</h2>

        <h3>{{ t.dataRead }}</h3>
        <ul>
          <li v-for="line in t.dataReadItems" :key="line">{{ line }}</li>
        </ul>

        <h3>{{ t.dataSent }}</h3>
        <ul>
          <li v-for="line in t.dataSentItems" :key="line">{{ line }}</li>
        </ul>

        <h3>{{ t.dataLocal }}</h3>
        <ul>
          <li v-for="line in t.dataLocalItems" :key="line">{{ line }}</li>
        </ul>

        <p class="no-send">{{ t.dataNoSend }}</p>

        <p class="policy">
          <a href="https://www.lelanation.fr/privacy" target="_blank" rel="noopener">{{ t.legal }}</a>
        </p>
      </section>

      <label class="checkbox">
        <input v-model="consentChecked" type="checkbox" />
        <span>{{ t.consent }}</span>
      </label>

      <button type="button" class="accept" :disabled="!consentChecked" @click="accept">
        {{ t.continue }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.consent-shell {
  min-height: 100vh;
  padding: 1rem;
}

.consent {
  max-width: 760px;
  margin: 1rem auto;
  padding: 1rem 1.2rem 1.3rem;
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(30, 40, 45, 0.82), rgba(10, 20, 40, 0.93));
  text-align: left;
  color: #f0e6d2;
}

.lang-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.8rem;
}

.lang-row label {
  font-size: 0.8rem;
  color: rgba(200, 170, 110, 0.95);
}

.lang-row select {
  background: rgba(9, 20, 40, 0.95);
  color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.55);
  border-radius: 6px;
  padding: 0.2rem 0.45rem;
}

.hero {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.avatar-wrap {
  width: 68px;
  height: 68px;
  flex: 0 0 68px;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid rgba(200, 155, 60, 0.75);
}

.hero-text h1 {
  margin: 0;
  font-size: 1.2rem;
}

.hero-text p {
  margin: 0.2rem 0 0;
  color: rgba(240, 230, 210, 0.88);
  font-size: 0.86rem;
}

.data-box {
  border: 1px solid rgba(200, 155, 60, 0.25);
  border-radius: 10px;
  padding: 0.75rem;
  background: rgba(10, 20, 40, 0.45);
}

.data-box h2 {
  margin: 0 0 0.6rem;
  color: #f0e6d2;
  font-size: 0.95rem;
}

.data-box h3 {
  margin: 0.55rem 0 0.25rem;
  font-size: 0.84rem;
  color: #c8aa6e;
}

.data-box ul {
  margin: 0;
  padding-left: 1rem;
}

.data-box li {
  margin: 0.22rem 0;
  color: rgba(240, 230, 210, 0.9);
  font-size: 0.8rem;
}

.no-send {
  margin-top: 0.65rem;
  font-size: 0.78rem;
  color: #cdfafa;
}

.policy {
  margin: 0.55rem 0 0;
}

.policy a {
  color: #c89b3c;
  text-decoration: none;
}

.policy a:hover {
  text-decoration: underline;
}

.checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.95rem 0 0.8rem;
  cursor: pointer;
  font-size: 0.84rem;
}

.accept {
  display: block;
  width: 100%;
  padding: 0.7rem 1rem;
  font-size: 0.92rem;
  background: rgba(10, 50, 60, 0.85);
  color: #cdfafa;
  border: 1px solid rgba(3, 151, 171, 0.8);
  border-radius: 8px;
  cursor: pointer;
}

.accept:hover:not(:disabled) {
  background: rgba(3, 151, 171, 0.35);
}

.accept:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .hero {
    align-items: flex-start;
  }
}
</style>

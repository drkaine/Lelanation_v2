<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getSettings, setSettings } from "../settings";
import { apiBase } from "../config";
import type { CompanionConfig } from "../companionConfig";

const emit = defineEmits<{ (e: "done"): void }>();

const locale = ref<"fr" | "en">("fr");
const acceptLegal = ref(false);
const shareRankedDuo = ref(false);
const leaguePath = ref("");
const skipLeaguePath = ref(false);
const saving = ref(false);
const formError = ref("");
const canBypassLeaguePath = import.meta.env.DEV;
const DEV_ONBOARDING_BYPASS_KEY = "lelanation-companion-dev-onboarding-bypass";

const avatarUrl = `${apiBase}/images/lelariva-quality.png`;

const strings = computed(() => {
  const d = {
    fr: {
      language: "Langue",
      title: "Lelanation Companion",
      intro:
        "Application Windows pour parcourir les builds publics Lelanation.",
      leagueTitle: "Dossier d'installation League of Legends",
      leagueHint:
        "Sélectionne le dossier racine du jeu (ex. …\\Riot Games\\League of Legends). Pour permettre la connexion au client LoL.",
      browse: "Parcourir…",
      dataTitle: "Données et confidentialité",
      noPersonal:
        "Nous ne collectons aucune donnée personnelle par défaut. Les favoris et filtres restent sur ton PC.",
      serverPublic:
        "Comme sur le site : les builds publics sont chargés depuis le serveur Lelanation ; le reste est local.",
      optionalStatsTitle: "Optionnel — statistiques classées duo",
      optionalStats:
        "Si tu coches la case ci-dessous, tu acceptes que des parties classées en duo (métadonnées nécessaires aux stats) puissent être envoyées au serveur à l’avenir. Sans cette case, aucun envoi de parties.",
      acceptLabel: "J’ai lu et j’accepte les conditions et la politique de confidentialité.",
      privacy: "Politique de confidentialité",
      continue: "Continuer",
      bypassPath: "Bypass dev: continuer sans dossier League",
      errPath: "Indique le dossier League of Legends.",
      errLegal: "Tu dois accepter les conditions pour continuer.",
      errSave: "Impossible d’enregistrer la configuration.",
    },
    en: {
      language: "Language",
      title: "Lelanation Companion",
      intro:
        "Windows app to browse public Lelanation builds.",
      leagueTitle: "League of Legends install folder",
      leagueHint:
        "Pick the game root folder (e.g. …\\Riot Games\\League of Legends). To allow the connection to the LoL client.",
      browse: "Browse…",
      dataTitle: "Data & privacy",
      noPersonal:
        "We do not collect personal data by default. Favorites and filters stay on your device.",
      serverPublic:
        "Like the website: public builds load from Lelanation servers; everything else stays local unless you opt in below.",
      optionalStatsTitle: "Optional — ranked duo stats",
      optionalStats:
        "If you check the box below, you agree that ranked duo match metadata needed for stats may be sent to our servers in a future update. If you leave it unchecked, no match data is sent.",
      acceptLabel: "I have read and accept the terms and privacy policy.",
      privacy: "Privacy policy",
      continue: "Continue",
      bypassPath: "Dev bypass: continue without League folder",
      errPath: "Please set the League of Legends folder.",
      errLegal: "You must accept the terms to continue.",
      errSave: "Could not save configuration.",
    },
  } as const;
  return d[locale.value];
});

async function browseFolder() {
  const picked = await open({
    directory: true,
    multiple: false,
    title: strings.value.leagueTitle,
  });
  if (typeof picked === "string" && picked) {
    leaguePath.value = picked;
  }
}

async function submit() {
  formError.value = "";
  if (!acceptLegal.value) {
    formError.value = strings.value.errLegal;
    return;
  }
  const trimmed = leaguePath.value.trim();
  if (!trimmed && !(canBypassLeaguePath && skipLeaguePath.value)) {
    formError.value = strings.value.errPath;
    return;
  }
  saving.value = true;
  try {
    const cfg: CompanionConfig = {
      leagueInstallPath: trimmed || "",
      onboardingComplete: true,
      shareRankedDuoStats: shareRankedDuo.value,
    };
    await invoke("companion_save_config", { cfg });
    if (canBypassLeaguePath && typeof window !== "undefined") {
      window.localStorage.removeItem(DEV_ONBOARDING_BYPASS_KEY);
    }
    emit("done");
  } catch (err) {
    if (canBypassLeaguePath && skipLeaguePath.value) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEV_ONBOARDING_BYPASS_KEY, "1");
      }
      emit("done");
      return;
    }
    if (canBypassLeaguePath) {
      const msg = err instanceof Error ? err.message : String(err);
      formError.value = `${strings.value.errSave} (${msg})`;
    } else {
      formError.value = strings.value.errSave;
    }
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const saved = getSettings().language;
  if (saved === "fr" || saved === "en") {
    locale.value = saved;
  } else {
    const lang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "fr";
    locale.value = lang.startsWith("fr") ? "fr" : "en";
  }
  try {
    const cfg = await invoke<CompanionConfig>("companion_get_config");
    const p = cfg.leagueInstallPath?.trim();
    if (p) leaguePath.value = p;
  } catch {
    /* ignore */
  }
});

watch(locale, (next) => {
  setSettings({ language: next });
});
</script>

<template>
  <div class="onboarding-shell">
    <div class="onboarding">
      <div class="lang-row">
        <label for="lang">{{ strings.language }}</label>
        <select id="lang" v-model="locale">
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="hero">
        <div class="avatar-wrap">
          <img :src="avatarUrl" alt="Lelanation" class="avatar" />
        </div>
        <div>
          <h1>{{ strings.title }}</h1>
          <p class="intro">{{ strings.intro }}</p>
        </div>
      </div>

      <section class="box">
        <h2>{{ strings.leagueTitle }}</h2>
        <p class="hint">{{ strings.leagueHint }}</p>
        <div class="path-row">
          <input v-model="leaguePath" type="text" readonly class="path-input" :placeholder="strings.leagueTitle" />
          <button type="button" class="btn secondary" @click="browseFolder">{{ strings.browse }}</button>
        </div>
        <label v-if="canBypassLeaguePath" class="check">
          <input v-model="skipLeaguePath" type="checkbox" />
          <span>{{ strings.bypassPath }}</span>
        </label>
      </section>

      <section class="box">
        <h2>{{ strings.dataTitle }}</h2>
        <p>{{ strings.noPersonal }}</p>
        <p>{{ strings.serverPublic }}</p>
        <p>
          <a href="https://www.lelanation.fr/privacy" target="_blank" rel="noopener">{{ strings.privacy }}</a>
        </p>

        <h3 class="sub">{{ strings.optionalStatsTitle }}</h3>
        <p>{{ strings.optionalStats }}</p>

        <label class="check">
          <input v-model="acceptLegal" type="checkbox" />
          <span>{{ strings.acceptLabel }}</span>
        </label>
        <label class="check">
          <input v-model="shareRankedDuo" type="checkbox" />
          <span>{{ strings.optionalStatsTitle }}</span>
        </label>
      </section>

      <p v-if="formError" class="error">{{ formError }}</p>

      <button type="button" class="btn primary" :disabled="saving" @click="submit">
        {{ strings.continue }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.onboarding-shell {
  min-height: 100vh;
  padding: 1rem;
}
.onboarding {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.25rem;
  border: 1px solid rgba(200, 155, 60, 0.45);
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(30, 40, 45, 0.82), rgba(10, 20, 40, 0.93));
  color: #f0e6d2;
}
.lang-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.lang-row select {
  background: rgba(9, 20, 40, 0.95);
  color: #f0e6d2;
  border: 1px solid rgba(200, 155, 60, 0.55);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
}
.hero {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.25rem;
}
.avatar-wrap {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
}
.avatar {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid rgba(200, 155, 60, 0.75);
}
h1 {
  margin: 0;
  font-size: 1.35rem;
}
.intro {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
  opacity: 0.9;
}
.box {
  border: 1px solid rgba(200, 155, 60, 0.25);
  border-radius: 10px;
  padding: 0.9rem;
  margin-bottom: 1rem;
  background: rgba(10, 20, 40, 0.45);
}
.box h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: #c8aa6e;
}
.box h3.sub {
  margin: 0.75rem 0 0.35rem;
  font-size: 0.9rem;
  color: #c8aa6e;
}
.hint {
  font-size: 0.82rem;
  opacity: 0.88;
  margin: 0 0 0.65rem;
}
.path-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.path-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.4);
  background: rgba(5, 15, 35, 0.9);
  color: #f0e6d2;
}
.check {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin-top: 0.65rem;
  cursor: pointer;
  font-size: 0.88rem;
}
.error {
  color: #ff6b6b;
  font-size: 0.86rem;
}
.btn {
  padding: 0.65rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.92rem;
  border: 1px solid transparent;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn.primary {
  width: 100%;
  margin-top: 0.5rem;
  background: rgba(10, 50, 60, 0.85);
  color: #cdfafa;
  border-color: rgba(3, 151, 171, 0.8);
}
.btn.primary:hover:not(:disabled) {
  background: rgba(3, 151, 171, 0.35);
}
.btn.secondary {
  background: rgba(30, 40, 45, 0.9);
  color: #f0e6d2;
  border-color: rgba(200, 155, 60, 0.55);
}
a {
  color: #c89b3c;
}
</style>

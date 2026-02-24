<script setup lang="ts">
import { setConsent } from "../consent";

const emit = defineEmits<{ (e: "accepted"): void }>();

function accept() {
  setConsent();
  emit("accepted");
}
</script>

<template>
  <div class="consent">
    <h1>Lelanation Companion</h1>
    <p class="intro">
      Pour enrichir les statistiques du site, l'application peut envoyer l'identifiant du match et la région (ex. EUW, EUNE) en fin de partie.
      Les favoris et paramètres restent uniquement sur cet appareil.
    </p>
    <p class="policy">
      <a href="https://www.lelanation.fr/mentions-legales" target="_blank" rel="noopener">Politique de confidentialité</a>
    </p>
    <label class="checkbox">
      <input type="checkbox" required />
      <span>J'accepte l'envoi du match ID et de la région en fin de partie.</span>
    </label>
    <button type="button" class="accept" @click="accept">Accepter et continuer</button>
  </div>
</template>

<style scoped>
.consent {
  max-width: 480px;
  margin: 2rem auto;
  padding: 1.5rem;
  text-align: left;
}
.intro,
.policy {
  margin-bottom: 1rem;
  color: #333;
}
.checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 1.5rem 0;
  cursor: pointer;
}
.accept {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  background: #396cd8;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.accept:hover {
  background: #2a5bc7;
}
</style>

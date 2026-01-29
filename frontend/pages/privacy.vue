<template>
  <div class="min-h-screen p-4 text-text">
    <div class="mx-auto max-w-3xl space-y-8">
      <h1 class="text-3xl font-bold text-text-accent">Politique de confidentialité</h1>

      <!-- Données collectées -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Données collectées</h2>
        <p class="mt-2 text-text/80">
          Lelanation utilise le stockage local du navigateur (localStorage) pour sauvegarder vos
          builds et certaines préférences (ex: votes, consentement aux cookies, onglet actif). Aucun
          compte n'est requis et aucune donnée personnelle n'est collectée.
        </p>
        <p class="mt-2 text-text/80">
          Toutes les données sont stockées localement sur votre appareil et ne sont jamais
          transmises à des serveurs externes, sauf lorsque vous choisissez de partager un build
          publiquement.
        </p>
      </section>

      <!-- Cookies -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Cookies et technologies similaires</h2>

        <h3 class="mt-4 text-lg font-semibold text-text">Cookies essentiels</h3>
        <p class="mt-2 text-text/80">
          Lelanation n'utilise pas de cookies HTTP traditionnels. À la place, nous utilisons le
          <strong>localStorage</strong> du navigateur pour stocker :
        </p>
        <ul class="mt-2 list-inside list-disc space-y-1 text-text/80">
          <li>Vos builds sauvegardés</li>
          <li>Vos votes sur les builds</li>
          <li>Votre consentement aux cookies</li>
          <li>Vos préférences d'interface (onglet actif, etc.)</li>
        </ul>
        <p class="mt-2 text-text/80">
          Ces données sont nécessaires au fonctionnement du site et ne nécessitent pas de
          consentement explicite selon le RGPD, car elles sont strictement nécessaires à la
          fourniture du service demandé.
        </p>

        <h3 class="mt-6 text-lg font-semibold text-text">Cookies non essentiels</h3>
        <p class="mt-2 text-text/80">
          Actuellement, <strong>Lelanation n'utilise aucun cookie non essentiel</strong> (cookies de
          suivi, cookies publicitaires, cookies d'analyse d'audience).
        </p>
        <p class="mt-2 text-text/80">
          Si des outils de mesure d'audience (ex: Matomo, Google Analytics) ou d'autres services
          tiers sont ajoutés à l'avenir, ils seront soumis à votre consentement explicite via la
          bannière de consentement aux cookies.
        </p>

        <h3 class="mt-6 text-lg font-semibold text-text">Gestion de vos préférences</h3>
        <p class="mt-2 text-text/80">
          Vous pouvez à tout moment modifier ou supprimer les données stockées dans votre navigateur
          en :
        </p>
        <ul class="mt-2 list-inside list-disc space-y-1 text-text/80">
          <li>Supprimant les données du site dans les paramètres de votre navigateur</li>
          <li>Utilisant le mode navigation privée</li>
          <li>Désactivant le JavaScript (cela empêchera le fonctionnement du site)</li>
        </ul>
      </section>

      <!-- Partage de builds -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Partage de builds</h2>
        <p class="mt-2 text-text/80">
          Lorsque vous choisissez de rendre un build public, celui-ci est stocké sur nos serveurs et
          peut être consulté par tous les utilisateurs du site. Les builds publics incluent
          uniquement les informations que vous avez choisies de partager (nom, description, auteur,
          configuration du build).
        </p>
        <p class="mt-2 text-text/80">
          Vous pouvez à tout moment supprimer un build public depuis la page "Mes Builds" ou en le
          rendant privé.
        </p>
      </section>

      <!-- Données tierces -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Données provenant de tiers</h2>
        <p class="mt-2 text-text/80">
          Lelanation récupère des données de jeu (champions, items, runes, etc.) depuis l'API Data
          Dragon de Riot Games. Ces données sont mises en cache localement pour améliorer les
          performances du site.
        </p>
        <p class="mt-2 text-text/80">
          Aucune donnée personnelle n'est partagée avec Riot Games ou d'autres tiers dans le cadre
          de cette récupération de données.
        </p>
      </section>

      <!-- Vos droits -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Vos droits</h2>
        <p class="mt-2 text-text/80">Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul class="mt-2 list-inside list-disc space-y-1 text-text/80">
          <li>
            <strong>Droit d'accès</strong> : Vous pouvez consulter toutes vos données stockées
            localement
          </li>
          <li>
            <strong>Droit de rectification</strong> : Vous pouvez modifier vos builds et préférences
            à tout moment
          </li>
          <li>
            <strong>Droit à l'effacement</strong> : Vous pouvez supprimer vos builds et données
            localement
          </li>
          <li>
            <strong>Droit à la portabilité</strong> : Vos données sont déjà dans votre navigateur,
            vous pouvez les exporter
          </li>
        </ul>
        <p class="mt-2 text-text/80">
          Pour exercer ces droits, vous pouvez simplement supprimer les données du site dans les
          paramètres de votre navigateur ou supprimer individuellement vos builds depuis
          l'interface.
        </p>
      </section>

      <!-- Contact -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Contact</h2>
        <p class="mt-2 text-text/80">
          Pour toute question concernant cette politique de confidentialité, vous pouvez nous
          contacter via les réseaux sociaux ou le Discord de Lelanation.
        </p>
      </section>

      <!-- Dernière mise à jour -->
      <section>
        <p class="mt-8 text-sm text-text/60">Dernière mise à jour : {{ lastUpdateDate }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Politique de confidentialité - Lelanation',
  meta: [
    {
      name: 'description',
      content:
        'Politique de confidentialité de Lelanation - Informations sur les cookies, les données collectées et vos droits',
    },
    { name: 'robots', content: 'index,follow' },
  ],
})

const lastUpdateDate = new Date().toLocaleDateString('fr-FR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
</script>

<template>
  <div class="min-h-screen p-4 text-text">
    <div class="mx-auto max-w-3xl space-y-8">
      <h1 class="text-3xl font-bold text-text-accent">Mentions légales</h1>

      <!-- Informations sur le site -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Informations sur le site</h2>
        <p class="mt-2 text-text/80">
          Le site <strong>Lelanation</strong> est une plateforme communautaire dédiée aux builds
          League of Legends. Ce site est édité à titre personnel et n'est pas affilié, associé,
          autorisé, approuvé ou parrainé par Riot Games, Inc. ou ses filiales.
        </p>
      </section>

      <!-- Riot Games -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Données de Riot Games</h2>
        <p class="mt-2 text-text/80">
          Ce site utilise des données de jeu (champions, items, runes, sorts d'invocateur, etc.)
          provenant de l'API Data Dragon de <strong>Riot Games, Inc.</strong>
        </p>
        <p class="mt-2 text-text/80">
          <strong>Lelanation n'est pas un partenaire officiel de Riot Games</strong> et n'a aucun
          droit, licence ou autorisation officielle de la part de Riot Games pour l'utilisation de
          ces données. L'utilisation de ces données se fait dans le cadre de la politique
          d'utilisation des données de Riot Games pour les projets communautaires non commerciaux.
        </p>
        <p class="mt-2 text-text/80">
          League of Legends est une marque déposée de Riot Games, Inc. Tous les droits sont réservés
          à Riot Games, Inc.
        </p>
        <p class="mt-2 text-text/80">
          Pour plus d'informations sur la politique d'utilisation des données de Riot Games,
          veuillez consulter :
          <a
            href="https://www.riotgames.com/fr/legal"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent underline hover:text-accent-dark"
          >
            https://www.riotgames.com/fr/legal
          </a>
        </p>
      </section>

      <!-- Lelariva -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Contenu de Lelariva</h2>
        <p class="mt-2 text-text/80">
          Ce site peut faire référence au créateur de contenu YouTube <strong>Lelariva</strong> et
          peut utiliser certaines de ses vidéos ou contenus dans le cadre de la fonctionnalité de
          découverte de builds.
        </p>
        <p class="mt-2 text-text/80">
          <strong>Lelanation n'est pas un partenaire officiel de Lelariva</strong> et n'a aucun
          droit, licence ou autorisation officielle de la part de Lelariva pour l'utilisation de son
          contenu. L'utilisation de ce contenu se fait dans le cadre de l'utilisation équitable et
          de la promotion de contenu communautaire.
        </p>
        <p class="mt-2 text-text/80">
          Tous les droits sur le contenu de Lelariva restent la propriété de Lelariva. Si vous êtes
          Lelariva et souhaitez que votre contenu soit retiré de ce site, veuillez nous contacter.
        </p>
      </section>

      <!-- Propriété intellectuelle -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Propriété intellectuelle</h2>
        <p class="mt-2 text-text/80">
          Tous les contenus créés par les utilisateurs de Lelanation (builds, descriptions, etc.)
          restent la propriété de leurs auteurs respectifs. En publiant du contenu sur Lelanation,
          vous accordez au site le droit de l'afficher et de le partager dans le cadre de la
          plateforme.
        </p>
        <p class="mt-2 text-text/80">
          Le design, la structure et le code source de Lelanation sont protégés par les lois sur la
          propriété intellectuelle.
        </p>
      </section>

      <!-- Responsabilité -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Responsabilité</h2>
        <p class="mt-2 text-text/80">
          Lelanation est un site communautaire. Les builds et contenus partagés par les utilisateurs
          sont fournis à titre informatif uniquement. Nous ne garantissons pas l'exactitude, la
          pertinence ou l'efficacité des builds partagés.
        </p>
        <p class="mt-2 text-text/80">
          Lelanation ne peut être tenu responsable des dommages directs ou indirects résultant de
          l'utilisation ou de l'impossibilité d'utiliser le site ou son contenu.
        </p>
      </section>

      <!-- Contact -->
      <section>
        <h2 class="mt-8 text-xl font-bold text-text">Contact</h2>
        <p class="mt-2 text-text/80">
          Pour toute question concernant ces mentions légales ou pour signaler un contenu, vous
          pouvez nous contacter via les réseaux sociaux ou le formulaire de contact.
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
  title: 'Mentions légales - Lelanation',
  meta: [
    {
      name: 'description',
      content:
        "Mentions légales de Lelanation - Informations sur l'utilisation des données de Riot Games et du contenu de Lelariva",
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

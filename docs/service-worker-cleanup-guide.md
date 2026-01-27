# Guide de nettoyage des Service Workers hérités

## 🎯 Problème

Lors d'une migration ou refonte majeure (ex: v1 → v2), les Service Workers (SW) installés par une version précédente peuvent persister dans les navigateurs des utilisateurs, causant:

- **Écrans blancs** au chargement
- **Conflits de cache** (ancien JS avec nouveau HTML)
- **Comportements incohérents** selon les utilisateurs

## 🔍 Diagnostic

### Symptômes typiques

| Symptôme | Cause probable |
|----------|----------------|
| Page blanche au chargement | SW sert un cache obsolète |
| Ctrl+R fonctionne | Bypass du cache SW |
| Nouveau navigateur OK | Pas encore de SW installé |
| Même domaine = bug persistant | SW attaché au domaine |

### Vérification dans le navigateur

1. Ouvrir DevTools (F12)
2. Onglet **Application** → **Service Workers**
3. Vérifier s'il y a des SW enregistrés
4. Si oui → **diagnostic confirmé**

## ✅ Solution immédiate

### Étape 1: Activer le plugin de nettoyage

Un plugin client a été créé dans `frontend/plugins/cleanup-service-worker.client.ts`.

Ce plugin:
- ✅ Supprime automatiquement tous les SW enregistrés
- ✅ Vide tous les caches du SW
- ✅ S'exécute au chargement de chaque page

**Le plugin est déjà actif** - il suffit de déployer.

### Étape 2: Vérifier la configuration Nginx

Assurez-vous que votre configuration Nginx inclut:

```nginx
# Service Workers - JAMAIS CACHÉS
location ~* ^/(sw\.js|sw\.js\.map|workbox-.*\.js)$ {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

Voir `docs/nginx-config-recommended.conf` pour la configuration complète.

### Étape 3: Déployer et tester

1. **Déployer** la nouvelle version avec le plugin
2. **Tester** sur un navigateur avec un SW existant
3. **Vérifier** dans DevTools → Application → Service Workers
4. Le SW devrait être **supprimé automatiquement**

## 🧹 Nettoyage manuel (si nécessaire)

Si le plugin ne fonctionne pas, les utilisateurs peuvent nettoyer manuellement:

### Chrome/Edge
1. F12 → Application → Service Workers
2. Cliquer sur **Unregister** pour chaque SW
3. Application → Storage → Clear site data

### Firefox
1. F12 → Storage → Service Workers
2. Clic droit → **Unregister**
3. Storage → Clear All

## ⚠️ Important: Désactiver le plugin après quelques semaines

Une fois que tous les utilisateurs ont rechargé le site (2-4 semaines), **désactivez le plugin**:

1. Supprimer ou renommer `frontend/plugins/cleanup-service-worker.client.ts`
2. Redéployer

**Pourquoi?** Le plugin ajoute une petite surcharge au chargement de chaque page. Une fois que tous les anciens SW sont supprimés, il n'est plus nécessaire.

## 🛡️ Prévention future

### Si vous réinstallez un module PWA

Si vous décidez d'utiliser `@vite-pwa/nuxt` ou `@nuxtjs/pwa` à l'avenir:

```ts
// nuxt.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    cleanupOutdatedCaches: true,  // ⚠️ CRITIQUE
    skipWaiting: true,
    clientsClaim: true
  }
})
```

**Sans `cleanupOutdatedCaches: true`** → risque de caches zombies.

### Règle d'or

> **Un domaine = un Service Worker à vie**

À chaque refonte majeure:
- Soit changer de domaine/subdomain
- Soit forcer la purge du SW (comme maintenant)

## 📊 Suivi

Pour vérifier que le nettoyage fonctionne:

1. **Analytics**: Surveiller les erreurs JS dans votre outil d'analytics
2. **Logs serveur**: Vérifier les logs Nginx pour les requêtes vers `/sw.js`
3. **Feedback utilisateurs**: Demander aux utilisateurs de signaler les écrans blancs

## 🔗 Références

- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox: Cleanup Outdated Caches](https://developers.google.com/web/tools/workbox/modules/workbox-precaching#cleanup_outdated_caches)
- [Nuxt PWA Module](https://vite-pwa-org.netlify.app/frameworks/nuxt.html)

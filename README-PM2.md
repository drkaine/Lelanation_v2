# Configuration PM2

## Applications gérées par PM2

- **lelanation-backend** : Backend Express.js sur le port 4001
- **lelanation-frontend** : Frontend Nuxt 3 sur le port 3000

## Commandes utiles

```bash
# Voir le statut des applications
pm2 status

# Voir les logs
pm2 logs lelanation-backend
pm2 logs lelanation-frontend

# Redémarrer une application
pm2 restart lelanation-backend
pm2 restart lelanation-frontend

# Arrêter une application
pm2 stop lelanation-backend

# Démarrer une application
pm2 start lelanation-backend

# Supprimer une application
pm2 delete lelanation-backend

# Redémarrer toutes les applications Lelanation
pm2 restart ecosystem.config.js

# Sauvegarder la configuration actuelle
pm2 save
```

## Démarrage automatique au boot

Pour que les applications se relancent automatiquement après un redémarrage du serveur :

```bash
sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v24.4.1/bin /home/ubuntu/.nvm/versions/node/v24.4.1/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Cette commande crée un service systemd qui démarre PM2 au boot.

## Configuration

Le fichier `ecosystem.config.js` à la racine du projet contient la configuration PM2.

## Clé API Riot (admin)

Quand vous enregistrez ou modifiez la clé API Riot dans l’admin (onglet Clé API Riot), le backend :

1. Invalide le cache de la clé en mémoire.
2. Lance en arrière-plan : `npm run build` (dans le répertoire backend) puis `pm2 restart <app>`.

Le nom de l’app PM2 utilisée pour le restart est **lelanation-backend** par défaut. Pour le changer (ex. si votre `ecosystem.config.js` utilise un autre nom), définir la variable d’environnement :

```bash
PM2_APP_NAME=mon-app-backend
```

Si `pm2` n’est pas dans le `PATH` ou si le restart échoue, la sauvegarde de la clé réussit quand même ; un message est écrit dans les logs du backend.

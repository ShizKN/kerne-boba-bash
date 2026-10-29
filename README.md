# KERNE

Salles d’étude collaboratives : vidéo, audio, chat, tableaux blancs et partage d’écran. [Voir le site](https://kerne.apospace.com).

## Code à examiner

- `site/index.html` : accueil et accès aux salles.
- `site/room.html` : interface et logique des salles.
- `site/signaling.js` : connexion temps réel et reconnexion.
- `worker/index.js` : attribution des salles, signalisation WebRTC, chat et tableaux blancs.

Le site est statique et fonctionne sans compilation. Le Worker Cloudflare et son Durable Object synchronisent les élèves. La vidéo et l’audio utilisent WebRTC ; les identifiants TURN temporaires sont générés côté Worker.

## Lancer et publier

```sh
cd worker
npm ci
npm run check
npm run deploy
cd ..
npx wrangler pages deploy site --project-name kernee --branch main
```

Les secrets `TURN_KEY_ID` et `TURN_KEY_API_TOKEN` doivent être configurés dans le Worker Cloudflare. Aucune clé n’est incluse ici. Un domaine local doit être ajouté à la liste des origines autorisées pour tester un autre hôte.

## Vérification

Le protocole de salle, le chat, les tableaux blancs et les métadonnées de partage ont été testés localement avec deux connexions. La syntaxe des scripts et le Worker ont été vérifiés. La qualité audio/vidéo dépend aussi du navigateur et du réseau des participants.

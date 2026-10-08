# Affiche augmentée — sérigraphie × réalité augmentée

Ton affiche imprimée devient le déclencheur d'une expérience en réalité augmentée (RA) : on la vise avec un téléphone, et tes typons se décollent, une vidéo en jaillit, un objet 3D apparaît…
Tout se passe dans le navigateur (pas d'application à installer), et **tu ne modifies qu'un seul dossier : `experience/`**.

```
experience/
├─ experience.json   ← ce que fait ton expérience (tu travailles ici)
├─ assets/           ← tes fichiers : PNG, vidéos, modèles 3D, sons
├─ target/           ← la « cible » de ton affiche (fournie par l'enseignant, ne pas toucher)
└─ behaviors/        ← du code optionnel (niveau avancé)
```

Tout le reste (`core/`, `scripts/`…) fait marcher l'AR : **on n'y touche pas**. Si un bandeau rouge « Le dossier core/ a été modifié » apparaît, préviens ton enseignant.

---

## Démarrer en 5 étapes

1. **Copier le projet.** Sur la page GitHub du template (lien donné par l'enseignant), clique sur **Use this template › Create a new repository** (ou **Fork**). Donne-lui un nom simple, par ex. `affiche-ra`.
2. **Activer la publication.** Dans ton dépôt GitHub : **Settings › Pages › Build and deployment › Source : GitHub Actions**. À faire une seule fois.
3. **Ouvrir dans AI Studio.** Dans [AI Studio](https://aistudio.google.com), mode **Build** : bouton **+** › **Import from GitHub**, choisis ton dépôt. Puis colle le message de [STARTER_PROMPT.md](STARTER_PROMPT.md) en premier message, avec ton storyboard.
4. **Créer.** Dépose la cible de ton affiche dans `experience/target/` (dossier donné par l'enseignant) et tes fichiers dans `experience/assets/`. Fais modifier `experience.json` par l'agent, et vérifie dans l'aperçu : il montre ton affiche en 3D, avec les boutons **▶ Détection**, **■ Perte** et **Tap** pour simuler le téléphone. Tourne autour de l'affiche à la souris.
5. **Publier et tester.** Envoie tes modifications vers GitHub (synchronisation GitHub d'AI Studio). Une à deux minutes plus tard, ton site est en ligne à l'adresse :
   `https://TON-PSEUDO.github.io/NOM-DU-DEPOT/`
   (onglet **Actions** de ton dépôt : coche verte = publié). Ouvre cette adresse sur ordinateur, ajoute `?preview=1`, et clique sur **QR** : scanne-le avec ton téléphone, touche **Démarrer l'expérience**, vise ton affiche.

> Dans l'aperçu d'AI Studio, l'adresse affichée par le bouton QR ne marche pas sur téléphone : utilise toujours l'adresse GitHub Pages.

---

## Comment ça marche

Ton expérience est une liste de **briques** (3 maximum, la brique `ui` ne compte pas). Chaque brique a :

- un **type** : `layers`, `video`, `model`, `particles` ou `ui` ;
- une **position** sur l'affiche ;
- un **déclencheur** (`trigger`) : ce qui la fait apparaître ;
- une **apparition** (`appear`) : comment elle arrive.

### Les positions, comme dans ta mise en page

```
(0,0) ──────────── x ──────────── (1,0)
  │                                  │
  │      x: 0.5, y: 0.25             │
  y      = centre, au quart du haut  │
  │                                  │
(0,1) ─────────────────────────── (1,1)
```

- `x` et `y` vont de **0 à 1** depuis le **coin haut-gauche** de l'affiche, quel que soit son format.
- `z` = décollement vers toi, en **largeur d'affiche** : `0.1` = 10 % de la largeur (≈ 3 cm sur un A3).
- `width` (et `size` pour la 3D) = taille, aussi en largeur d'affiche : `0.5` = la moitié de la largeur.

### Les déclencheurs (`trigger`)

| Valeur | Effet |
|---|---|
| `"found"` | dès que l'affiche est détectée (par défaut) |
| `{ "type": "delay", "ms": 2000 }` | 2 secondes après la détection |
| `"tap"` ou `{ "type": "tap", "toggle": true }` | quand on touche l'écran (`toggle` : un 2ᵉ tap la cache) |
| `{ "type": "tap", "on": "typons" }` | quand on touche la brique `typons` |
| `{ "type": "tilt", "min": 30 }` | tant qu'on regarde l'affiche de biais (plus de 30°) |
| `{ "type": "distance", "near": 0.8 }` | tant qu'on est proche (moins de 0,8 largeur d'affiche) |
| `{ "type": "distance", "far": 2 }` | tant qu'on est loin (plus de 2 largeurs) |
| `{ "type": "collected" }` | quand toutes les affiches ont été trouvées (voir « Plusieurs affiches ») |

Options communes : `"delay": 500` (attente supplémentaire en ms), `"appear": "fade" | "pop" | "rise" | "none"`, `"duration": 600` (durée de l'apparition en ms), `"opacity": 1`, `"rotation": 15` (en degrés).

---

## Les briques, par l'exemple

Les quatre exemples complets sont dans [`examples/`](examples). Pour les voir : dans l'aperçu, menu déroulant en bas à gauche (« Exemple 1 · typons »…). Pour en partir, copie le contenu de son `experience.json` dans le tien.

### `layers` — les typons qui se décollent

Un PNG transparent par couleur imprimée, **dans l'ordre d'impression**. Exporte chaque couche au **format exact de l'affiche** (même cadrage) : elles se superposeront parfaitement.

```json
{
  "id": "typons",
  "type": "layers",
  "layers": [
    { "src": "assets/typon-jaune.png", "blend": "multiply" },
    { "src": "assets/typon-rose.png", "blend": "multiply" },
    { "src": "assets/typon-noir.png" }
  ],
  "spread": 0.05,
  "burst": { "duration": 1400, "stagger": 250 },
  "float": 0.01
}
```

- `spread` : écart entre deux couches (0.05 = 5 % de la largeur). Une couche peut avoir son propre `"depth"`.
- `burst` : les couches partent à plat puis se décollent l'une après l'autre (`stagger` = décalage en ms). `"burst": false` pour les poser directement.
- `blend` : `"normal"`, `"multiply"` (comme de l'encre : le blanc devient transparent), `"screen"`, `"add"`.
- `float` : léger flottement (0 à 0.2).
- Par défaut la brique couvre toute l'affiche (`x: 0.5, y: 0.5, width: 1`).

### `video` — une vidéo calée sur l'affiche

```json
{
  "id": "surprise",
  "type": "video",
  "src": "assets/ma-video.mp4",
  "trigger": { "type": "tap", "toggle": true },
  "appear": "pop",
  "x": 0.7, "y": 0.4, "z": 0.15, "width": 0.5,
  "loop": true,
  "sound": true,
  "chroma": { "keyColor": "#00ff00", "similarity": 0.4, "smoothness": 0.08 }
}
```

- La vidéo démarre **sans son** (règle des navigateurs). Avec `"sound": true`, un bouton haut-parleur apparaît pour l'activer.
- **Transparence** : filme ou anime sur un **fond vert uni**, puis ajoute `chroma`. Reste du vert ? augmente `similarity`. Ton sujet disparaît ? baisse-la. `smoothness` adoucit les bords.
- Format : `.mp4` (H.264), **720p maximum**, quelques secondes en boucle.

### `model` — un objet 3D

```json
{
  "id": "totem",
  "type": "model",
  "src": "assets/objet.glb",
  "x": 0.7, "y": 0.45, "z": 0.2,
  "size": 0.45,
  "rotation": { "x": 0, "y": 30, "z": 0 },
  "animation": "all",
  "autoRotate": 25
}
```

- `size` : taille du plus grand côté du modèle, en largeur d'affiche (le modèle est mis à l'échelle automatiquement).
- `animation` : `"all"` (toutes), `"none"`, ou le nom d'une animation du fichier. `autoRotate` : degrés par seconde.
- Format : **un seul fichier `.glb`** (export Blender : glTF Binary).

### `particles` — paillettes, neige, confettis…

```json
{
  "id": "paillettes",
  "type": "particles",
  "preset": "sparkles",
  "color": ["#ffcc00", "#ffffff"],
  "density": 0.3,
  "x": 0.5, "y": 0.5,
  "area": { "width": 1, "height": 1.4, "depth": 0.5 }
}
```

- `preset` : `"sparkles"`, `"snow"`, `"dust"`, `"bubbles"`, `"confetti"`, `"ink"` (gouttes qui sortent de l'affiche).
- `density` (0 à 1), `speed`, `size` (1 = normal), `direction` : `"up"`, `"down"`, `"out"` (vers toi), `"in"`.
- `area` : la zone où vivent les particules, centrée sur `x`, `y`, `z`.

### `ui` — boutons et infos

```json
{
  "id": "infos",
  "type": "ui",
  "trigger": { "type": "delay", "ms": 1500 },
  "hotspots": [
    { "x": 0.2, "y": 0.1, "label": "?", "text": "Imprimée en 4 passages." },
    { "x": 0.8, "y": 0.8, "label": "+", "text": "Mon portfolio", "link": "https://..." }
  ],
  "cta": { "label": "Voir mon travail", "url": "https://..." },
  "soundButton": true
}
```

- `hotspots` : pastilles accrochées à l'affiche. Avec `text`, un panneau s'ouvre ; avec seulement `link`, le lien s'ouvre.
- `cta` : un gros bouton en bas de l'écran.
- `soundButton` : affiche le bouton son.
- Couleurs et police : section `theme` en haut de `experience.json` :

```json
"theme": { "color": "#ff2d87", "textColor": "#ffffff", "font": "Space Grotesk" }
```

`font` : un nom de police [Google Fonts](https://fonts.google.com), ou ton fichier `"assets/ma-police.woff2"`.

### Réglages généraux

```json
{
  "title": "Mon affiche",
  "author": "Prénom Nom",
  "onLost": "hide",
  "replayOnFound": true,
  "theme": { "color": "#ff3b30", "textColor": "#ffffff", "font": "system-ui" },
  "bricks": [ ]
}
```

- `onLost` : quand le téléphone perd l'affiche, `"hide"` (tout disparaît) ou `"freeze"` (tout reste figé à l'écran).
- `replayOnFound` : rejouer les apparitions à chaque nouvelle détection.
- Une clé `"//"` sert de commentaire : elle est ignorée.

---

## Plusieurs affiches et collection (puzzle, série, chasse au trésor)

Un même site peut reconnaître **plusieurs affiches** (16 maximum, 8 conseillées). Exemple complet : [`examples/05-puzzle`](examples/05-puzzle) — dans l'aperçu, choisis « Exemple 5 », puis change d'affiche avec le menu « ▣ piece-1 ».

1. L'enseignant génère toutes les cibles du groupe d'un coup et te donne le bloc `targets` à coller :

```json
"targets": [
  { "id": "piece-1", "file": "piece-1.json" },
  { "id": "piece-2", "file": "piece-2.json" },
  { "id": "piece-3", "file": "piece-3.json" }
]
```

2. Chaque brique choisit son affiche avec `"target"` :
   - `"target": "piece-2"` : la brique n'apparaît que sur l'affiche 2 ;
   - `"target": "*"` : sur l'affiche visée, quelle qu'elle soit ;
   - sans `"target"` : sur la première affiche de la liste.
   Le conseil « 3 briques maximum » s'applique **par affiche**.

3. La brique **`collection`** affiche une grille en bas (ou en haut) de l'écran : chaque affiche trouvée remplit sa case. La collection est **mémorisée sur le téléphone** (elle survit à un rechargement ; un bouton ↺ permet de recommencer).

```json
{
  "id": "puzzle",
  "type": "collection",
  "columns": 3,
  "pieces": [
    { "target": "piece-1" },
    { "target": "piece-2" },
    { "target": "piece-3", "src": "assets/vignette-3.png" }
  ],
  "position": "bottom",
  "size": 0.4,
  "hint": "Retrouve les 3 affiches",
  "reveal": { "title": "Bravo !", "image": "assets/puzzle-complet.jpg", "text": "Le propos…", "link": "https://..." }
}
```

- Les cases se remplissent dans l'ordre de lecture (de gauche à droite, puis ligne suivante). Par défaut, la vignette est l'image de l'affiche ; `src` permet d'en choisir une autre (par ex. un fragment du puzzle).
- `reveal` : le panneau qui s'ouvre quand tout est trouvé (on peut le rouvrir en touchant la grille).
- La grille est toujours visible : son `trigger` est ignoré.

4. Le déclencheur **`{ "type": "collected" }`** fait apparaître une brique quand toutes les affiches ont été trouvées (ou `"count": 2` pour « au moins 2 »). Combiné à `"target": "*"`, le final apparaît sur n'importe quelle affiche :

```json
{ "id": "final", "type": "model", "src": "assets/final.glb", "target": "*", "trigger": { "type": "collected" } }
```

> La collection est enregistrée **dans le navigateur du téléphone** : un autre téléphone, un autre navigateur ou la navigation privée repartent de zéro.

---

## Niveau avancé : les behaviors

Un behavior est un petit fichier JavaScript dans `experience/behaviors/`, pour ce que les briques ne savent pas faire. Exemple complet : [`examples/04-behavior`](examples/04-behavior).

1. Crée `experience/behaviors/mon-effet.js` :

```js
/** @type {import('../../core/behaviors').Behavior} */
export default {
  onFound(ctx) {},          // l'affiche vient d'être détectée
  onLost(ctx) {},           // l'affiche est perdue
  onTap(ctx, hit) {},       // tap : hit.brick = id de la brique touchée, hit.x / hit.y sur l'affiche
  onUpdate(ctx, t, dt) {    // à chaque image (t et dt en secondes)
    const totem = ctx.bricks.get('totem')
    if (totem) totem.object3d.rotation.y = t
  },
}
```

2. Déclare-le dans `experience.json` : `"behaviors": ["mon-effet"]`.

Ce que contient `ctx` (détail dans `core/behaviors.d.ts`) :
- `ctx.bricks.get(id)` : `object3d`, `show()`, `hide()`, `shown` ;
- `ctx.view` : `tilt`, `tiltX`, `tiltY` (angle de vue en degrés), `distance` ;
- `ctx.device` : orientation du téléphone (`beta`, `gamma`) ;
- `ctx.THREE`, `ctx.poster`, `ctx.toLocal(x, y, z)` ;
- `ctx.tween({...})`, `ctx.sound.play('assets/pop.mp3')` ;
- `ctx.target` (affiche visée), `ctx.collection` (`has(id)`, `count`, `total`, `complete`) ;
- `ctx.state` : mémoire libre ; `ctx.log('message')` : affiche un message.

Si ton behavior plante, l'erreur s'affiche dans le panneau ; après 3 erreurs dans `onUpdate`, il est désactivé, et le reste de l'expérience continue.

---

## Quand ça ne marche pas

| Symptôme | Solution |
|---|---|
| Panneau rouge dans l'aperçu | Lis le message : il dit quelle brique et quel champ corriger. |
| « n'est pas un JSON valide (ligne X) » | Virgule en trop après le dernier élément, ou guillemets courbes `“ ”` au lieu de `"`. |
| « impossible de charger assets/… » | Nom de fichier différent (majuscules, accents, espaces) ou fichier absent. |
| L'affiche n'est pas détectée | Vise toute l'affiche, en pleine lumière, sans reflet. Le papier mat marche mieux que le brillant. |
| Le contenu est décalé sur l'affiche | La cible ne correspond pas à l'affiche imprimée (version différente) : redemande une cible. |
| Pas de son | Touche le bouton haut-parleur ; vérifie que le téléphone n'est pas en silencieux (iPhone). |
| La page reste noire / « Navigateur non compatible » | Ouvre le lien dans Safari (iPhone) ou Chrome (Android), pas dans Instagram/Messenger. |

## Limites connues

- **Téléphones** : Safari ou Chrome récents sur iPhone (iOS 15+), Chrome ou Samsung Internet sur Android. Les navigateurs intégrés aux applis (Instagram, TikTok, Messenger) ne sont pas supportés.
- **iPhone** :
  - pas de vidéo transparente en WebM, d'où le fond vert + `chroma` ;
  - le son ne démarre qu'après un tap sur le bouton son ;
  - en mode économie d'énergie, une vidéo peut attendre un tap pour démarrer ;
  - l'accès à l'orientation du téléphone (`ctx.device`) demande une autorisation au démarrage.
- **Zone suivie** : le moteur suit une zone au format 3:4 au centre de l'affiche. Sur un A3/A4, environ 6 % en haut et en bas ne servent pas à la détection, mais tu peux quand même y placer du contenu.
- **Ce qui se suit mal** : les motifs très répétitifs, les grands aplats unis, les affiches à faible contraste. Les couleurs ne comptent pas, seul le contraste noir/blanc compte.
- **Connexion internet** nécessaire : le moteur AR (≈ 6,5 Mo) se charge au démarrage.
- **Performances** : 3 briques, 15 Mo, vidéo 720p, images 2048 px maximum. `npm run check` vérifie tout ça.

## Crédits et licences

- Moteur AR : **8th Wall Engine** © 2026 Niantic Spatial, Inc., distribué sous [XR Engine License Agreement](https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1.0.0/dist/LICENSE) (licence binaire, **pas** open source ; fourni « en l'état », sans garantie). La mention s'affiche en bas de l'écran en mode AR : ne la retire pas.
- Outil de cibles : [@8thwall/image-target-cli](https://github.com/8thwall/8thwall) (MIT). Gestion du plein écran adaptée de XRExtras (MIT).
- [three.js](https://threejs.org) (MIT), [zod](https://zod.dev) (MIT), [qrcode](https://github.com/soldair/node-qrcode) (MIT).
- Affiche, typons, vidéo, modèle et son de démo : générés pour ce template, libres de droits.

---

## Pour l'enseignant

```bash
npm install
```

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur HTTPS sur le réseau local + QR code dans le terminal (tester sur téléphone, même Wi-Fi ; accepter le certificat auto-signé) |
| `npm run dev:http` | même chose sans HTTPS (aperçu sur ordinateur uniquement) |
| `npm run targets` | génère les cibles : `posters/prenom-nom.png` → `targets-out/prenom-nom/` ; `-- posters/groupe --group` pour un projet à plusieurs affiches (voir [posters/README.md](posters/README.md)) |
| `npm run check` | vérifie `experience/` (schéma, fichiers, poids, vidéos, behaviors, core) ; `-- examples/02-video` pour un exemple |
| `npm run build` | build de production dans `dist/` (c'est ce que fait la GitHub Action) |
| `npm run core:seal` | enregistre l'empreinte de `core/` (à relancer après toute modification volontaire du core) |
| `npm run schema` | régénère `core/schema/experience.schema.json` après une modification du schéma |
| `npm run demo-assets` | régénère l'affiche et les fichiers de démo (nécessite ffmpeg pour la vidéo) |

Paramètres d'URL utiles :

- `?preview=1` : aperçu sans caméra ;
- `?ar=1` : forcer l'AR (ex. webcam d'ordinateur) ;
- `?exemple=03-modele` : charger un exemple ;
- `?debug=anchor` : tracer le contour de l'affiche (blanc) et de la zone suivie (magenta), pour vérifier le calage.

Le moteur 8th Wall (`@8thwall/engine-binary@1.0.0`, chunk `slam` qui contient les image targets) est chargé depuis jsDelivr, uniquement en mode AR.

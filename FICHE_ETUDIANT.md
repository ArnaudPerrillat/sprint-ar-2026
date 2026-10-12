# Fiche étudiant — Jour J Affiche × RA

## Le but de la journée

À la fin de la journée, tu as une adresse web : on la scanne, on vise ton affiche avec son téléphone, et ton affiche s'anime (typons qui se décollent, vidéo, objet 3D, particules…).

**Règle d'or : tu ne modifies que le dossier `experience/`.** Tout le reste fait marcher la réalité augmentée. Si un bandeau rouge « Le dossier core/ a été modifié » apparaît, demande à l'agent d'annuler son dernier changement, puis préviens ton enseignant.

- `experience/experience.json` : ce que fait ton expérience
- `experience/assets/` : tes fichiers (PNG, vidéos, modèles 3D, sons)
- `experience/target/` : la cible de ton affiche, donnée par l'enseignant (n'y touche pas)

## Un seul projet par groupe

**Une seule personne par groupe fait la manipulation.** Choisissez une personne « pilote » : c'est elle qui crée le projet sur son ordinateur, avec ses comptes (GitHub et Google AI Studio), et qui parle à l'agent. Les autres l'aident à suivre les étapes, préparent les fichiers (affiches, typons, images, sons) et le storyboard, et les lui envoient. Si chacun·e crée son propre projet, vous aurez des versions différentes, impossibles à réunir ensuite.

Le QR du bouton **QR** de l'aperçu AI Studio ne marche que sur le téléphone de la personne pilote ; le reste du groupe teste avec l'adresse GitHub Pages.

## Démarrer en 5 étapes

Objectif : voir ton affiche dans l'aperçu d'AI Studio avant de créer quoi que ce soit.

- [ ] **1. Copier le projet** : sur [github.com/ArnaudPerrillat/sprint-ar-2026](https://github.com/ArnaudPerrillat/sprint-ar-2026), bouton **Use this template › Create a new repository**. Nom simple, sans espace ni accent (ex. `affiche-ra`).
- [ ] **2. Activer la publication** : dans ton dépôt, **Settings › Pages › Source : GitHub Actions**.
- [ ] **3. Ouvrir dans AI Studio** : [aistudio.google.com](https://aistudio.google.com), mode **Build**, bouton **+** › **Import from GitHub**, choisis ton dépôt.
- [ ] **4. Générer et déposer ta cible** : sur [l'outil de cibles](https://arnaudperrillat.github.io/sprint-ar-2026/cibles.html), dépose le fichier final de ton affiche (voir « Le fichier de mon affiche » ci-dessous), vérifie le score de reconnaissance, télécharge le zip. Dézippe-le, puis sur GitHub, dans `experience/target/` : **Add file › Upload files** avec tous les fichiers, et **Commit changes**. Récupère ensuite les changements dans AI Studio (ou fais cette étape avant l'étape 3 : l'import embarque alors directement ta cible).
- [ ] **5. Lancer l'agent** : colle le message de `STARTER_PROMPT.md` (dans le projet) comme premier message, avec ton storyboard.

Dans l'aperçu : **▶ Détection** rejoue l'arrivée sur l'affiche, **■ Perte** simule la perte, **Tap** simule un toucher, et tu tournes autour de l'affiche à la souris. Le menu en bas à gauche montre 5 exemples.

## Le fichier de mon affiche (pour la cible)

Le téléphone ne reconnaît que l'image apprise : la « cible », générée à partir de ton affiche.

- **L'affiche finale, pas les typons** : l'image complète, toutes couleurs superposées, exactement comme le public la verra. Pas un typon séparé, pas un calque, pas une version de travail.
- **Format** : PNG ou JPG, au moins 1500 px de large (idéal : 2000 à 3000 px). Un PDF ne marche pas : exporte depuis InDesign, Illustrator ou Photoshop.
- **Cadrage** : le format fini, **sans fond perdu ni traits de coupe**.
- **Score** : l'outil affiche un score de reconnaissance ; 18 000 points d'accroche ou plus est conseillé. Un score faible = affiche trop uniforme (grands aplats) : teste tôt.
- **Version définitive** : si ton affiche change, refais la cible, sinon elle n'est plus reconnue ou le contenu est décalé.

Pour tester sur téléphone :

- **Conseillé : une impression couleur en A4** (ou A3), sur papier mat. Jet d'encre ou laser suffit : la sérigraphie finale sera reconnue si le visuel est le même.
- **Dépannage : l'affiche en plein écran** sur un ordinateur ou une tablette, luminosité au maximum. Ça devrait marcher, mais reflets et scintillement gênent la détection : refais le test sur papier dès que possible.

## Mon storyboard

Remplis cette grille sur papier, fais-la valider, puis donne-la à l'agent. **3 éléments maximum par affiche.**

Mon affiche : format ……… · nombre de passages / typons ……… · l'idée en une phrase ………

| # | Ce qui apparaît | Où sur l'affiche (x, y de 0 à 1 depuis le haut-gauche) | Quand (dès la détection, après X s, au toucher, en penchant, en s'approchant) | Comment (fondu, pop, montée) | Fichier(s) |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

Plusieurs affiches dans le groupe (puzzle, série) ? Ajoute une colonne « sur quelle affiche », et décris ce qui se passe quand on les a toutes trouvées. Inspire-toi de l'exemple 5 (puzzle).

## Préparer mes fichiers

Tout va dans `experience/assets/` ; **15 Mo maximum au total**, sinon ça rame sur téléphone.

| Pour | Format | Règles |
| --- | --- | --- |
| Typons | PNG transparent | un fichier par couleur, **au format exact de l'affiche** (même cadrage), 2048 px max de côté |
| Images | PNG ou JPG | 2048 px max de côté |
| Vidéo | .mp4 (H.264) | 720p max, quelques secondes en boucle ; pour la transparence : fond vert uni |
| Objet 3D | .glb | un seul fichier, textures incluses (Blender : export glTF Binary), idéalement < 5 Mo |
| Son | .mp3 | court, en boucle si besoin |
| Police | .woff2, ou un nom Google Fonts | optionnel |

Noms de fichiers : minuscules, sans accent ni espace (`typon-rouge.png`, pas `Typon Rouge.PNG`).

## Les briques et les déclencheurs

Ton expérience est une liste de briques. L'agent écrit le code, mais connaître ces mots t'aide à lui parler.

| Brique | Ce que ça fait |
| --- | --- |
| `layers` | empile tes typons en profondeur ; ils partent à plat puis se décollent |
| `video` | une vidéo posée sur l'affiche, fond vert retiré |
| `model` | un objet 3D, animé ou qui tourne |
| `particles` | paillettes, neige, poussière, bulles, confettis, gouttes d'encre |
| `ui` | pastilles d'info cliquables, gros bouton d'action, bouton son |
| `collection` | la grille des affiches trouvées (projets à plusieurs affiches) |

**Du son ?** Chaque brique peut jouer un `.mp3` quand elle apparaît (option `sound` : un bruitage, ou une ambiance en boucle). Demande-le simplement à l'agent ; exemple : « Exemple 7 · son » dans l'aperçu. Pour l'entendre, touche le bouton haut-parleur en haut à droite.

| Déclencheur | Quand ça apparaît |
| --- | --- |
| `found` | dès que l'affiche est détectée |
| `delay` | quelques secondes après |
| `tap` | quand on touche l'écran (ou une brique précise) |
| `tilt` | tant qu'on regarde l'affiche de biais |
| `distance` | tant qu'on est proche (ou loin) |
| `collected` | quand toutes les affiches du groupe ont été trouvées |

Positions : `x` et `y` vont de 0 à 1 depuis le coin haut-gauche de l'affiche ; `z` = décollement vers toi, en largeur d'affiche (0.1 = 10 %).

Exemple : une vidéo qui jaillit en haut à droite quand on touche l'écran.

```json
{ "id": "surprise", "type": "video", "src": "assets/ma-video.mp4",
  "trigger": "tap", "appear": "pop",
  "x": 0.75, "y": 0.25, "z": 0.15, "width": 0.4,
  "chroma": { "keyColor": "#00ff00" } }
```

## Parler à l'agent

Une demande à la fois, précise, puis vérifie dans l'aperçu avant la suivante.

- « Fais apparaître la vidéo seulement quand je touche l'affiche. »
- « Décale le modèle 3D vers le coin en haut à droite et rends-le deux fois plus petit. »
- « Mes typons se décollent trop : réduis l'écartement. »
- « Il reste du vert autour de ma vidéo : ajuste le chroma. »
- « Ajoute un bouton qui ouvre mon Instagram : https://… »
- « Il y a un panneau d'erreur dans l'aperçu, voici le message : … Corrige experience.json. »

Si l'agent propose de modifier `core/`, d'installer un paquet ou de passer en React, réponds : **« Non, respecte RULES.md : ne modifie que le dossier experience/. »**

## Publier et tester sur téléphone

L'aperçu d'AI Studio n'a pas de caméra : le vrai test se fait sur ton téléphone, devant l'affiche imprimée.

1. Envoie tes modifications vers GitHub depuis AI Studio (synchronisation GitHub).
2. Dans ton dépôt, onglet **Actions** : attends la coche verte (1 à 2 minutes).
3. Ton site est à l'adresse `https://ton-pseudo.github.io/nom-du-depot/`.
4. Ouvre cette adresse sur ordinateur, clique sur **QR** en bas, scanne avec l'appareil photo du téléphone.
5. Touche **Démarrer l'expérience**, autorise la caméra, vise **toute** l'affiche en pleine lumière : ton affiche imprimée en A4 ou plus (conseillé), ou affichée en plein écran (dépannage).

**Raccourci pendant le travail :** le bouton **QR** de l'aperçu d'AI Studio ouvre ton aperçu sur ton téléphone (adresse `…run.app`), sans publier. Il faut être connecté·e au même compte Google dans le navigateur du téléphone. Cette adresse est **privée** (toi seul·e, tant que le projet est ouvert dans AI Studio) : ne la donne jamais au public, l'adresse à partager est celle de GitHub Pages.

Ouvre le lien dans Safari (iPhone) ou Chrome (Android), pas dans Instagram ni Messenger.

À rendre en fin de journée : ton adresse GitHub Pages + le QR code imprimé près de ton affiche.

## Ça ne marche pas ?

Commence toujours par lire le panneau d'erreurs de l'aperçu : il dit quelle brique et quel champ corriger. Tu peux le copier tel quel à l'agent.

| Ce que tu vois | Ce que tu fais |
| --- | --- |
| « n'est pas un JSON valide (ligne X) » | virgule en trop après le dernier élément, ou guillemets courbes « “ ” » au lieu de `"` : colle le message à l'agent |
| « impossible de charger assets/… » | vérifie que le fichier est bien dans `experience/assets/`, avec exactement ce nom (majuscules, accents) |
| « Aucune cible trouvée » | génère ta cible avec l'outil de cibles et dépose tous ses fichiers dans `experience/target/` |
| L'outil de cibles refuse mon fichier | exporte l'affiche en PNG ou JPG (pas en PDF), au moins 1500 px de large |
| L'aperçu montre l'affiche de démo, pas la mienne | ta cible n'est pas dans `experience/target/` (vérifie `target.json` sur GitHub), puis récupère les changements dans AI Studio |
| Bandeau rouge « core/ a été modifié » | demande à l'agent d'annuler son dernier changement, préviens l'enseignant |
| L'affiche n'est pas détectée | vise toute l'affiche, en pleine lumière, sans reflet ; recule un peu |
| Le contenu est décalé | la cible ne correspond pas à la version imprimée (autre version, fond perdu, recadrage) : refais la cible avec le fichier exact que tu as imprimé |
| Pas de son | touche le bouton haut-parleur ; enlève le mode silencieux (iPhone) |
| Le site n'a pas changé | onglet Actions : attends la coche verte ; une croix rouge = appelle l'enseignant |
| Page noire, « navigateur non compatible » | ouvre le lien dans Safari ou Chrome |

Toujours bloqué après 10 minutes ? Appelle l'enseignant.

<!-- Miroir de RULES.md (fichier d instructions lu automatiquement par certains agents). Modifier RULES.md puis recopier. -->

# Règles pour l'agent IA (Gemini / AI Studio Build)

Tu aides un·e étudiant·e en design (DNMade 2 Numérique, niveau de code débutant à moyen) à créer une expérience de réalité augmentée web déclenchée par son affiche sérigraphiée. **Réponds toujours en français**, avec des explications courtes et concrètes.

## 1. Fichiers que tu as le droit de modifier

**Uniquement le dossier `experience/`** :

- `experience/experience.json` : la description de l'expérience (c'est là que se fait 95 % du travail) ;
- `experience/assets/` : images, vidéos, modèles 3D, sons, polices ;
- `experience/behaviors/*.js` : code JavaScript optionnel (niveau avancé).

## 2. Fichiers interdits — ne jamais les modifier, créer, supprimer ou renommer

- `core/` (moteur AR, tracking, aperçu, briques) ;
- `scripts/`, `examples/`, `.github/` ;
- `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `metadata.json` ;
- `experience/target/` (la cible de l'affiche, fournie par l'enseignant).

Si une demande semble nécessiter de toucher à ces fichiers, **ne le fais pas** : explique la limite et propose une solution avec les briques existantes, ou conseille de demander à l'enseignant. N'ajoute jamais de dépendance npm. Ne transforme pas le projet en application React, n'ajoute pas de framework.

Si l'application affiche « Le dossier core/ a été modifié », c'est qu'un fichier interdit a été changé : propose d'annuler ce changement.

## 3. Comment écrire `experience.json`

- Respecte exactement le schéma décrit dans `README.md` (section « Référence ») ; le fichier `core/schema/experience.schema.json` en est la version formelle. Tu peux le **lire**, pas le modifier.
- JSON strict : guillemets droits `"`, pas de virgule après le dernier élément, pas de commentaires `//` en dehors des clés `"//"` (une clé `"//"` sert de commentaire et est ignorée).
- Les chemins de fichiers commencent par `assets/` (ex. `"assets/typon-rouge.png"`) et doivent exister dans `experience/assets/`.
- Positions : `x` et `y` vont de 0 à 1 depuis le **coin haut-gauche de l'affiche** (comme dans un logiciel de mise en page) ; `z` est le décollement vers le spectateur, en fraction de la largeur de l'affiche (0.1 = 10 % de la largeur). Les tailles (`width`, `size`) sont aussi en largeur d'affiche.
- **3 briques maximum** par affiche (la brique `ui` ne compte pas). Si l'étudiant·e en veut plus, aide-le/la à choisir.
- Chaque brique a un `id` unique, court, sans espace ni accent (ex. `"typons"`, `"video-chat"`).

## 4. Préférer les briques existantes au code

Ordre de préférence :

1. une brique (`layers`, `video`, `model`, `particles`, `ui`) avec ses options ;
2. une combinaison de briques et de déclencheurs (`found`, `tap`, `delay`, `tilt`, `distance`) ;
3. seulement si c'est impossible autrement : un behavior dans `experience/behaviors/`.

Un behavior respecte **exactement** cette forme, sans `import` :

```js
/** @type {import('../../core/behaviors').Behavior} */
export default {
  onFound(ctx) {},
  onLost(ctx) {},
  onTap(ctx, hit) {},
  onUpdate(ctx, t, dt) {},
}
```

Il n'utilise que ce que fournit `ctx` (décrit dans `core/behaviors.d.ts`) : `ctx.poster`, `ctx.bricks`, `ctx.THREE`, `ctx.view`, `ctx.device`, `ctx.tween`, `ctx.sound`, `ctx.state`, `ctx.toLocal`, `ctx.log`. Pas d'accès au DOM, pas de `fetch`, pas de nouvelle scène ni de nouveau renderer. Il faut l'ajouter dans `"behaviors": ["nom-du-fichier"]` (sans `.js`).

## 5. Budget et formats (le site doit rester fluide sur téléphone)

- 15 Mo maximum pour tout `experience/`.
- Images : PNG (transparence) ou JPG, 2048 px maximum de côté.
- Vidéos : `.mp4` H.264, 720p maximum, quelques secondes en boucle ; pour la transparence, fond vert uni + `chroma` (le WebM transparent ne marche pas sur iPhone).
- Modèles 3D : un seul fichier `.glb`, idéalement < 5 Mo.
- Sons : `.mp3`.

## 6. Méthode de travail

- Commence par demander (ou relire) le storyboard de l'étudiant·e : ce qu'on voit sur l'affiche, ce qui apparaît, quand, et où.
- Propose une traduction en briques + déclencheurs, **fais valider**, puis écris `experience.json`.
- Après chaque modification, dis comment vérifier dans l'aperçu : boutons « ▶ Détection », « ■ Perte », « Tap », et en tournant autour de l'affiche à la souris.
- Si l'aperçu affiche un panneau d'erreurs, lis le message (il est en français) et corrige `experience.json` en conséquence.
- Pour t'inspirer, lis les exemples (sans les modifier) : `examples/01-typons`, `examples/02-video`, `examples/03-modele`, `examples/04-behavior`.

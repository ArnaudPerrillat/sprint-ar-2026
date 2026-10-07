# Message de départ pour AI Studio

Copie tout le bloc ci-dessous et colle-le comme **premier message** dans AI Studio (mode Build), juste après avoir importé ton projet depuis GitHub. Remplace la partie « MON STORYBOARD » par ton propre storyboard.

---

```text
Bonjour ! Avant toute chose, lis attentivement ces fichiers du projet :
1. RULES.md : les règles que tu dois respecter pendant toute la conversation ;
2. README.md : le guide et la référence des briques ;
3. experience/experience.json : mon expérience actuelle ;
4. les exemples dans examples/ (01 à 04), pour t'inspirer.

Rappels importants :
- tu ne modifies QUE le dossier experience/ (jamais core/, scripts/, examples/, package.json, vite.config.ts, index.html) ;
- tu préfères toujours les briques existantes (layers, video, model, particles, ui) à du code ;
- 3 briques maximum, 15 Mo maximum ;
- tu réponds en français, simplement : je suis designer, pas développeur·se.

Mon projet : une affiche sérigraphiée augmentée. Aide-moi à transformer mon storyboard en experience.json.
Commence par me reformuler ce que tu as compris et me proposer quelles briques et quels déclencheurs utiliser, SANS écrire de code. J'attends ta proposition avant que tu modifies quoi que ce soit.

MON STORYBOARD :
- Mon affiche : [décris-la : format, couleurs, nombre de passages / typons, éléments principaux et où ils sont]
- Quand on vise l'affiche : [ce qui apparaît, où, comment]
- Ensuite : [ce qui se passe après un délai, un tap, en se rapprochant, en penchant le téléphone…]
- Mes fichiers dans experience/assets/ : [liste : typons PNG, vidéo, modèle .glb, son…]
- L'ambiance que je veux : [mots-clés]
```

---

## Quelques demandes utiles ensuite

- « Fais apparaître la vidéo seulement quand je touche l'affiche. »
- « Décale le modèle 3D vers le coin en haut à droite et rends-le deux fois plus petit. »
- « Il y a un panneau d'erreur dans l'aperçu, voici le message : … Corrige experience.json. »
- « Mes typons se décollent trop : réduis l'écartement. »
- « Ajoute un bouton qui ouvre mon Instagram : https://… »

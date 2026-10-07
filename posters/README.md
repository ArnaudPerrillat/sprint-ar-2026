# posters/ — affiches à transformer en cibles (enseignant)

1. Dépose ici le fichier final de chaque affiche, **tel qu'imprimé** (PNG ou JPG, 1500 px de large ou plus), nommé `prenom-nom.png`.
2. Lance `npm run targets`.
3. Chaque affiche donne un dossier `targets-out/prenom-nom/` : son contenu est à copier dans `experience/target/` du projet de l'étudiant·e (en remplaçant les fichiers de démo).

Options :
- une seule affiche : `npm run targets -- posters/prenom-nom.png` ;
- directement dans ce projet : `npm run targets -- posters/prenom-nom.png --into experience/target` ;
- recadrage personnalisé (zone 3:4 suivie, en pixels) : `--crop haut,gauche,largeur`.

Le script indique quelle part de l'affiche est réellement suivie (le moteur suit une zone 3:4 ; le reste peut quand même porter du contenu).
Les fichiers de ce dossier ne sont pas versionnés (voir `.gitignore`).

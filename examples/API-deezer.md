# Autorisation API externe : Deezer + playlist partagée

<!--
  MODÈLE POUR L'ENSEIGNANT. Pour autoriser un groupe, copier ce fichier dans SON dépôt sous
  experience/API.md et remplir les champs ci-dessous. Sans ce fichier, l'agent refuse tout appel
  réseau (voir RULES.md § 4 bis). L'agent ne doit jamais créer ni modifier ce fichier.
  Supprimer la section « Playlist partagée » si le groupe n'y a pas droit.
-->

Autorisé par : <!-- nom de l'enseignant·e --> le <!-- date -->
Projet / groupe : <!-- noms -->

## Deezer

- API : Deezer, **lecture seule**, sans compte ni clé, uniquement avec `ctx.deezer()` (RULES.md § 4 bis).
- Appels autorisés : `/search`, `/track/{id}`, `/album/{id}`, `/artist/{id}`, `/playlist/{id}`, `/playlist/{id}/tracks`.
- Médias : extraits de 30 s (`preview`) et pochettes, depuis les CDN `dzcdn.net`.

## Playlist partagée (ctx.shared)

- Identifiant de partage, à recopier dans `experience.json` : `"shared": "<!-- ex. playlist-groupe-3 : 3 à 40 caractères, minuscules, chiffres ou - ; un par groupe -->"`
- Liste(s) autorisée(s) : `playlist`
- Contenu : uniquement des `deezerId` (identifiants de morceaux Deezer).
- Les visiteurs peuvent **ajouter**, jamais modifier ni supprimer. La modération (supprimer un morceau) se fait par l'enseignant dans la console Firebase : projet `sprint-ar-2026` → Firestore → `projets/<identifiant>/playlist`.

## Ce qui reste interdit

Connexion d'un utilisateur (OAuth), écriture dans Deezer, clé ou jeton dans le code, serveur ou proxy, tout autre service en ligne.

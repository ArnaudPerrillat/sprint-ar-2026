# Autorisation API externe : Deezer

<!--
  MODÈLE POUR L'ENSEIGNANT. Pour autoriser un groupe, copier ce fichier dans SON dépôt sous
  experience/API.md et remplir les champs ci-dessous. Sans ce fichier, l'agent refuse tout appel
  réseau (voir RULES.md § 4 bis). L'agent ne doit jamais créer ni modifier ce fichier.
-->

Autorisé par : <!-- nom de l'enseignant·e --> le <!-- date -->
Projet / groupe : <!-- noms -->

## Ce qui est autorisé

- API : Deezer, **lecture seule**, sans compte ni clé, uniquement avec `ctx.deezer()` (RULES.md § 4 bis).
- Appels autorisés : `/search`, `/track/{id}`, `/album/{id}`, `/artist/{id}`, `/playlist/{id}`, `/playlist/{id}/tracks`.
- Médias : extraits de 30 s (`preview`) et pochettes, depuis les CDN `dzcdn.net`.

## Playlist du projet

- Identifiant de la playlist : <!-- ex. 1234567 (le nombre dans https://www.deezer.com/playlist/1234567) -->
- Lien à ouvrir pour ajouter un morceau : <!-- https://www.deezer.com/playlist/1234567 -->
- La playlist doit être **publique** (sinon l'API ne la lit pas) et **collaborative** dans l'appli Deezer.

## Ce qui reste interdit

Connexion d'un utilisateur (OAuth), écriture via l'API, clé ou jeton dans le code, serveur ou proxy, tout autre service en ligne.

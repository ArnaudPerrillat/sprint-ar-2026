// Behavior « lecteur » : un petit lecteur audio en bas de l'écran, avec ctx.ui.
// Pour l'utiliser dans ton projet : copie ce fichier dans experience/behaviors/ et ajoute
// "behaviors": ["lecteur"] dans experience.json.
//
// Les morceaux peuvent venir de experience/assets/ (avec ctx.asset) ou d'une URL complète
// (ex. un extrait Deezer). Le graphisme est à toi : modifie le HTML et le CSS ci-dessous.

const MORCEAUX = [
  { titre: 'Boucle', artiste: 'Démo', src: 'assets/demo/boucle.mp3' },
  { titre: 'Pop', artiste: 'Démo', src: 'assets/demo/pop.mp3' },
]

/** @type {import('../../../core/behaviors').Behavior} */
export default {
  onFound(ctx) {
    // Déjà construit (affiche retrouvée) : rien à refaire.
    if (ctx.state.audio) return

    // keep: true → le lecteur reste à l'écran quand on perd l'affiche, la musique continue.
    const panneau = ctx.ui.panel('lecteur', { keep: true })
    panneau.innerHTML = `
      <div class="infos">
        <strong class="titre"></strong>
        <span class="artiste"></span>
      </div>
      <button class="precedent" aria-label="Précédent">⏮</button>
      <button class="lecture" aria-label="Lecture">▶</button>
      <button class="suivant" aria-label="Suivant">⏭</button>
      <div class="barre"><div class="progression"></div></div>
    `

    // Le CSS ne s'applique qu'à tes panneaux. Variables du thème : --ra-color, --ra-text, --ra-font.
    ctx.ui.style(`
      .lecteur { display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; align-items: center; }
      .lecteur .infos { display: flex; flex-direction: column; min-width: 0; }
      .lecteur .titre, .lecteur .artiste { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .lecteur .artiste { opacity: 0.7; font-size: 14px; }
      .lecteur button { width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; font-size: 18px; }
      .lecteur .lecture { background: var(--ra-color); }
      .lecteur .barre { grid-column: 1 / -1; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.2); }
      .lecteur .progression { height: 100%; width: 0; border-radius: 2px; background: var(--ra-color); }
    `)

    // Un seul lecteur audio pour tous les morceaux : on change sa source (sinon l'iPhone
    // refuse d'enchaîner les morceaux).
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    ctx.state.audio = audio
    ctx.state.index = 0

    const charger = (index) => {
      ctx.state.index = (index + MORCEAUX.length) % MORCEAUX.length
      const morceau = MORCEAUX[ctx.state.index]
      // Chemin local → ctx.asset ; URL complète (https://...) → telle quelle.
      audio.src = morceau.src.startsWith('http') ? morceau.src : ctx.asset(morceau.src)
      panneau.querySelector('.titre').textContent = morceau.titre
      panneau.querySelector('.artiste').textContent = morceau.artiste
    }
    const jouer = () => audio.play().catch((err) => ctx.log(`Lecture impossible : ${err.message}`))

    panneau.querySelector('.lecture').addEventListener('click', () => (audio.paused ? jouer() : audio.pause()))
    panneau.querySelector('.suivant').addEventListener('click', () => { charger(ctx.state.index + 1); jouer() })
    panneau.querySelector('.precedent').addEventListener('click', () => { charger(ctx.state.index - 1); jouer() })
    // Fin d'un morceau → le suivant.
    audio.addEventListener('ended', () => { charger(ctx.state.index + 1); jouer() })
    audio.addEventListener('play', () => (panneau.querySelector('.lecture').textContent = '⏸'))
    audio.addEventListener('pause', () => (panneau.querySelector('.lecture').textContent = '▶'))
    // Barre de progression (timeupdate continue aussi quand l'affiche est perdue).
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return
      panneau.querySelector('.progression').style.width = `${(audio.currentTime / audio.duration) * 100}%`
    })

    charger(0)
  },
}

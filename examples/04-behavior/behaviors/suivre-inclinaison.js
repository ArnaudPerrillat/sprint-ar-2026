// Behavior « suivre-inclinaison » : le typon noir glisse dans le sens opposé à ton regard,
// comme s'il flottait au-dessus de l'affiche, et tourne doucement avec le téléphone.
// Pour l'utiliser dans ton projet : copie ce fichier dans experience/behaviors/ et ajoute
// "behaviors": ["suivre-inclinaison"] dans experience.json.

/** @type {import('../../../core/behaviors').Behavior} */
export default {
  onFound(ctx) {
    ctx.state.decalage = 0
  },

  onUpdate(ctx, t, dt) {
    const typons = ctx.bricks.get('typons')
    if (!typons) return
    // Les couches sont dans l'ordre de experience.json : la 4e est le typon noir.
    const noir = typons.object3d.children[3]
    if (!noir) return

    // ctx.view.tiltX / tiltY : angle de vue en degrés (0 = face à l'affiche).
    const cibleX = -ctx.view.tiltX * 0.002
    const cibleY = -ctx.view.tiltY * 0.002
    // Lissage : on se rapproche de la cible petit à petit.
    const k = Math.min(1, dt * 6)
    noir.position.x += (cibleX - noir.position.x) * k
    noir.position.y += (cibleY - noir.position.y) * k

    // ctx.device.gamma : inclinaison gauche/droite du téléphone (0 si indisponible, ex. aperçu).
    noir.rotation.z = ctx.THREE.MathUtils.degToRad(ctx.device.gamma * 0.15)
  },
}

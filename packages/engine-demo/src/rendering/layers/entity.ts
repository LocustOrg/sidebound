import type { RenderLayer } from '../pipeline'
import type { Rect } from '../../core/geometry'
import type { Mob } from '../../entities/mob'

/**
 * Draws all mob entities with shadow and aura effects.
 * In the future this should accept an entity list; for now it takes a single mob reference.
 */
export class EntityLayer implements RenderLayer {
    readonly order = 20
    private mobs: Mob[] = []

    addMob(mob: Mob): void {
        this.mobs.push(mob)
    }

    removeMob(mob: Mob): void {
        const index = this.mobs.indexOf(mob)
        if (index !== -1) this.mobs.splice(index, 1)
    }

    render(context: CanvasRenderingContext2D, _camera: Rect): void {
        for (const mob of this.mobs) {
            this.drawMob(context, mob)
        }
    }

    private drawMob(context: CanvasRenderingContext2D, mob: Mob): void {
        const centerX = mob.x + mob.width / 2
        const footY = mob.y + mob.height

        // Ground shadow
        context.save()
        context.fillStyle = 'rgba(8, 6, 14, 0.28)'
        context.beginPath()
        context.ellipse(centerX, footY + 1, mob.width * 1.9, 2.3, 0, 0, Math.PI * 2)
        context.fill()
        context.restore()

        // Sprite
        mob.draw(context)

        // Subtle aura
        context.save()
        context.globalCompositeOperation = 'screen'
        const aura = context.createRadialGradient(centerX, mob.y + mob.height * 0.35, 0, centerX, mob.y + mob.height * 0.35, 12)
        aura.addColorStop(0, 'rgba(168, 226, 255, 0.08)')
        aura.addColorStop(1, 'rgba(168, 226, 255, 0)')
        context.fillStyle = aura
        context.beginPath()
        context.arc(centerX, mob.y + mob.height * 0.35, 12, 0, Math.PI * 2)
        context.fill()
        context.restore()
    }
}




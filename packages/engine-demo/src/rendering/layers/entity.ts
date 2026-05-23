import type { RenderLayer } from '../pipeline'
import type { Rect } from '../../core/geometry'
import { clamp } from '../../core/geometry'
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

        this.drawGroundShadow(context, mob)

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

    private drawGroundShadow(context: CanvasRenderingContext2D, mob: Mob): void {
        const projection = mob.getShadowProjection()
        if (projection === null) return

        const heightFactor = clamp(projection.distance / 80, 0, 1)
        const radiusX = mob.width * 1.9 * (1 - heightFactor * 0.45)
        const radiusY = 2.3 * (1 - heightFactor * 0.35)
        const alpha = 0.28 * (1 - heightFactor * 0.72)

        context.save()
        context.fillStyle = `rgba(8, 6, 14, ${alpha})`
        context.beginPath()
        context.ellipse(projection.x, projection.y + 1, radiusX, radiusY, 0, 0, Math.PI * 2)
        context.fill()
        context.restore()
    }
}




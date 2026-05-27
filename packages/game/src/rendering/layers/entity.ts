import type { ColorRgba, Renderer2D, RenderFrame, RenderLayer } from '@sidebound/engine'
import { clamp } from '@sidebound/engine'
import { Mob } from '../../entities/mob.ts'
import type { PickupItemEntity } from '../../entities/item-entity.ts'

const shadowColor: ColorRgba = { r: 8, g: 6, b: 14, a: 0.28 }
const auraInner: ColorRgba = { r: 168, g: 226, b: 255, a: 0.12 }
const auraOuter: ColorRgba = { r: 168, g: 226, b: 255, a: 0 }

/**
 * Draws all mob entities with elliptical ground shadow and soft player aura.
 */
export class EntityLayer implements RenderLayer {
    readonly order = 20
    private mobs: Mob[] = []
    private itemProvider: () => readonly PickupItemEntity[] = () => []

    addMob(mob: Mob): void {
        this.mobs.push(mob)
    }

    setItemProvider(provider: () => readonly PickupItemEntity[]): void {
        this.itemProvider = provider
    }

    removeMob(mob: Mob): void {
        const index = this.mobs.indexOf(mob)
        if (index !== -1) this.mobs.splice(index, 1)
    }

    render(frame: RenderFrame): void {
        const { renderer, camera } = frame
        const ox = -camera.x
        const oy = -camera.y

        for (const item of this.itemProvider()) {
            this.drawItem(renderer, item, ox, oy)
        }

        for (const mob of this.mobs) {
            this.drawMob(renderer, mob, ox, oy)
        }
    }

    private drawItem(renderer: Renderer2D, item: PickupItemEntity, ox: number, oy: number): void {
        item.spriteSheet.drawFrame(renderer, item.frameIndex ?? 0, Math.round(item.x + ox), Math.round(item.y + oy), item.flipX ?? false)
    }

    private drawMob(renderer: Renderer2D, mob: Mob, ox: number, oy: number): void {
        this.drawEllipticalShadow(renderer, mob, ox, oy)
        mob.draw(renderer, ox, oy)
        this.drawAura(renderer, mob, ox, oy)
    }

    private drawEllipticalShadow(renderer: Renderer2D, mob: Mob, ox: number, oy: number): void {
        const projection = mob.getShadowProjection()
        if (projection === null) return

        const heightFactor = clamp(projection.distance / 80, 0, 1)
        const radiusX = Math.round(mob.width * 1.9 * (1 - heightFactor * 0.45))
        const radiusY = Math.max(3, Math.round(5 * (1 - heightFactor * 0.6)))
        const alpha = shadowColor.a * (1 - heightFactor * 0.72)
        const centerX = projection.x + ox
        const centerY = projection.y + oy + 1

        renderer.fillRadialGradientEllipse(
            { x: centerX, y: centerY },
            radiusX,
            radiusY,
            { ...shadowColor, a: alpha },
            { ...shadowColor, a: 0 },
            16,
        )
    }

    private drawAura(renderer: Renderer2D, mob: Mob, ox: number, oy: number): void {
        // Only draw aura for the first mob (player) as a subtle glow
        if (this.mobs.indexOf(mob) !== 0) return

        const cx = Math.round(mob.x + mob.width / 2 + ox)
        const cy = Math.round(mob.y + mob.height * 0.35 + oy)
        const radius = 12

        renderer.fillRadialGradientFan(
            { x: cx, y: cy },
            radius,
            auraInner,
            auraOuter,
            24,
        )
    }
}

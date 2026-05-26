import { type CharacterAppearance, CharacterRenderer, type EquipmentLoadout, type Renderer2D } from '@sidebound/engine'

export type CharacterRenderFrame = {
    readonly renderer: Renderer2D
    readonly frame: number
    readonly x: number
    readonly y: number
    readonly flipX: boolean
}

export class CharacterRenderComponent {
    private readonly renderer = new CharacterRenderer()
    private readonly appearance: CharacterAppearance
    private readonly equipment: EquipmentLoadout

    constructor(appearance: CharacterAppearance, equipment: EquipmentLoadout) {
        this.appearance = appearance
        this.equipment = equipment
    }

    draw(frame: CharacterRenderFrame): void {
        this.renderer.draw({
            renderer: frame.renderer,
            appearance: this.appearance,
            equipment: this.equipment,
            frame: frame.frame,
            x: frame.x,
            y: frame.y,
            flipX: frame.flipX,
        })
    }
}

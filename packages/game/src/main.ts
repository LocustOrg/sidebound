import { PixelEngine } from '@strange-path/engine'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#game')

if (!canvas) {
    throw new Error('Game canvas was not found')
}

const pressedKeys = new Set<string>()
const player = {
    x: 72,
    y: 40,
    size: 8,
    speed: 48,
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

window.addEventListener('keydown', (event) => {
    pressedKeys.add(event.key.toLowerCase())
})

window.addEventListener('keyup', (event) => {
    pressedKeys.delete(event.key.toLowerCase())
})

const engine = new PixelEngine({
    canvas,
    width: 160,
    height: 90,
    scale: 5,
    background: '#17121f',
    loop: {
        update(deltaSeconds) {
            const horizontal = Number(pressedKeys.has('arrowright') || pressedKeys.has('d')) - Number(pressedKeys.has('arrowleft') || pressedKeys.has('a'))
            const vertical = Number(pressedKeys.has('arrowdown') || pressedKeys.has('s')) - Number(pressedKeys.has('arrowup') || pressedKeys.has('w'))

            player.x = clamp(player.x + horizontal * player.speed * deltaSeconds, 0, 160 - player.size)
            player.y = clamp(player.y + vertical * player.speed * deltaSeconds, 0, 90 - player.size)
        },
        render(context) {
            context.fillStyle = '#242037'

            for (let x = 0; x < 160; x += 8) {
                context.fillRect(x, 0, 1, 90)
            }

            for (let y = 0; y < 90; y += 8) {
                context.fillRect(0, y, 160, 1)
            }

            context.fillStyle = '#f6d365'
            context.fillRect(Math.round(player.x), Math.round(player.y), player.size, player.size)
        },
    },
})

engine.start()

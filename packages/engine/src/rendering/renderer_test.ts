/**
 * Unit tests for SDL renderer utilities: blend mode mapping, gradient sampling,
 * and render target management behavior.
 *
 * These tests exercise the pure logic functions and FakeRenderer contract
 * without requiring SDL3 native libraries.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { FakeRenderer } from './fake-renderer.ts'
import type { ColorRgba, RenderTargetHandle } from '../platform/renderer.ts'

Deno.test('FakeRenderer - createRenderTarget returns valid handle', () => {
    const renderer = new FakeRenderer()
    const handle = renderer.createRenderTarget('test-rt', 256, 128)

    assertEquals(handle.id, 'test-rt')
    assertEquals(handle.width, 256)
    assertEquals(handle.height, 128)
})

Deno.test('FakeRenderer - clear records command', () => {
    const renderer = new FakeRenderer()
    const color: ColorRgba = { r: 255, g: 0, b: 128, a: 1 }
    renderer.clear(color)

    const commands = renderer.getCommandsByType('clear')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].color, color)
})

Deno.test('FakeRenderer - drawRenderTarget records blend mode', () => {
    const renderer = new FakeRenderer()
    const handle: RenderTargetHandle = { id: 'rt', width: 100, height: 100 }
    const dest = { x: 0, y: 0, width: 100, height: 100 }

    renderer.drawRenderTarget(handle, dest, 'multiply', 0.8)

    const commands = renderer.getCommandsByType('drawRenderTarget')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].blendMode, 'multiply')
    assertEquals(commands[0].alpha, 0.8)
    assertEquals(commands[0].targetId, 'rt')
})

Deno.test('FakeRenderer - drawRenderTarget records add blend mode', () => {
    const renderer = new FakeRenderer()
    const handle: RenderTargetHandle = { id: 'haze', width: 64, height: 64 }
    const dest = { x: 0, y: 0, width: 64, height: 64 }

    renderer.drawRenderTarget(handle, dest, 'add')

    const commands = renderer.getCommandsByType('drawRenderTarget')
    assertEquals(commands[0].blendMode, 'add')
})

Deno.test('FakeRenderer - fillLinearGradientRect records stops', () => {
    const renderer = new FakeRenderer()
    const stops = [
        { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } as ColorRgba },
        { offset: 1, color: { r: 255, g: 255, b: 255, a: 1 } as ColorRgba },
    ]

    renderer.fillLinearGradientRect({ x: 10, y: 20, width: 100, height: 200 }, stops)

    const commands = renderer.getCommandsByType('fillLinearGradientRect')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].rect.x, 10)
    assertEquals(commands[0].stops.length, 2)
    assertEquals(commands[0].direction, 'vertical')
})

Deno.test('FakeRenderer - fillLinearGradientRect records diagonal direction', () => {
    const renderer = new FakeRenderer()
    const stops = [
        { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } as ColorRgba },
        { offset: 1, color: { r: 255, g: 255, b: 255, a: 1 } as ColorRgba },
    ]

    renderer.fillLinearGradientRect({ x: 0, y: 0, width: 28, height: 28 }, stops, 'diagonal-down')

    const commands = renderer.getCommandsByType('fillLinearGradientRect')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].direction, 'diagonal-down')
})

Deno.test('FakeRenderer - fillRadialGradientFan records parameters', () => {
    const renderer = new FakeRenderer()
    const inner: ColorRgba = { r: 255, g: 200, b: 100, a: 0.8 }
    const outer: ColorRgba = { r: 255, g: 200, b: 100, a: 0 }

    renderer.fillRadialGradientFan({ x: 50, y: 50 }, 30, inner, outer, 24)

    const commands = renderer.getCommandsByType('fillRadialGradientFan')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].center, { x: 50, y: 50 })
    assertEquals(commands[0].radius, 30)
    assertEquals(commands[0].segments, 24)
})

Deno.test('FakeRenderer - fillRadialGradientEllipse records parameters', () => {
    const renderer = new FakeRenderer()
    const inner: ColorRgba = { r: 8, g: 6, b: 14, a: 0.3 }
    const outer: ColorRgba = { r: 8, g: 6, b: 14, a: 0 }

    renderer.fillRadialGradientEllipse({ x: 100, y: 80 }, 20, 4, inner, outer, 16)

    const commands = renderer.getCommandsByType('fillRadialGradientEllipse')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].radiusX, 20)
    assertEquals(commands[0].radiusY, 4)
    assertEquals(commands[0].segments, 16)
})

Deno.test('FakeRenderer - setRenderTarget records null for window target', () => {
    const renderer = new FakeRenderer()
    renderer.setRenderTarget(null)

    const commands = renderer.getCommandsByType('setRenderTarget')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].target, null)
})

Deno.test('FakeRenderer - reset clears all commands', () => {
    const renderer = new FakeRenderer()
    renderer.fillRect({ x: 0, y: 0, width: 10, height: 10 }, { r: 255, g: 0, b: 0, a: 1 })
    renderer.reset()

    assertEquals(renderer.getCommands().length, 0)
})

Deno.test('FakeRenderer - drawTexture records blend mode in options', () => {
    const renderer = new FakeRenderer()
    const texture = { id: 'tex', width: 32, height: 32 }
    const source = { x: 0, y: 0, width: 32, height: 32 }
    const dest = { x: 10, y: 10, width: 32, height: 32 }

    renderer.drawTexture(texture, source, dest, { blendMode: 'add', alpha: 0.5 })

    const commands = renderer.getCommandsByType('drawTexture')
    assertEquals(commands.length, 1)
    assertEquals(commands[0].options?.blendMode, 'add')
    assertEquals(commands[0].options?.alpha, 0.5)
})

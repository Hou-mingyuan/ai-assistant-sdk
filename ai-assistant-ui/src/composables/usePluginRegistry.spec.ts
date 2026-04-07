import { describe, it, expect, vi } from 'vitest'
import { usePluginRegistry, type AiPlugin } from './usePluginRegistry'

function makePlug(id: string, pos: AiPlugin['position'] = 'header'): AiPlugin {
  return { id, label: id, position: pos, action: vi.fn() }
}

describe('usePluginRegistry', () => {
  it('registers and retrieves plugins', () => {
    const { registerPlugin, getPlugins } = usePluginRegistry()
    registerPlugin(makePlug('a', 'header'))
    registerPlugin(makePlug('b', 'footer'))
    expect(getPlugins('header').map(p => p.id)).toContain('a')
    expect(getPlugins('footer').map(p => p.id)).toContain('b')
  })

  it('replaces plugin with same id', () => {
    const { registerPlugin, plugins } = usePluginRegistry()
    registerPlugin(makePlug('x'))
    const before = plugins.value.length
    registerPlugin({ ...makePlug('x'), label: 'updated' })
    expect(plugins.value.length).toBe(before)
    expect(plugins.value.find(p => p.id === 'x')!.label).toBe('updated')
  })

  it('unregisters plugin', () => {
    const { registerPlugin, unregisterPlugin, plugins } = usePluginRegistry()
    registerPlugin(makePlug('del'))
    unregisterPlugin('del')
    expect(plugins.value.find(p => p.id === 'del')).toBeUndefined()
  })
})

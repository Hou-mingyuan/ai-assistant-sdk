import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const forbiddenPurpleTokens = [
    '#4f46e5',
    '#4338ca',
    '#5b6cff',
    '#6366f1',
    '#7c3aed',
    '#7c5cff',
    '#818cf8',
    '#8b5cf6',
    '#9333ea',
    '#a855f7',
    '#a78bfa',
    '#c084fc',
    '#c4b5fd',
    '#ec4899',
    '#4c1d95',
    '#312e81',
    '#3730a3',
    '#a5b4fc',
    '#ddd6fe',
    '#ede9fe',
    '#1e1b4b',
    '#1a1033',
    '#c7d2fe',
    '#eef2ff',
    'rgba(79, 70, 229',
    'rgba(91, 108, 255',
    'rgba(99, 102, 241',
    'rgba(124, 58, 237',
    'rgba(124, 92, 255',
    'rgba(129, 140, 248',
    'rgba(139, 92, 246',
    'rgba(147, 51, 234',
    'rgba(167, 139, 250',
    'rgba(168, 85, 247',
    'rgba(168, 139, 250',
    'rgba(192, 132, 252',
    'rgba(196, 181, 253',
]

const forbiddenBlueBrandTokens = [
    '#0369a1',
    '#06b6d4',
    '#0ea5e9',
    '#1d4ed8',
    '#1e40af',
    '#22d3ee',
    '#2563eb',
    '#38bdf8',
    '#3b82f6',
    '#60a5fa',
    '#7dd3fc',
    '#93c5fd',
    '#bfdbfe',
    'rgba(6, 182, 212',
    'rgba(14, 165, 233',
    'rgba(34, 211, 238',
    'rgba(37, 99, 235',
    'rgba(56, 189, 248',
    'rgba(59, 130, 246',
]

const approvedThemes = [
    {
        id: 'graphite',
        label: 'Obsidian',
        colors: ['#050505', '#171717', '#2b2b2b'],
    },
    {
        id: 'sky',
        label: 'Cobalt',
        colors: ['#163b8c', '#2457d6', '#5b8def'],
    },
    {
        id: 'plum',
        label: 'Pulse',
        colors: ['#075985', '#0891b2', '#22d3ee'],
    },
    {
        id: 'forest',
        label: 'Circuit',
        colors: ['#065f46', '#0f766e', '#2dd4bf'],
    },
    {
        id: 'sunset',
        label: 'Ember',
        colors: ['#9a3412', '#c2410c', '#f97316'],
    },
]

async function collectUiSources(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
        const path = `${directory}/${entry.name}`
        if (entry.isDirectory()) files.push(...(await collectUiSources(path)))
        else if (
            /\.(?:css|ts|vue)$/.test(entry.name) &&
            !/\.spec\.ts$/.test(entry.name)
        ) {
            files.push(path)
        }
    }
    return files
}

test('active assistant surfaces contain no purple brand literals', async () => {
    const brandSources = [
        ...(await collectUiSources('ai-assistant-ui/src')),
        ...(await collectUiSources('ai-assistant-vue-playground/src')),
    ]
    for (const file of brandSources) {
        const source = (await readFile(file, 'utf8')).toLowerCase()
        for (const token of forbiddenPurpleTokens) {
            assert.ok(
                !source.includes(token),
                `${file} still contains purple brand token ${token}`,
            )
        }
    }
})

test('built-in presets expose approved technology colors and default to Obsidian', async () => {
    const switcher = await readFile(
        'ai-assistant-ui/src/components/ColorThemeSwitcher.vue',
        'utf8',
    )
    const assistant = await readFile(
        'ai-assistant-ui/src/components/AiAssistant.vue',
        'utf8',
    )
    const playground = await readFile(
        'ai-assistant-vue-playground/src/App.vue',
        'utf8',
    )

    for (const theme of approvedThemes) {
        assert.match(switcher, new RegExp(`id: '${theme.id}', label: '${theme.label}'`))
        assert.ok(playground.includes(`色调: ${theme.label}`))
        for (const color of theme.colors) {
            assert.ok(switcher.includes(color), `${theme.label} missing ${color} in switcher`)
            assert.ok(assistant.includes(color), `${theme.label} missing ${color} in assistant`)
            assert.ok(playground.includes(color), `${theme.label} missing ${color} in playground`)
        }
    }

    assert.match(assistant, /return 'graphite'/)
    assert.match(
        playground,
        /localStorage\.getItem\("playground-theme"\)\s*\?\?\s*"graphite"/,
    )
})

test('brand marks follow the selected palette with a dark-mode contrast color', async () => {
    const assistant = await readFile(
        'ai-assistant-ui/src/components/AiAssistant.vue',
        'utf8',
    )
    const tokens = await readFile(
        'ai-assistant-ui/src/components/styles/00-enterprise-tokens.css',
        'utf8',
    )
    const finalStyles = await readFile(
        'ai-assistant-ui/src/components/styles/99-enterprise-overhaul.css',
        'utf8',
    )
    const playground = await readFile(
        'ai-assistant-vue-playground/src/App.vue',
        'utf8',
    )

    assert.match(assistant, /'--ai-theme-mark': p\.mark/)
    assert.match(assistant, /'--ai-theme-mark-dark': p\.darkMark/)
    assert.match(tokens, /--ai-brand-mark: var\(--ai-theme-mark, var\(--ai-c-ink-950\)\)/)
    assert.match(
        tokens,
        /\.ai-assistant-wrapper\.ai-dark[\s\S]*?--ai-brand-mark: var\(--ai-theme-mark-dark, var\(--ai-c-ink-50\)\)/,
    )
    assert.match(finalStyles, /\.ai-fab \{[\s\S]*?color: var\(--ai-brand-mark\)/)
    assert.match(finalStyles, /\.ai-header-brand-icon[\s\S]*?color: var\(--ai-brand-mark\)/)
    assert.match(finalStyles, /\.ai-assistant-avatar \{[\s\S]*?color: var\(--ai-brand-mark/)
    assert.match(
        playground,
        /\.assistant-loader-fab \{[\s\S]*?color: var\(--demo-primary-from/,
    )
})

test('floating quick tools reserve a responsive row outside scrollable messages', async () => {
    const styles = await readFile(
        'ai-assistant-ui/src/components/styles/99-enterprise-overhaul.css',
        'utf8',
    )
    const reservation = styles.match(
        /\.ai-footer:has\(\.ai-footer-quick-toggles\)\s*\{([^}]*)\}/,
    )
    const floatingRow = styles.match(
        /\.ai-footer-quick-toggles\s*\{\s*position:\s*absolute\s*!important;([^}]*)\}/,
    )

    assert.ok(reservation, 'quick tools must reserve space in the footer layout')
    assert.match(
        reservation[1],
        /margin-top:\s*calc\(var\(--ai-quick-toggle-min-height,\s*22px\)\s*\+\s*8px\)\s*!important;/,
    )
    assert.ok(floatingRow, 'quick tools should remain visually outside the composer surface')
    assert.match(floatingRow[1], /flex-wrap:\s*nowrap\s*!important;/)
})

test('model picker clears floating quick tools and expands inward', async () => {
    const styles = await readFile(
        'ai-assistant-ui/src/components/styles/99-enterprise-overhaul.css',
        'utf8',
    )
    const popupRule = styles.match(
        /\.ai-model-menu\s*\{\s*box-sizing:\s*border-box;([\s\S]*?)\}/,
    )
    const collisionGuard = styles.match(
        /\.ai-footer:has\(\.ai-footer-quick-toggles\)\s*\.ai-model-menu\s*\{([^}]*)\}/,
    )

    assert.ok(popupRule, 'model picker must use its declared width as the rendered width')
    assert.match(popupRule[1], /left:\s*auto\s*!important;/)
    assert.match(popupRule[1], /right:\s*0\s*!important;/)
    assert.ok(collisionGuard, 'model picker must account for the floating quick-tool row')
    assert.match(
        collisionGuard[1],
        /bottom:\s*calc\(100%\s*\+\s*var\(--ai-quick-toggle-min-height,\s*22px\)\s*\+\s*18px\)\s*!important;/,
    )
})

test('base brand surfaces remain ink outside the approved theme palettes', async () => {
    const files = [
        'ai-assistant-ui/src/components/styles/00-enterprise-tokens.css',
        'ai-assistant-ui/src/components/styles/99-enterprise-overhaul.css',
        'ai-assistant-vue-playground/src/AdminDemoPanel.vue',
        'ai-assistant-vue-playground/src/main.ts',
    ]

    for (const file of files) {
        const source = (await readFile(file, 'utf8')).toLowerCase()
        for (const token of [...forbiddenPurpleTokens, ...forbiddenBlueBrandTokens]) {
            assert.ok(
                !source.includes(token),
                `${file} still contains palette-independent brand token ${token}`,
            )
        }
    }

    const main = await readFile('ai-assistant-vue-playground/src/main.ts', 'utf8')
    assert.match(main, /primaryColor: "#181818"/)
})

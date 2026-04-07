/**
 * Extracts structured data (tables, lists, headings) from the page DOM
 * and returns a markdown-formatted string for LLM context.
 */
export function extractStructuredData(
  root?: HTMLElement | null,
  maxChars = 16000,
): string {
  const el = root || document.querySelector('main') || document.querySelector('article') || document.body
  if (!el) return ''

  const parts: string[] = []

  el.querySelectorAll('table').forEach((table, i) => {
    const md = tableToMarkdown(table as HTMLTableElement)
    if (md) parts.push(`### Table ${i + 1}\n${md}`)
  })

  el.querySelectorAll('ul, ol').forEach((list, i) => {
    const md = listToMarkdown(list as HTMLElement)
    if (md && md.split('\n').length >= 3) parts.push(`### List ${i + 1}\n${md}`)
  })

  el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const level = parseInt(h.tagName[1])
    const text = (h as HTMLElement).innerText?.trim()
    if (text) parts.push(`${'#'.repeat(level)} ${text}`)
  })

  let out = parts.join('\n\n')
  if (out.length > maxChars) out = out.slice(0, maxChars) + '\n…[truncated]'
  return out
}

function tableToMarkdown(table: HTMLTableElement): string {
  const rows: string[][] = []
  table.querySelectorAll('tr').forEach(tr => {
    const cells: string[] = []
    tr.querySelectorAll('th, td').forEach(td => {
      cells.push((td as HTMLElement).innerText?.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ') || '')
    })
    if (cells.length > 0) rows.push(cells)
  })
  if (rows.length === 0) return ''

  const cols = Math.max(...rows.map(r => r.length))
  const normalized = rows.map(r => {
    while (r.length < cols) r.push('')
    return r
  })

  const header = `| ${normalized[0].join(' | ')} |`
  const sep = `| ${normalized[0].map(() => '---').join(' | ')} |`
  const body = normalized.slice(1).map(r => `| ${r.join(' | ')} |`).join('\n')

  return [header, sep, body].filter(Boolean).join('\n')
}

function listToMarkdown(list: HTMLElement): string {
  const isOrdered = list.tagName === 'OL'
  const items: string[] = []
  list.querySelectorAll(':scope > li').forEach((li, i) => {
    const text = (li as HTMLElement).innerText?.trim().replace(/\n/g, ' ')
    if (text) items.push(isOrdered ? `${i + 1}. ${text}` : `- ${text}`)
  })
  return items.join('\n')
}

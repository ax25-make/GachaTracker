/** Removes HTML comments, which wiki editors use to hide unconfirmed dates. */
export function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
}

/** Index just past the `}}` that closes the `{{` at `start`, or -1. */
function closingBraces(text: string, start: number): number {
  let depth = 0
  let i = start
  while (i < text.length) {
    if (text.startsWith('{{', i)) {
      depth++
      i += 2
    } else if (text.startsWith('}}', i)) {
      depth--
      i += 2
      if (depth === 0) return i
    } else {
      i++
    }
  }
  return -1
}

/** Splits template arguments on `|`, ignoring pipes inside nested templates and links. */
function splitArgs(inner: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < inner.length; i++) {
    const pair = inner.slice(i, i + 2)
    if (pair === '{{' || pair === '[[') {
      depth++
      current += pair
      i++
    } else if ((pair === '}}' || pair === ']]') && depth > 0) {
      depth--
      current += pair
      i++
    } else if (inner[i] === '|' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += inner[i]
    }
  }
  parts.push(current)
  return parts
}

/** Reduces the wiki markup found in field values (links, bold, italics) to plain text. */
export function cleanValue(value: string): string {
  return value
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The named arguments of every call to the template `name`, in page order.
 * Template names match regardless of case and of spaces vs underscores.
 */
export function findTemplates(text: string, name: string): Record<string, string>[] {
  const pattern = new RegExp(`\\{\\{\\s*${name.replace(/[ _]/g, '[ _]')}\\s*(?=[|}])`, 'gi')
  const results: Record<string, string>[] = []
  for (const match of text.matchAll(pattern)) {
    const end = closingBraces(text, match.index)
    if (end === -1) continue
    const [, ...args] = splitArgs(text.slice(match.index + 2, end - 2))
    const fields: Record<string, string> = {}
    for (const arg of args) {
      const eq = arg.indexOf('=')
      if (eq === -1) continue
      fields[arg.slice(0, eq).trim()] = cleanValue(arg.slice(eq + 1))
    }
    results.push(fields)
  }
  return results
}

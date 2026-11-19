// The scripted assistant lines are read from prompts/interviewer.md when the
// app is built, so the prompt is never copied into code. Edit the prompt and
// the prototype's drafts change with it.
import interviewer from '../../../../prompts/interviewer.md?raw'
import type { Bilingual } from '../projects/types'

function section(heading: string): string {
  const start = interviewer.indexOf(`## ${heading}`)
  if (start === -1) return ''
  const rest = interviewer.slice(start + heading.length + 3)
  const end = rest.search(/^## /m)
  return end === -1 ? rest : rest.slice(0, end)
}

function tableRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => !cells.every((cell) => /^-+$/.test(cell)))
    .slice(1)
}

function quoteBlocks(text: string): string[] {
  const blocks: string[][] = []
  let inQuote = false
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('>')) {
      inQuote = false
      continue
    }
    if (!inQuote) blocks.push([])
    inQuote = true
    blocks[blocks.length - 1].push(line.replace(/^>\s?/, ''))
  }
  return blocks.map((lines) =>
    lines
      .join('\n')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
      .join('\n\n'),
  )
}

const empty: Bilingual = { en: '', tr: '' }

const [openingEn, openingTr] = quoteBlocks(section('Opening message'))
export const opening: Bilingual = openingEn && openingTr ? { en: openingEn, tr: openingTr } : empty

// The row with "…" is a template that needs real content, so it is skipped.
const questions: Bilingual[] = tableRows(section('Example questions'))
  .filter(([en, tr]) => en && tr && !en.includes('…'))
  .map(([en, tr]) => ({ en, tr }))

const pausingRow = tableRows(section('Example replies for things you do not handle')).find(
  ([situation]) => situation === 'Pausing',
)

const scriptLines: Bilingual[] = [
  ...questions,
  ...(pausingRow ? [{ en: pausingRow[1], tr: pausingRow[2] }] : []),
]

if (scriptLines.length === 0 || opening === empty) {
  console.error('No scripted lines found in prompts/interviewer.md. Its headings or tables may have changed.')
}

export function scriptLine(index: number): Bilingual | undefined {
  return scriptLines[index]
}

export function seededLine(index: number): Bilingual {
  return scriptLines[index] ?? empty
}

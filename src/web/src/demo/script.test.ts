import { describe, expect, it } from 'vitest'
import { opening, scriptLine } from './script'

// script.ts reads prompts/interviewer.md by its headings. If a heading changes,
// the app only logs to the console, so these tests make that fail CI instead.
describe('scripted lines from prompts/interviewer.md', () => {
  it('has an opening message in English and Turkish', () => {
    expect(opening.en.trim()).not.toBe('')
    expect(opening.tr.trim()).not.toBe('')
  })

  it('has at least one scripted line in English and Turkish', () => {
    const first = scriptLine(0)
    expect(first).toBeDefined()
    expect(first?.en.trim()).not.toBe('')
    expect(first?.tr.trim()).not.toBe('')
  })

  it('finds the example questions as well as the pausing reply', () => {
    // The pausing reply is always last. A second line means the questions table was found.
    expect(scriptLine(1)).toBeDefined()
  })
})

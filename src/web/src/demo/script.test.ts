import { describe, expect, it } from 'vitest'
import { opening, pausingLine, scriptLine, seededLine } from './script'

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

  it('has the three lines the demo seed uses, in English and Turkish', () => {
    // seed.ts seeds the demo with seededLine(0), (1) and (2).
    for (const index of [0, 1, 2]) {
      const line = seededLine(index)
      expect(line.en.trim(), `seededLine(${index}) en`).not.toBe('')
      expect(line.tr.trim(), `seededLine(${index}) tr`).not.toBe('')
    }
  })

  it('has the pausing reply in English and Turkish', () => {
    expect(pausingLine?.en.trim()).toBeTruthy()
    expect(pausingLine?.tr.trim()).toBeTruthy()
  })
})

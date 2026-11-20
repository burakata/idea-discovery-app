import { describe, expect, it } from 'vitest'
import { projects } from '../projects'
import { sampleNotes, seeds } from './seed'

// The public demo must not show real client work. It ships only invented data.
// The words are built from parts so that a search for them in the source stays empty.
const real = ['pal' + 'let', 'pal' + 'et', 'ware' + 'house', 'de' + 'po']
const anyReal = new RegExp(real.join('|'), 'i')
const projectReal = new RegExp(real.slice(0, 2).join('|'), 'i')

describe('demo data', () => {
  it('ships no content from the real client project', () => {
    const everything = JSON.stringify({ projects, seeds, sampleNotes })
    expect(everything).not.toMatch(anyReal)
    for (const project of projects) {
      expect(project.id).not.toMatch(projectReal)
      expect(project.name.en).not.toMatch(projectReal)
      expect(project.name.tr).not.toMatch(projectReal)
    }
  })

  it('starts with nothing confirmed', () => {
    for (const project of projects) {
      const seed = seeds[project.id]
      const startsConfirmed = project.statements.filter(
        (statement) => (statement.group as string) === 'confirmed' || seed?.confirmed.includes(statement.id),
      )
      expect(startsConfirmed, project.id).toEqual([])
      expect(seed?.confirmed ?? [], project.id).toEqual([])
    }
  })

  it('only refers to people and statements that exist', () => {
    for (const project of projects) {
      const seed = seeds[project.id]
      if (!seed) continue
      const people = new Set(project.participants.map((person) => person.id))
      const statements = new Set(project.statements.map((statement) => statement.id))
      for (const message of seed.messages) expect(people.has(message.authorId), message.id).toBe(true)
      for (const [statementId, reactions] of Object.entries(seed.reactions)) {
        expect(statements.has(statementId), statementId).toBe(true)
        for (const reaction of reactions) expect(people.has(reaction.personId), statementId).toBe(true)
      }
      for (const item of seed.queue) {
        if (item.kind === 'message') expect(people.has(item.replyTo), item.id).toBe(true)
        if (item.kind === 'statement' && item.replaces) expect(statements.has(item.replaces), item.id).toBe(true)
        if (item.kind === 'jobFlow') expect(project.jobFlow.some((step) => step.id === item.stepId), item.id).toBe(true)
      }
    }
  })
})

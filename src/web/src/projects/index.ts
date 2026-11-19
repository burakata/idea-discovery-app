import { example } from './example'
import { pallet } from './pallet'
import type { Project } from './types'

// Add a project by adding its config here.
export const projects: Project[] = [pallet, example]

export function findProject(id: string | undefined): Project | undefined {
  return projects.find((project) => project.id === id)
}

// Project registry + signed-in `gh` viewer.
//
// Not given as a named zod schema anywhere in the reports; constructed
// directly from the fields report 04 §4.1 says `project.json` holds
// (`url, owner, repo, addedAt`, id = lowercase "owner__repo") and the
// `Viewer` shape report 04 §3.3 spells out in prose
// (`{ login, name|null, avatarUrl, htmlUrl }`, from `gh auth status` +
// `gh api user`). Flagged in the handback.
import { z } from 'zod'
import { IsoDate, Login } from './pr'

export const Project = z.object({
  id: z.string(), // lowercase "owner__repo"
  url: z.url(),
  owner: z.string(),
  repo: z.string(),
  addedAt: IsoDate,
  // derived at read time (repo/ exists only once a clone completed), not
  // stored in project.json: the launchpad needs it to offer "open" vs "clone"
  cloned: z.boolean()
})
export type Project = z.infer<typeof Project>

export const Viewer = z.object({
  login: Login,
  name: z.string().nullable(),
  avatarUrl: z.url(),
  htmlUrl: z.url()
})
export type Viewer = z.infer<typeof Viewer>

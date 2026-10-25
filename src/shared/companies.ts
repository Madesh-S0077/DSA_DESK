import type { Guide, GuideProblem, ProblemDetails } from './types'

/** Cross-listed problems ("see #55") carry their details on the original listing. */
export function detailsOf(guide: Guide, p: GuideProblem): ProblemDetails {
  return p.details.seeAlso ? (guide.problems.find((x) => x.no === p.details.seeAlso)?.details ?? p.details) : p.details
}

/** "Asked everywhere" problems count toward every company. */
export function askedAt(d: ProblemDetails, company: string): boolean {
  return !!d.everywhere || !!d.companies?.includes(company)
}

/** The first target company that asks this problem, if any. */
export function targetMatch(d: ProblemDetails, targets: Iterable<string>): string | null {
  for (const c of targets) if (askedAt(d, c)) return c
  return null
}

/** Sheet problems (one per slug) asked at a company, in guide order. */
export function problemsFor(guide: Guide, company: string): GuideProblem[] {
  const seen = new Set<string>()
  return guide.problems.filter((p) => {
    if (seen.has(p.slug) || !askedAt(detailsOf(guide, p), company)) return false
    seen.add(p.slug)
    return true
  })
}

/** Every company named in the guide with its problem count, most-asked first. */
export function listCompanies(guide: Guide): { company: string; count: number }[] {
  const names = new Set(guide.problems.flatMap((p) => p.details.companies ?? []))
  return [...names]
    .map((company) => ({ company, count: problemsFor(guide, company).length }))
    .sort((a, b) => b.count - a.count || a.company.localeCompare(b.company))
}

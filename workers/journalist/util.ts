/** Shared pure text helpers (no side effects, no host imports). */

/** Title-case an ALL-CAPS agency/occupation label for readable prose. */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** The /employment filter URL for an agency code (contract: page reads `agency_code`). */
export function agencyFilterUrl(agencyCode: string): string {
  return `/employment?agency_code=${encodeURIComponent(agencyCode)}`;
}

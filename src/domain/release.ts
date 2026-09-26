// Only change after actual professional review and physical print evidence.
export const RELEASE = {
  legalReviewed: false,
  printVerified: false,
  reviewedAt: '',
  evidence: '',
} as const;
export type Release = { legalReviewed: boolean; printVerified: boolean; reviewedAt: string; evidence: string };
export const releaseReady = (r: Release = RELEASE) => r.legalReviewed && r.printVerified && !!r.reviewedAt.trim() && !!r.evidence.trim();

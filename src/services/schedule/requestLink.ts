/**
 * SNV2 staff request link: https://<snv2>/request.html?f=<form id>
 *
 * The form id gives access to the request form (and its staff name list), so
 * it is NEVER stored in the code (the repository is public). An admin pastes
 * it once; it lives in Firestore, readable only by signed-in PACU Hub staff.
 *
 * Must stay in sync with the pattern in firestore.rules (pacuhub_settings).
 */
export const SNV2_REQUEST_PAGE = 'https://hussein-zreik.github.io/SNV2/request.html';
const FORM_ID = /^[A-Za-z0-9]{20,40}$/;

/** Returns the normalized link, or null if it isn't a valid SNV2 request link. */
/** Pulls the `?f=<formId>` out of a stored SNV2 request link. */
export function extractFormId(link: string | null): string | null {
  if (!link) return null;
  try {
    const formId = new URL(link).searchParams.get('f')?.trim() ?? '';
    return FORM_ID.test(formId) ? formId : null;
  } catch {
    return null;
  }
}

export function normalizeRequestLink(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (`${url.origin}${url.pathname}` !== SNV2_REQUEST_PAGE) return null;
  const formId = url.searchParams.get('f')?.trim() ?? '';
  return FORM_ID.test(formId) ? `${SNV2_REQUEST_PAGE}?f=${formId}` : null;
}

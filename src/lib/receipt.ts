/** Limits shared by the receipt upload UI and /api/parse-receipt. */
export const MAX_RECEIPT_IMAGES = 5;
/** Per-image base64 cap (~1.1 MB decoded); the client compresses well below this. */
export const MAX_IMAGE_CHARS = 1_500_000;
/** Whole request cap, under Vercel's ~4.5 MB function body limit. */
export const MAX_TOTAL_IMAGE_CHARS = 4_000_000;

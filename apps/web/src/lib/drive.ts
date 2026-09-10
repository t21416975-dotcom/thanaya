/**
 * Utility functions for detecting and handling Google Drive PDF and file links.
 */

/**
 * Extracts Google Drive file ID from various Drive and Docs URL formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - https://drive.google.com/file/d/FILE_ID/edit
 * - https://drive.google.com/file/d/FILE_ID
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/uc?export=download&id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID/...
 * - https://drive.google.com/u/0/uc?id=FILE_ID
 * - https://drive.google.com/file/u/0/d/FILE_ID/view
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Exclude folder links
  if (trimmed.includes('/drive/folders/') || trimmed.includes('/folders/')) {
    return null;
  }

  // Common Google Drive and Docs file ID patterns
  const driveRegex =
    /(?:drive|docs)\.google\.com\/(?:(?:u\/\d+\/)?file\/d\/|(?:u\/\d+\/)?open\?id=|(?:u\/\d+\/)?uc\?(?:[^&]+&)*id=|file\/u\/\d+\/d\/|document\/d\/|presentation\/d\/)([a-zA-Z0-9_-]+)/i;
  const match = trimmed.match(driveRegex);
  if (match && match[1]) return match[1];

  // Query parameter fallback (?id=... or &id=...)
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (
    queryMatch &&
    queryMatch[1] &&
    (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))
  ) {
    return queryMatch[1];
  }

  // /d/FILE_ID pattern fallback within Google Drive / Docs domain
  const dMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*?\/d\/([a-zA-Z0-9_-]+)/i);
  if (dMatch && dMatch[1]) return dMatch[1];

  return null;
}

/**
 * Returns true if the given URL is a supported Google Drive / Docs file URL.
 */
export function isGoogleDriveUrl(url: string): boolean {
  return extractGoogleDriveId(url) !== null;
}

/**
 * Returns the embeddable preview URL.
 * For Google Drive: https://drive.google.com/file/d/FILE_ID/preview
 * For other direct PDFs: returns the original URL
 */
export function getPdfPreviewUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }
  return url;
}

/**
 * Returns direct download URL.
 * For Google Drive: https://drive.google.com/uc?export=download&id=FILE_ID
 * For other direct PDFs: returns the original URL
 */
export function getPdfDownloadUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
  }
  return url;
}

/**
 * Returns full view URL (for opening in a new tab).
 * For Google Drive: https://drive.google.com/file/d/FILE_ID/view
 * For other direct PDFs: returns the original URL
 */
export function getPdfFullViewUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/view`;
  }
  return url;
}

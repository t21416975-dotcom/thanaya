/**
 * Utility functions for detecting and handling Google Drive PDF and file links.
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

export function isGoogleDriveUrl(url: string): boolean {
  return extractGoogleDriveId(url) !== null;
}

export function getPdfPreviewUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }
  return url;
}

export function getPdfDownloadUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
  }
  return url;
}

export function getPdfFullViewUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/view`;
  }
  return url;
}

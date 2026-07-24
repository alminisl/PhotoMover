/**
 * Build a localfile:// URL for an absolute path on disk.
 * The scheme is registered as "standard", so Chromium requires a host part —
 * a dummy "local" host keeps drive letters out of the hostname position.
 * Each path segment is URI-encoded so spaces, `#`, `?` etc. survive URL parsing.
 */
export function toLocalFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `localfile://local/${encoded.replace(/^\//, '')}`
}

/** Inverse of toLocalFileUrl: extract the filesystem path from a localfile:// URL. */
export function fromLocalFileUrl(url: string): string {
  let pathname = decodeURIComponent(new URL(url).pathname)
  // Windows: /C:/path → C:/path
  if (/^\/[A-Za-z]:\//.test(pathname)) pathname = pathname.slice(1)
  return pathname
}

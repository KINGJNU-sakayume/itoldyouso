export function uid(): string {
  // randomUUID only exists in secure contexts; plain-http LAN previews fall back.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

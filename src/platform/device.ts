/** True when running as an installed home-screen app rather than in a browser tab. */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Asks the browser not to evict this app's data under storage pressure.
 * Resolves to null where the API is missing.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return null
  }
}

import { useCallback, useState } from 'react'

function read(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : raw === 'true'
  } catch {
    // Storage can be unavailable, e.g. in a private window.
    return fallback
  }
}

/** A boolean setting remembered in this browser. */
export function useStoredBoolean(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => read(key, fallback))
  const update = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        localStorage.setItem(key, String(next))
      } catch {
        // The setting still applies for this visit.
      }
    },
    [key],
  )
  return [value, update]
}

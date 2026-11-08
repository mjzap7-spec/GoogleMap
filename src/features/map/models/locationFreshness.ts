/** Only confirmed server update times are used; unknown times must not imply live GPS. */
export function locationFreshness(
  location: { updatedAt?: number; expiresAt: number },
  now = Date.now(),
) {
  if (!Number.isFinite(location.expiresAt) || location.expiresAt <= now)
    return { kind: 'unavailable', label: 'Location unavailable', values: undefined } as const;
  if (!Number.isFinite(location.updatedAt))
    return { kind: 'unknown', label: 'Update time unavailable', values: undefined } as const;
  const seconds = Math.max(0, Math.floor((now - location.updatedAt!) / 1000));
  return {
    kind: seconds >= 60 ? 'stale' : 'current',
    label:
      seconds < 15
        ? 'Updated just now'
        : seconds < 60
          ? 'Updated {seconds}s ago'
          : 'Updated {minutes} min ago',
    values: { seconds, minutes: Math.floor(seconds / 60) },
  } as const;
}

/** Compatibility only for the unused pre-slot quick-save API. New saves use SaveStorage. */
const LEGACY_KEY = 'aethoria_savegame';

export function writeLegacyWebSave(serializedPayload: string): void {
  localStorage.setItem(LEGACY_KEY, serializedPayload);
}

export function readLegacyWebSave(): string | null {
  return localStorage.getItem(LEGACY_KEY);
}

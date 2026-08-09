import { platform } from '../PlatformService';
import type { SaveStorage } from './SaveStorage';
import { TauriSaveStorage } from './TauriSaveStorage';
import { WebSaveStorage } from './WebSaveStorage';

let storage: SaveStorage | undefined;

export function getSaveStorage(): SaveStorage {
  storage ??= platform.isDesktop ? new TauriSaveStorage() : new WebSaveStorage();
  return storage;
}

export * from './SaveStorage';
export { TauriSaveStorage } from './TauriSaveStorage';
export { WebSaveStorage } from './WebSaveStorage';

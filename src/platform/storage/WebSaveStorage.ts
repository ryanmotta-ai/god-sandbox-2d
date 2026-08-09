import { isSaveMetadata, parseSaveDocument, type AethoriaSaveDocument, type SaveMetadata } from '../saveFormat';
import {
  assertValidSlot,
  normalizeStorageError,
  SaveStorageError,
  queueSlotOperation,
  type SaveStorage,
  type StoredSaveDescriptor
} from './SaveStorage';

const SLOT_KEY = (slot: number) => `aethoria_slot_${slot}`;
const META_KEY = (slot: number) => `aethoria_slot_${slot}_meta`;
const BACKUP_KEY = (slot: number) => `aethoria_slot_${slot}_backup`;
const INDEX_KEY = 'aethoria_save_index_v1';
const GZIP_PREFIX = 'aethoria-gzip:';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Large browser saves are gzip-packed before entering quota-constrained storage. */
async function packDocument(serialized: string): Promise<string> {
  if (serialized.length < 256_000 || typeof CompressionStream === 'undefined') return serialized;
  const compressed = await new Response(new Blob([serialized]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return GZIP_PREFIX + bytesToBase64(new Uint8Array(compressed));
}

async function unpackDocument(stored: string): Promise<string> {
  if (!stored.startsWith(GZIP_PREFIX)) return stored;
  if (typeof DecompressionStream === 'undefined') throw new SaveStorageError('unsupported_version', 'This browser cannot decompress a large Aethoria save');
  const bytes = base64ToBytes(stored.slice(GZIP_PREFIX.length));
  const buffer = bytes.slice().buffer as ArrayBuffer;
  return new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

interface WebSaveIndexEntry {
  metadata: SaveMetadata;
  bytes: number;
  modifiedAt: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Browser compatibility backend. Existing slot keys remain readable. */
export class WebSaveStorage implements SaveStorage {
  public constructor(private readonly storage: KeyValueStorage = localStorage) {}

  public async save(slot: number, serializedDocument: string): Promise<void> {
    assertValidSlot(slot);
    const document = parseSaveDocument(serializedDocument);
    const packedDocument = await packDocument(serializedDocument);
    return queueSlotOperation(slot, async () => {
      const previousDocument = this.storage.getItem(SLOT_KEY(slot));
      const previousMetadata = this.storage.getItem(META_KEY(slot));
      const previousBackup = this.storage.getItem(BACKUP_KEY(slot));
      const previousIndex = this.storage.getItem(INDEX_KEY);

      try {
        this.commit(slot, packedDocument, document, previousDocument);
      } catch (firstError) {
        this.restore(slot, previousDocument, previousMetadata, previousBackup, previousIndex);

        // Retain the existing quota fallback: thumbnails are expendable; saves are not.
        if (document.metadata.thumbnail) {
          const withoutThumbnail: AethoriaSaveDocument<Record<string, any>> = {
            ...document,
            metadata: { ...document.metadata, thumbnail: undefined }
          };
          try {
            this.commit(slot, await packDocument(JSON.stringify(withoutThumbnail)), withoutThumbnail, previousDocument);
            return;
          } catch (retryError) {
            this.restore(slot, previousDocument, previousMetadata, previousBackup, previousIndex);
            throw normalizeStorageError(retryError, 'Browser storage could not write the save');
          }
        }

        throw normalizeStorageError(firstError, 'Browser storage could not write the save');
      }
    });
  }

  public async load(slot: number): Promise<string | null> {
    assertValidSlot(slot);
    try {
      const primary = this.storage.getItem(SLOT_KEY(slot));
      if (primary === null) {
        return this.storage.getItem(BACKUP_KEY(slot)) === null ? null : await this.recoverFromBackup(slot);
      }

      try {
        const unpacked = await unpackDocument(primary);
        parseSaveDocument(unpacked, this.readLegacyMetadata(slot));
        return unpacked;
      } catch {
        return await this.recoverFromBackup(slot);
      }
    } catch (error) {
      if (error instanceof SaveStorageError) throw error;
      throw normalizeStorageError(error, 'Browser storage could not read the save');
    }
  }

  public async exportSave(slot: number): Promise<string | null> {
    return this.load(slot);
  }

  public async importSave(slot: number, serializedDocument: string): Promise<void> {
    await this.save(slot, serializedDocument);
  }

  public async list(): Promise<StoredSaveDescriptor[]> {
    const descriptors: StoredSaveDescriptor[] = [];
    const index = this.readIndex();
    for (let slot = 0; slot <= 4; slot++) {
      const indexed = index.get(slot);
      if (indexed) {
        descriptors.push({ slot, ...indexed, valid: true });
        continue;
      }

      // Legacy saves have no lightweight index yet; parse once and migrate the
      // index on their next write. Current saves never parse their world payload
      // just to paint the slot list.
      const serialized = this.storage.getItem(SLOT_KEY(slot));
      if (!serialized) continue;

      try {
        const legacyMetadata = this.readLegacyMetadata(slot);
        const document = parseSaveDocument(await unpackDocument(serialized), legacyMetadata);
        descriptors.push({
          slot,
          metadata: document.metadata,
          bytes: new TextEncoder().encode(serialized).byteLength,
          modifiedAt: document.metadata.timestamp,
          valid: true
        });
      } catch (error) {
        descriptors.push({
          slot,
          bytes: new TextEncoder().encode(serialized).byteLength,
          modifiedAt: 0,
          valid: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return descriptors;
  }

  public async delete(slot: number): Promise<void> {
    assertValidSlot(slot);
    try {
      this.storage.removeItem(SLOT_KEY(slot));
      this.storage.removeItem(META_KEY(slot));
      this.storage.removeItem(BACKUP_KEY(slot));
      const index = this.readIndex();
      index.delete(slot);
      this.writeIndex(index);
    } catch (error) {
      throw normalizeStorageError(error, 'Browser storage could not delete the save');
    }
  }

  public async exists(slot: number): Promise<boolean> {
    return (await this.load(slot)) !== null;
  }

  private commit(
    slot: number,
    storedDocument: string,
    document: AethoriaSaveDocument<Record<string, any>>,
    previousDocument: string | null
  ): void {
    if (previousDocument !== null) this.storage.setItem(BACKUP_KEY(slot), previousDocument);
    this.storage.setItem(SLOT_KEY(slot), storedDocument);
    // Keep the old metadata key current for backwards compatibility with V0 clients.
    this.storage.setItem(META_KEY(slot), JSON.stringify({
      name: document.metadata.worldName,
      thumbnail: document.metadata.thumbnail
    }));
    const index = this.readIndex();
    index.set(slot, {
      metadata: document.metadata,
      bytes: new TextEncoder().encode(storedDocument).byteLength,
      modifiedAt: document.metadata.timestamp
    });
    this.writeIndex(index);
  }

  private restore(
    slot: number,
    document: string | null,
    metadata: string | null,
    backup: string | null,
    index: string | null
  ): void {
    try {
      if (document === null) this.storage.removeItem(SLOT_KEY(slot));
      else this.storage.setItem(SLOT_KEY(slot), document);

      if (metadata === null) this.storage.removeItem(META_KEY(slot));
      else this.storage.setItem(META_KEY(slot), metadata);

      if (backup === null) this.storage.removeItem(BACKUP_KEY(slot));
      else this.storage.setItem(BACKUP_KEY(slot), backup);

      if (index === null) this.storage.removeItem(INDEX_KEY);
      else this.storage.setItem(INDEX_KEY, index);
    } catch (error) {
      throw new SaveStorageError(
        'rollback_failure',
        'Browser storage failed while restoring the previous save',
        { cause: error }
      );
    }
  }

  private readLegacyMetadata(slot: number): { name?: string; thumbnail?: string } {
    try {
      const serialized = this.storage.getItem(META_KEY(slot));
      if (!serialized) return {};
      const parsed = JSON.parse(serialized);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private async recoverFromBackup(slot: number): Promise<string | null> {
    const backup = this.storage.getItem(BACKUP_KEY(slot));
    if (backup === null) {
      throw new SaveStorageError('corrupted_file', 'The primary save is missing or corrupted and no valid backup exists');
    }

    let document: AethoriaSaveDocument<Record<string, any>>;
    try {
      document = parseSaveDocument(await unpackDocument(backup), this.readLegacyMetadata(slot));
    } catch (error) {
      throw new SaveStorageError('corrupted_file', 'The primary save and its backup are corrupted', { cause: error });
    }

    try {
      this.storage.setItem(SLOT_KEY(slot), backup);
      this.storage.setItem(META_KEY(slot), JSON.stringify({
        name: document.metadata.worldName,
        thumbnail: document.metadata.thumbnail
      }));
      const index = this.readIndex();
      index.set(slot, {
        metadata: document.metadata,
        bytes: new TextEncoder().encode(backup).byteLength,
        modifiedAt: document.metadata.timestamp
      });
      this.writeIndex(index);
      return await unpackDocument(backup);
    } catch (error) {
      throw normalizeStorageError(error, 'Browser storage could not recover the backup save');
    }
  }

  private readIndex(): Map<number, WebSaveIndexEntry> {
    try {
      const serialized = this.storage.getItem(INDEX_KEY);
      if (!serialized) return new Map();
      const parsed: unknown = JSON.parse(serialized);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return new Map();
      const index = new Map<number, WebSaveIndexEntry>();
      for (const [slotKey, value] of Object.entries(parsed)) {
        const slot = Number(slotKey);
        if (!Number.isInteger(slot) || slot < 0 || slot > 4 || typeof value !== 'object' || value === null) continue;
        const entry = value as Partial<WebSaveIndexEntry>;
        if (isSaveMetadata(entry.metadata) && typeof entry.bytes === 'number' && typeof entry.modifiedAt === 'number') {
          index.set(slot, { metadata: entry.metadata, bytes: entry.bytes, modifiedAt: entry.modifiedAt });
        }
      }
      return index;
    } catch {
      return new Map();
    }
  }

  private writeIndex(index: Map<number, WebSaveIndexEntry>): void {
    this.storage.setItem(INDEX_KEY, JSON.stringify(Object.fromEntries(index)));
  }
}

import { platform, type PlatformService } from '../PlatformService';
import { isSaveMetadata, type SaveMetadata } from '../saveFormat';
import {
  assertValidSlot,
  normalizeStorageError,
  queueSlotOperation,
  type SaveStorage,
  type StoredSaveDescriptor
} from './SaveStorage';

interface NativeSaveDescriptor {
  slot: number;
  metadata?: SaveMetadata;
  bytes: number;
  modifiedAt: number;
  valid: boolean;
  error?: string;
}

/** Thin adapter over path-constrained Rust commands. No filesystem path crosses IPC. */
export class TauriSaveStorage implements SaveStorage {
  public constructor(private readonly platformService: PlatformService = platform) {}

  public async save(slot: number, serializedDocument: string): Promise<void> {
    assertValidSlot(slot);
    return queueSlotOperation(slot, async () => {
      try {
        await this.platformService.invokeNative<void>('aethoria_storage_write', {
          slot,
          contents: serializedDocument
        });
      } catch (error) {
        throw normalizeStorageError(error, 'Desktop storage could not write the save');
      }
    });
  }

  public async load(slot: number): Promise<string | null> {
    assertValidSlot(slot);
    try {
      return await this.platformService.invokeNative<string | null>('aethoria_storage_read', { slot });
    } catch (error) {
      throw normalizeStorageError(error, 'Desktop storage could not read the save');
    }
  }

  public async exportSave(slot: number): Promise<string | null> {
    assertValidSlot(slot);
    try {
      return await this.platformService.invokeNative<string | null>('aethoria_storage_export', { slot });
    } catch (error) {
      throw normalizeStorageError(error, 'Desktop storage could not export the save');
    }
  }

  public async importSave(slot: number, serializedDocument: string): Promise<void> {
    assertValidSlot(slot);
    return queueSlotOperation(slot, async () => {
      try {
        await this.platformService.invokeNative<void>('aethoria_storage_import', {
          slot,
          contents: serializedDocument
        });
      } catch (error) {
        throw normalizeStorageError(error, 'Desktop storage could not import the save');
      }
    });
  }

  public async list(): Promise<StoredSaveDescriptor[]> {
    try {
      const descriptors = await this.platformService.invokeNative<NativeSaveDescriptor[]>('aethoria_storage_list');
      return descriptors.map(descriptor => descriptor.valid && !isSaveMetadata(descriptor.metadata)
        ? {
            ...descriptor,
            valid: false,
            metadata: undefined,
            error: 'Save document metadata is missing or invalid'
          }
        : descriptor);
    } catch (error) {
      throw normalizeStorageError(error, 'Desktop storage could not list saves');
    }
  }

  public async delete(slot: number): Promise<void> {
    assertValidSlot(slot);
    try {
      await this.platformService.invokeNative<void>('aethoria_storage_delete', { slot });
    } catch (error) {
      throw normalizeStorageError(error, 'Desktop storage could not delete the save');
    }
  }

  public async exists(slot: number): Promise<boolean> {
    assertValidSlot(slot);
    try {
      return await this.platformService.invokeNative<boolean>('aethoria_storage_exists', { slot });
    } catch (error) {
      throw normalizeStorageError(error, 'Desktop storage could not check the save');
    }
  }
}

import type { SaveMetadata } from '../saveFormat';

export type SaveStorageErrorCode =
  | 'permission_denied'
  | 'disk_full'
  | 'corrupted_file'
  | 'missing_file'
  | 'invalid_format'
  | 'unsupported_version'
  | 'invalid_slot'
  | 'write_failure'
  | 'rollback_failure'
  | 'path_unavailable'
  | 'runtime_failure'
  | 'io_failure'
  | 'unknown';

export class SaveStorageError extends Error {
  public constructor(
    public readonly code: SaveStorageErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SaveStorageError';
  }
}

export interface StoredSaveDescriptor {
  slot: number;
  metadata?: SaveMetadata;
  bytes: number;
  modifiedAt: number;
  valid: boolean;
  error?: string;
}

/** Async by contract so large native file I/O never requires a synchronous API. */
export interface SaveStorage {
  save(slot: number, serializedDocument: string): Promise<void>;
  load(slot: number): Promise<string | null>;
  /** Portable `.aethoria` document transfer; file picking belongs to the UI layer. */
  exportSave(slot: number): Promise<string | null>;
  importSave(slot: number, serializedDocument: string): Promise<void>;
  list(): Promise<StoredSaveDescriptor[]>;
  delete(slot: number): Promise<void>;
  exists(slot: number): Promise<boolean>;
}

const slotTails = new Map<number, Promise<void>>();

/**
 * A process-wide FIFO, deliberately shared by the web and desktop adapters.
 * Autosaves and manual saves address the same slot through this queue.
 */
export function queueSlotOperation<T>(slot: number, operation: () => Promise<T>): Promise<T> {
  const previous = slotTails.get(slot) ?? Promise.resolve();
  const execution = previous.catch(() => undefined).then(operation);
  const tail = execution.then(() => undefined, () => undefined);
  slotTails.set(slot, tail);
  return execution.finally(() => {
    if (slotTails.get(slot) === tail) slotTails.delete(slot);
  });
}

const KNOWN_CODES = new Set<SaveStorageErrorCode>([
  'permission_denied',
  'disk_full',
  'corrupted_file',
  'missing_file',
  'invalid_format',
  'unsupported_version',
  'invalid_slot',
  'write_failure',
  'rollback_failure',
  'path_unavailable',
  'runtime_failure',
  'io_failure',
  'unknown'
]);

export function normalizeStorageError(error: unknown, fallbackMessage: string): SaveStorageError {
  if (error instanceof SaveStorageError) return error;

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
    const code = candidate.name === 'QuotaExceededError'
      ? 'disk_full'
      : candidate.name === 'SecurityError'
        ? 'permission_denied'
        : typeof candidate.code === 'string' && KNOWN_CODES.has(candidate.code as SaveStorageErrorCode)
          ? candidate.code as SaveStorageErrorCode
          : 'unknown';
    const message = typeof candidate.message === 'string' ? candidate.message : fallbackMessage;
    return new SaveStorageError(code, message, { cause: error });
  }

  return new SaveStorageError(
    'unknown',
    typeof error === 'string' ? error : fallbackMessage,
    { cause: error }
  );
}

export function assertValidSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot > 4) {
    throw new SaveStorageError('invalid_slot', 'Save slot must be an integer between 0 and 4');
  }
}

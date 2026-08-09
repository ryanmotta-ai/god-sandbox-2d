export const SAVE_FILE_EXTENSION = '.aethoria';
export const SAVE_DOCUMENT_KIND = 'aethoria-save' as const;
export const SAVE_FORMAT_VERSION = 4;
export const MIN_SUPPORTED_SAVE_FORMAT_VERSION = 1;
export const GAME_VERSION = '1.0.0';

export interface SaveWorldDimensions {
  width: number;
  height: number;
}

/** Metadata is intentionally extensible; fields not available in V1A stay optional. */
export interface SaveMetadata {
  saveFormatVersion: number;
  gameVersion: string;
  worldName: string;
  timestamp: number;
  seed?: number;
  simulationYear?: number;
  era?: string;
  population?: number;
  kingdoms?: number;
  playtimeSeconds?: number;
  worldDimensions?: SaveWorldDimensions;
  thumbnail?: string;
}

export interface AethoriaSaveDocument<T = unknown> {
  kind: typeof SAVE_DOCUMENT_KIND;
  formatVersion: number;
  metadata: SaveMetadata;
  payload: T;
}

export interface SaveMetadataInput {
  name?: string;
  thumbnail?: string;
  seed?: number;
  playtimeSeconds?: number;
}

export class SaveFormatError extends Error {
  public constructor(
    public readonly code: 'invalid_format' | 'unsupported_version' | 'corrupted_file',
    message: string
  ) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSupportedFormatVersion(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_SUPPORTED_SAVE_FORMAT_VERSION
    && value <= SAVE_FORMAT_VERSION;
}

export function isSaveMetadata(value: unknown): value is SaveMetadata {
  if (!isRecord(value)) return false;
  if (!isSupportedFormatVersion(value.saveFormatVersion)) return false;
  if (typeof value.gameVersion !== 'string') return false;
  if (typeof value.worldName !== 'string') return false;
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return false;
  if (value.seed !== undefined && typeof value.seed !== 'number') return false;
  if (value.simulationYear !== undefined && typeof value.simulationYear !== 'number') return false;
  if (value.era !== undefined && typeof value.era !== 'string') return false;
  if (value.population !== undefined && typeof value.population !== 'number') return false;
  if (value.kingdoms !== undefined && typeof value.kingdoms !== 'number') return false;
  if (value.playtimeSeconds !== undefined && typeof value.playtimeSeconds !== 'number') return false;
  if (value.thumbnail !== undefined && typeof value.thumbnail !== 'string') return false;
  if (value.worldDimensions !== undefined) {
    if (!isRecord(value.worldDimensions)) return false;
    if (typeof value.worldDimensions.width !== 'number') return false;
    if (typeof value.worldDimensions.height !== 'number') return false;
  }
  return true;
}

export function validateSavePayload(payload: unknown): asserts payload is Record<string, any> {
  if (!isRecord(payload) || !isRecord(payload.world)) {
    throw new SaveFormatError('invalid_format', 'Save payload is missing world data');
  }

  if (payload.version !== undefined && !isSupportedFormatVersion(payload.version)) {
    throw new SaveFormatError(
      'unsupported_version',
      `Save format ${payload.version} is not supported by format ${SAVE_FORMAT_VERSION}`
    );
  }
}

export function buildSaveMetadata(
  payload: Record<string, any>,
  input: SaveMetadataInput = {}
): SaveMetadata {
  const width = Number(payload.world?.width);
  const height = Number(payload.world?.height ?? payload.world?.width);
  const worldDimensions = Number.isFinite(width) && Number.isFinite(height)
    ? { width, height }
    : undefined;

  return {
    saveFormatVersion: SAVE_FORMAT_VERSION,
    gameVersion: GAME_VERSION,
    worldName: input.name || 'Aethoria World',
    timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
    seed: input.seed,
    simulationYear: typeof payload.year === 'number' ? payload.year : undefined,
    era: typeof payload.era === 'string' ? payload.era : undefined,
    population: Array.isArray(payload.entities) ? payload.entities.length : undefined,
    kingdoms: Array.isArray(payload.kingdoms) ? payload.kingdoms.length : undefined,
    playtimeSeconds: input.playtimeSeconds,
    worldDimensions,
    thumbnail: input.thumbnail
  };
}

export function createSaveDocument<T extends Record<string, any>>(
  payload: T,
  input: SaveMetadataInput = {}
): AethoriaSaveDocument<T> {
  validateSavePayload(payload);
  return {
    kind: SAVE_DOCUMENT_KIND,
    formatVersion: SAVE_FORMAT_VERSION,
    metadata: buildSaveMetadata(payload, input),
    payload
  };
}

/** Accepts V1A envelopes and legacy raw JSON save payloads. */
export function parseSaveDocument(
  serialized: string,
  legacyMetadata: SaveMetadataInput = {}
): AethoriaSaveDocument<Record<string, any>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new SaveFormatError(
      'corrupted_file',
      `Save document is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (isRecord(parsed) && parsed.kind === SAVE_DOCUMENT_KIND) {
    if (!Number.isInteger(parsed.formatVersion)) {
      throw new SaveFormatError('invalid_format', 'Save document has no integer formatVersion');
    }
    if (!isSupportedFormatVersion(parsed.formatVersion)) {
      throw new SaveFormatError(
        'unsupported_version',
        `Save document format ${parsed.formatVersion} is not supported by format ${SAVE_FORMAT_VERSION}`
      );
    }
    if (!isSaveMetadata(parsed.metadata)) {
      throw new SaveFormatError('corrupted_file', 'Save document metadata is missing or invalid');
    }
    if (parsed.metadata.saveFormatVersion !== parsed.formatVersion) {
      throw new SaveFormatError('corrupted_file', 'Save document metadata version does not match its envelope');
    }
    validateSavePayload(parsed.payload);
    return parsed as unknown as AethoriaSaveDocument<Record<string, any>>;
  }

  validateSavePayload(parsed);
  return createSaveDocument(parsed, legacyMetadata);
}

export function serializeSaveDocument<T extends Record<string, any>>(
  payload: T,
  input: SaveMetadataInput = {}
): string {
  return JSON.stringify(createSaveDocument(payload, input));
}

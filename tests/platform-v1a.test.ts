import assert from 'node:assert/strict';
import { PlatformService } from '../src/platform/PlatformService';
import {
  SAVE_FORMAT_VERSION,
  parseSaveDocument,
  serializeSaveDocument
} from '../src/platform/saveFormat';
import { TauriSaveStorage } from '../src/platform/storage/TauriSaveStorage';
import { WebSaveStorage, type KeyValueStorage } from '../src/platform/storage/WebSaveStorage';

class MemoryStorage implements KeyValueStorage {
  protected readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

class SizeLimitedStorage extends MemoryStorage {
  public constructor(private readonly maxSaveLength: number) {
    super();
  }

  public override setItem(key: string, value: string): void {
    if (/^aethoria_slot_\d+$/.test(key) && value.length > this.maxSaveLength) {
      throw Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
    }
    super.setItem(key, value);
  }
}

const payload = {
  version: SAVE_FORMAT_VERSION,
  timestamp: 123456,
  year: 42,
  era: 'Golden Age',
  world: { width: 128, height: 96, tiles: [] },
  entities: [{ id: 'citizen-1' }],
  kingdoms: [{ id: 'realm-1' }]
};

async function testSaveEnvelope(): Promise<void> {
  const serialized = serializeSaveDocument(payload, {
    name: 'Test World',
    seed: 8675309,
    playtimeSeconds: 90
  });
  const document = parseSaveDocument(serialized);

  assert.equal(document.kind, 'aethoria-save');
  assert.equal(document.formatVersion, SAVE_FORMAT_VERSION);
  assert.equal(document.metadata.worldName, 'Test World');
  assert.equal(document.metadata.seed, 8675309);
  assert.equal(document.metadata.simulationYear, 42);
  assert.equal(document.metadata.population, 1);
  assert.deepEqual(document.metadata.worldDimensions, { width: 128, height: 96 });
  assert.deepEqual(document.payload, payload);

  const legacy = parseSaveDocument(JSON.stringify(payload), { name: 'Legacy World' });
  assert.equal(legacy.metadata.worldName, 'Legacy World');
  assert.deepEqual(legacy.payload, payload);
}

async function testWebStorageLifecycle(): Promise<void> {
  const memory = new MemoryStorage();
  const storage = new WebSaveStorage(memory);
  const serialized = serializeSaveDocument(payload, { name: 'Slot One', seed: 7 });

  assert.equal(await storage.exists(1), false);
  await storage.save(1, serialized);
  assert.equal(await storage.exists(1), true);
  assert.equal(await storage.load(1), serialized);

  const descriptors = await storage.list();
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].slot, 1);
  assert.equal(descriptors[0].metadata?.worldName, 'Slot One');
  assert.equal(descriptors[0].valid, true);

  await storage.delete(1);
  assert.equal(await storage.exists(1), false);
}

async function testLegacyWebSlotMigration(): Promise<void> {
  const memory = new MemoryStorage();
  memory.setItem('aethoria_slot_2', JSON.stringify(payload));
  memory.setItem('aethoria_slot_2_meta', JSON.stringify({ name: 'Old Slot', thumbnail: 'data:image/png,x' }));
  const descriptor = (await new WebSaveStorage(memory).list())[0];

  assert.equal(descriptor.slot, 2);
  assert.equal(descriptor.metadata?.worldName, 'Old Slot');
  assert.equal(descriptor.metadata?.thumbnail, 'data:image/png,x');
}

async function testQuotaFallbackKeepsWorldData(): Promise<void> {
  const withoutThumbnail = serializeSaveDocument(payload, { name: 'Quota Slot' });
  const limited = new SizeLimitedStorage(withoutThumbnail.length + 16);
  const storage = new WebSaveStorage(limited);
  const withThumbnail = serializeSaveDocument(payload, {
    name: 'Quota Slot',
    thumbnail: `data:image/png;base64,${'x'.repeat(2_000)}`
  });

  await storage.save(3, withThumbnail);
  const stored = await storage.load(3);
  assert.ok(stored);
  const document = parseSaveDocument(stored);
  assert.equal(document.metadata.thumbnail, undefined);
  assert.deepEqual(document.payload, payload);
}

class RecordingPlatform extends PlatformService {
  public calls: Array<{ command: string; args?: Record<string, unknown> }> = [];

  public constructor() {
    super('tauri');
  }

  public override async invokeNative<T>(
    command: string,
    args?: Record<string, unknown>
  ): Promise<T> {
    this.calls.push({ command, args });
    if (command === 'aethoria_storage_exists') return true as T;
    if (command === 'aethoria_storage_read') return null as T;
    if (command === 'aethoria_storage_list') return [] as T;
    return undefined as T;
  }
}

async function testNativeBoundaryNeverAcceptsPaths(): Promise<void> {
  const recorder = new RecordingPlatform();
  const storage = new TauriSaveStorage(recorder);
  const serialized = serializeSaveDocument(payload, { name: 'Desktop Slot' });

  await storage.save(4, serialized);
  await storage.load(4);
  await storage.list();
  await storage.exists(4);
  await storage.delete(4);

  assert.deepEqual(recorder.calls.map(call => call.command), [
    'aethoria_storage_write',
    'aethoria_storage_read',
    'aethoria_storage_list',
    'aethoria_storage_exists',
    'aethoria_storage_delete'
  ]);
  for (const call of recorder.calls) {
    assert.equal(Object.hasOwn(call.args ?? {}, 'path'), false);
  }
}

async function testCentralPlatformDetection(): Promise<void> {
  const web = new PlatformService('web');
  const desktop = new PlatformService('tauri');
  assert.equal(web.runtime, 'web');
  assert.equal(web.isDesktop, false);
  assert.equal(desktop.runtime, 'tauri');
  assert.equal(desktop.isDesktop, true);
}

await testSaveEnvelope();
await testWebStorageLifecycle();
await testLegacyWebSlotMigration();
await testQuotaFallbackKeepsWorldData();
await testNativeBoundaryNeverAcceptsPaths();
await testCentralPlatformDetection();

console.log('PLATFORM-V1A tests passed: format, web storage, legacy migration, quota fallback, and native boundary.');

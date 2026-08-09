import assert from 'node:assert/strict';
import { PlatformService } from '../src/platform/PlatformService';
import { SAVE_FORMAT_VERSION, parseSaveDocument, serializeSaveDocument } from '../src/platform/saveFormat';
import { queueSlotOperation } from '../src/platform/storage/SaveStorage';
import { TauriSaveStorage } from '../src/platform/storage/TauriSaveStorage';
import { WebSaveStorage, type KeyValueStorage } from '../src/platform/storage/WebSaveStorage';

class MemoryStorage implements KeyValueStorage {
  protected readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
  public removeItem(key: string): void { this.values.delete(key); }
  public corrupt(key: string, value: string): void { this.values.set(key, value); }
}

const payload = (marker: string) => ({
  version: SAVE_FORMAT_VERSION,
  timestamp: 123456,
  world: { width: 128, height: 96, marker, tiles: [] },
  entities: [], kingdoms: []
});

async function testFormatValidation(): Promise<void> {
  const serialized = serializeSaveDocument(payload('valid'), { name: 'Valid World' });
  assert.equal(parseSaveDocument(serialized).metadata.worldName, 'Valid World');
  assert.throws(() => parseSaveDocument(JSON.stringify({
    kind: 'aethoria-save', formatVersion: 99,
    metadata: { saveFormatVersion: 99, gameVersion: '99', worldName: 'Future', timestamp: 1 },
    payload: payload('future')
  })));
  assert.throws(() => parseSaveDocument(JSON.stringify({
    kind: 'aethoria-save', formatVersion: 3,
    metadata: { saveFormatVersion: 2, gameVersion: '1', worldName: 'Mismatch', timestamp: 1 },
    payload: payload('bad')
  })));
}

async function testWebSmokeAndRecovery(): Promise<void> {
  const memory = new MemoryStorage();
  const firstSession = new WebSaveStorage(memory);
  const first = serializeSaveDocument(payload('first'), { name: 'First' });
  const second = serializeSaveDocument(payload('second'), { name: 'Second' });

  await firstSession.save(1, first);                 // save
  await firstSession.save(1, second);                // overwrite -> backup
  assert.equal((await firstSession.list())[0].metadata?.worldName, 'Second'); // lightweight index

  memory.corrupt('aethoria_slot_1', '{broken');
  const reopenedSession = new WebSaveStorage(memory); // close -> open
  const recovered = await reopenedSession.load(1);    // load -> automatic backup recovery
  assert.ok(recovered);
  assert.equal(parseSaveDocument(recovered).payload.world.marker, 'first');
  assert.equal(parseSaveDocument((await reopenedSession.load(1))!).payload.world.marker, 'first');
}

async function testPerSlotQueue(): Promise<void> {
  const events: string[] = [];
  let releaseFirst: (() => void) | undefined;
  let signalStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const first = queueSlotOperation(0, async () => {
    events.push('autosave:start');
    signalStarted?.();
    await new Promise<void>(resolve => { releaseFirst = resolve; });
    events.push('autosave:end');
  });
  const second = queueSlotOperation(0, async () => { events.push('manual:start'); });
  await started;
  assert.deepEqual(events, ['autosave:start']);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['autosave:start', 'autosave:end', 'manual:start']);
}

class RecordingPlatform extends PlatformService {
  public calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  public constructor() { super('tauri'); }
  public override async invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    this.calls.push({ command, args });
    if (command === 'aethoria_storage_exists') return true as T;
    if (command === 'aethoria_storage_read' || command === 'aethoria_storage_export') return null as T;
    if (command === 'aethoria_storage_list') return [] as T;
    return undefined as T;
  }
}

async function testNativeBoundaryAndPortableTransfer(): Promise<void> {
  const recorder = new RecordingPlatform();
  const storage = new TauriSaveStorage(recorder);
  const serialized = serializeSaveDocument(payload('native'), { name: 'Desktop Slot' });
  await storage.save(4, serialized);
  await storage.importSave(4, serialized);
  await storage.exportSave(4);
  await storage.load(4);
  await storage.list();
  await storage.exists(4);
  await storage.delete(4);
  assert.deepEqual(recorder.calls.map(call => call.command), [
    'aethoria_storage_write', 'aethoria_storage_import', 'aethoria_storage_export',
    'aethoria_storage_read', 'aethoria_storage_list', 'aethoria_storage_exists', 'aethoria_storage_delete'
  ]);
  for (const call of recorder.calls) assert.equal(Object.hasOwn(call.args ?? {}, 'path'), false);
}

await testFormatValidation();
await testWebSmokeAndRecovery();
await testPerSlotQueue();
await testNativeBoundaryAndPortableTransfer();
console.log('PLATFORM-V1B tests passed: validation, indexed web saves, recovery, per-slot queue, and native transfer boundary.');

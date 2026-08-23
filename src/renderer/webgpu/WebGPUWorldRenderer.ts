import type { DiplomacyManager } from '../../civ/Diplomacy';
import { perfProfiler } from '../../perf/PerformanceProfiler';
import type { RenderOptions, SelectionMark } from '../Renderer';
import type { WorldRenderer, WorldRendererTelemetry, WorldRenderArguments } from '../world/WorldRenderer';
import { INSTANCE_BYTES, RenderSnapshotBuilder } from './RenderSnapshot';
import { createInitialTextureAtlas, type TextureAtlasResource } from './TextureAtlas';
import { WEBGPU_WORLD_SHADER } from './WebGPUShader';

// WebGPU bit values from the specification. TypeScript's DOM bundle in this
// project has the interfaces but omits the matching runtime constant types.
const BUFFER_USAGE_COPY_DST = 0x08;
const BUFFER_USAGE_INDEX = 0x10;
const BUFFER_USAGE_VERTEX = 0x20;
const BUFFER_USAGE_UNIFORM = 0x40;
const TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10;
const COLOR_WRITE_ALL = 0x0f;

function describeGpuError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

export interface WebGPUWorldRendererOptions {
  cssWidth: number;
  cssHeight: number;
  benchmarkInstances: number;
  onFatalError: (error: unknown) => void;
}

class GpuInstanceBuffer {
  public buffer: GPUBuffer;
  public capacityBytes: number;
  public usedBytes = 0;
  public revision = -1;

  constructor(private readonly device: GPUDevice, private readonly label: string, initialBytes: number = 256) {
    this.capacityBytes = initialBytes;
    this.buffer = this.create(initialBytes);
  }

  public upload(data: Uint8Array): number {
    if (data.byteLength === 0) return 0;
    this.ensure(data.byteLength);
    this.device.queue.writeBuffer(this.buffer, 0, data);
    this.usedBytes = data.byteLength;
    return data.byteLength;
  }

  public destroy(): void { this.buffer.destroy(); }

  private ensure(requiredBytes: number): void {
    if (requiredBytes <= this.capacityBytes) return;
    let capacity = this.capacityBytes;
    while (capacity < requiredBytes) capacity *= 2;
    this.buffer.destroy();
    this.capacityBytes = capacity;
    this.buffer = this.create(capacity);
  }

  private create(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: this.label,
      size,
      usage: BUFFER_USAGE_VERTEX | BUFFER_USAGE_COPY_DST
    });
  }
}

/** Primary WebGPU world backend: resident chunks, paged atlases and instancing. */
export class WebGPUWorldRenderer implements WorldRenderer {
  public readonly kind = 'webgpu' as const;
  public readonly telemetry: WorldRendererTelemetry;

  private adapter!: GPUAdapter;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private canvasFormat!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private bindGroups: GPUBindGroup[] = [];
  private cameraBuffer!: GPUBuffer;
  private quadBuffer!: GPUBuffer;
  private indexBuffer!: GPUBuffer;
  private readonly chunkBuffers = new Map<string, Map<number, GpuInstanceBuffer>>();
  private readonly dynamicBuffers = new Map<number, GpuInstanceBuffer>();
  private atlas!: TextureAtlasResource;
  private snapshots!: RenderSnapshotBuilder;
  private depthTexture: GPUTexture | null = null;
  private selection: SelectionMark | null = null;
  private renderOptions: Partial<RenderOptions> = {};
  private cssWidth: number;
  private cssHeight: number;
  private pixelWidth = 0;
  private pixelHeight = 0;
  private devicePixelRatio = 1;
  private destroyed = false;
  private failed = false;
  private readonly cameraUniformData = new Float32Array(12);
  private previousFrameStarted = 0;

  private constructor(private readonly canvas: HTMLCanvasElement, private readonly options: WebGPUWorldRendererOptions) {
    this.cssWidth = Math.max(1, options.cssWidth);
    this.cssHeight = Math.max(1, options.cssHeight);
    this.telemetry = {
      kind: 'webgpu',
      active: false,
      status: 'initializing',
      visibleInstances: 0,
      drawCalls: 0,
      bufferUploadBytes: 0,
      peakBufferUploadBytes: 0,
      renderPreparationMs: 0,
      peakRenderPreparationMs: 0,
      frameSubmissionMs: 0,
      frameIntervalMs: 0,
      staticBufferBytes: 0,
      dynamicBufferBytes: 0,
      atlasBytes: 0,
      benchmarkInstances: options.benchmarkInstances
    };
  }

  public static async create(canvas: HTMLCanvasElement, options: WebGPUWorldRendererOptions): Promise<WebGPUWorldRenderer> {
    const renderer = new WebGPUWorldRenderer(canvas, options);
    await renderer.initialize();
    return renderer;
  }

  public setDiplomacy(_diplomacy: DiplomacyManager): void {
    // Territory/diplomacy remain on the Canvas parity path for V1A.
  }

  public setOptions(options: Partial<RenderOptions>): void {
    this.renderOptions = { ...this.renderOptions, ...options };
  }

  public setSelection(selection: SelectionMark | null): void { this.selection = selection; }

  public resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = Math.max(1, Math.floor(cssWidth));
    this.cssHeight = Math.max(1, Math.floor(cssHeight));
    const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
    const pixelWidth = Math.max(1, Math.round(this.cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(this.cssHeight * dpr));
    this.devicePixelRatio = dpr;
    if (pixelWidth === this.pixelWidth && pixelHeight === this.pixelHeight) return;
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    if (this.pipeline) this.recreateDepthTexture();
  }

  public render(...args: WorldRenderArguments): void {
    if (this.destroyed || this.failed || !this.telemetry.active) return;
    const frameStarted = performance.now();
    if (this.previousFrameStarted > 0) this.telemetry.frameIntervalMs = frameStarted - this.previousFrameStarted;
    this.previousFrameStarted = frameStarted;
    try {
      const [camera, tileMap, entities, cities, kingdoms, , overlayMode, , , , , ships, caravans, railways, , , , entityIndex] = args;
      const snapshot = this.snapshots.build({
        camera,
        tileMap,
        entities,
        cities,
        kingdoms,
        ships,
        caravans,
        railActive: !!railways && railways.yearlyFreight > 0,
        showGrid: !!this.renderOptions.showGrid,
        overlayMode,
        selection: this.selection,
        entityIndex,
        viewportWidth: this.cssWidth,
        viewportHeight: this.cssHeight,
        devicePixelRatio: this.devicePixelRatio
      });

      this.writeCamera(snapshot.camera);
      let uploadBytes = this.cameraUniformData.byteLength;
      uploadBytes += this.uploadDirtyChunks(snapshot.chunks);
      uploadBytes += this.uploadDynamicPages(snapshot.dynamicPageData);

      const encoder = this.device.createCommandEncoder({ label: 'Aethoria world frame' });
      const pass = encoder.beginRenderPass({
        label: 'Aethoria instanced world pass',
        colorAttachments: [{
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.025, g: 0.075, b: 0.13, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: this.depthTexture!.createView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });
      pass.setPipeline(this.pipeline);
      pass.setVertexBuffer(0, this.quadBuffer);
      pass.setIndexBuffer(this.indexBuffer, 'uint16');
      let drawCalls = 0;
      for (const chunk of snapshot.chunks) {
        const pages = this.chunkBuffers.get(chunk.key);
        if (!pages) continue;
        for (const [page, data] of chunk.pageData) {
          const buffer = pages.get(page);
          if (!buffer || data.byteLength === 0) continue;
          pass.setBindGroup(0, this.bindGroups[page]);
          pass.setVertexBuffer(1, buffer.buffer);
          pass.drawIndexed(6, data.byteLength / INSTANCE_BYTES);
          drawCalls++;
        }
      }
      for (const [page, data] of snapshot.dynamicPageData) {
        const buffer = this.dynamicBuffers.get(page); if (!buffer || data.byteLength === 0) continue;
        pass.setBindGroup(0, this.bindGroups[page]); pass.setVertexBuffer(1, buffer.buffer);
        pass.drawIndexed(6, data.byteLength / INSTANCE_BYTES); drawCalls++;
      }
      pass.end();
      this.device.queue.submit([encoder.finish()]);

      this.telemetry.visibleInstances = snapshot.staticInstances + snapshot.dynamicInstances;
      this.telemetry.drawCalls = drawCalls;
      this.telemetry.bufferUploadBytes = uploadBytes;
      this.telemetry.peakBufferUploadBytes = Math.max(this.telemetry.peakBufferUploadBytes, uploadBytes);
      this.telemetry.renderPreparationMs = snapshot.renderPreparationMs;
      this.telemetry.peakRenderPreparationMs = Math.max(this.telemetry.peakRenderPreparationMs, snapshot.renderPreparationMs);
      this.telemetry.frameSubmissionMs = performance.now() - frameStarted;
      this.telemetry.staticBufferBytes = this.staticBufferBytes();
      this.telemetry.dynamicBufferBytes = this.dynamicBufferBytes();
      this.telemetry.benchmarkInstances = snapshot.benchmarkInstances;
      perfProfiler.setCounter('visibleEntities', snapshot.dynamicInstances);
      perfProfiler.setCounter('approximateDrawCalls', drawCalls);
      this.publishTelemetry();
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.telemetry.active = false;
    this.telemetry.status = 'destroyed';
    this.depthTexture?.destroy();
    this.cameraBuffer?.destroy();
    this.quadBuffer?.destroy();
    this.indexBuffer?.destroy();
    for (const pages of this.chunkBuffers.values()) for (const buffer of pages.values()) buffer.destroy();
    this.chunkBuffers.clear();
    for (const buffer of this.dynamicBuffers.values()) buffer.destroy();
    this.dynamicBuffers.clear();
    this.atlas?.destroy();
    this.context?.unconfigure();
    this.device?.destroy();
    this.publishTelemetry();
  }

  private async initialize(): Promise<void> {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('WebGPU could not acquire an adapter');
    this.adapter = adapter;
    this.device = await adapter.requestDevice({ label: 'Aethoria WebGPU device' });
    const context = this.canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) throw new Error('WebGPU canvas context is unavailable');
    this.context = context;
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.resize(this.cssWidth, this.cssHeight);
    this.context.configure({
      device: this.device,
      format: this.canvasFormat,
      alphaMode: 'opaque'
    });

    this.device.pushErrorScope('validation');
    await this.createPipelineResources();
    const validationError = await this.device.popErrorScope();
    if (validationError) throw validationError;
    this.recreateDepthTexture();

    this.device.addEventListener('uncapturederror', event => {
      console.error('[RENDER-V1D] Uncaptured WebGPU error:', event.error);
      this.fail(event.error);
    });
    void this.device.lost.then(info => {
      if (this.destroyed) return;
      const error = new Error(`WebGPU device lost (${info.reason}): ${info.message}`);
      console.error('[RENDER-V1D]', error);
      this.telemetry.status = 'lost';
      this.fail(error);
    });

    this.telemetry.active = true;
    this.telemetry.status = 'active';
    this.telemetry.atlasBytes = this.atlas.estimatedBytes;
    this.publishTelemetry();
  }

  private async createPipelineResources(): Promise<void> {
    this.cameraBuffer = this.device.createBuffer({
      label: 'Aethoria camera uniform',
      size: 48,
      usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST
    });

    const quadData = new Float32Array([
      0, 0, 0, 0,
      1, 0, 1, 0,
      0, 1, 0, 1,
      1, 1, 1, 1
    ]);
    this.quadBuffer = this.device.createBuffer({
      label: 'Aethoria unit quad vertices',
      size: quadData.byteLength,
      usage: BUFFER_USAGE_VERTEX | BUFFER_USAGE_COPY_DST
    });
    this.device.queue.writeBuffer(this.quadBuffer, 0, quadData);
    const indexData = new Uint16Array([0, 1, 2, 2, 1, 3]);
    this.indexBuffer = this.device.createBuffer({
      label: 'Aethoria unit quad indices',
      size: indexData.byteLength,
      usage: BUFFER_USAGE_INDEX | BUFFER_USAGE_COPY_DST
    });
    this.device.queue.writeBuffer(this.indexBuffer, 0, indexData);
    this.atlas = await createInitialTextureAtlas(this.device);
    this.snapshots = new RenderSnapshotBuilder(this.atlas.regions, this.options.benchmarkInstances);

    const module = this.device.createShaderModule({ label: 'Aethoria sprite shader', code: WEBGPU_WORLD_SHADER });
    this.pipeline = this.device.createRenderPipeline({
      label: 'Aethoria textured instanced quad pipeline',
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vertexMain',
        buffers: [
          {
            arrayStride: 16,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' }
            ]
          },
          {
            arrayStride: INSTANCE_BYTES,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x2' },
              { shaderLocation: 3, offset: 8, format: 'float32x2' },
              { shaderLocation: 4, offset: 16, format: 'float32x2' },
              { shaderLocation: 5, offset: 24, format: 'float32x4' },
              { shaderLocation: 6, offset: 40, format: 'unorm8x4' },
              { shaderLocation: 7, offset: 44, format: 'float32' }
            ]
          }
        ]
      },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.canvasFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          },
          writeMask: COLOR_WRITE_ALL
        }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });

    this.bindGroups = this.atlas.pages.map((page, index) => this.device.createBindGroup({
      label: `Aethoria world bind group page ${index}`,
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: this.atlas.sampler },
        { binding: 2, resource: page.texture.createView() }
      ]
    }));
    this.recreateDepthTexture();
  }

  private recreateDepthTexture(): void {
    if (!this.device || this.pixelWidth <= 0 || this.pixelHeight <= 0) return;
    this.depthTexture?.destroy();
    this.depthTexture = this.device.createTexture({
      label: 'Aethoria world depth',
      size: { width: this.pixelWidth, height: this.pixelHeight },
      format: 'depth24plus',
      usage: TEXTURE_USAGE_RENDER_ATTACHMENT
    });
  }

  private writeCamera(camera: import('./RenderSnapshot').RenderCameraSnapshot): void {
    const values = this.cameraUniformData;
    values[0] = camera.viewportWidth;
    values[1] = camera.viewportHeight;
    values[2] = camera.relativeCameraX;
    values[3] = camera.relativeCameraY;
    values[4] = camera.shakeX;
    values[5] = camera.shakeY;
    values[6] = camera.tileSize;
    values[7] = camera.zoom;
    values[8] = camera.interpolationAlpha;
    values[9] = camera.devicePixelRatio;
    values[10] = camera.worldOriginX;
    values[11] = camera.worldOriginY;
    this.device.queue.writeBuffer(this.cameraBuffer, 0, values);
  }

  /** Upload only changed resident chunk pages; unchanged geometry remains GPU-resident. */
  private uploadDirtyChunks(chunks: readonly import('./RenderSnapshot').RenderChunkSnapshot[]): number {
    let bytes = 0;
    for (const chunk of chunks) {
      let pages = this.chunkBuffers.get(chunk.key);
      if (!pages) { pages = new Map(); this.chunkBuffers.set(chunk.key, pages); }
      for (const [page, data] of chunk.pageData) {
        let buffer = pages.get(page);
        if (!buffer) { buffer = new GpuInstanceBuffer(this.device, `Aethoria chunk ${chunk.key} page ${page}`); pages.set(page, buffer); }
        // Revision is the primary cache key, while byte length is a cheap
        // safety net for a writer that grew after an earlier snapshot. Never
        // issue a draw larger than the range actually uploaded to this GPU
        // buffer.
        if (buffer.revision === chunk.revision && buffer.usedBytes === data.byteLength) continue;
        bytes += buffer.upload(data);
        buffer.revision = chunk.revision;
      }
    }
    return bytes;
  }

  private staticBufferBytes(): number {
    let bytes = 0; for (const pages of this.chunkBuffers.values()) for (const buffer of pages.values()) bytes += buffer.capacityBytes; return bytes;
  }

  private uploadDynamicPages(pages: ReadonlyMap<number, Uint8Array>): number {
    let bytes = 0;
    for (const [page, data] of pages) {
      let buffer = this.dynamicBuffers.get(page);
      if (!buffer) { buffer = new GpuInstanceBuffer(this.device, `Aethoria dynamic page ${page}`); this.dynamicBuffers.set(page, buffer); }
      bytes += buffer.upload(data);
    }
    return bytes;
  }

  private dynamicBufferBytes(): number { let bytes = 0; for (const buffer of this.dynamicBuffers.values()) bytes += buffer.capacityBytes; return bytes; }

  private fail(error: unknown): void {
    if (this.failed || this.destroyed) return;
    this.failed = true;
    this.telemetry.active = false;
    this.telemetry.status = 'lost';
    this.telemetry.message = describeGpuError(error);
    this.publishTelemetry();
    this.options.onFatalError(error);
  }

  private publishTelemetry(): void {
    if (typeof window !== 'undefined') {
      const snapshot = { ...this.telemetry };
      window.__AETHORIA_RENDER__ = snapshot;
      window.__AETHORIA_RENDER_V1A__ = snapshot;
    }
  }
}

export const WEBGPU_WORLD_SHADER = /* wgsl */ `
struct CameraUniform {
  viewport: vec2f,
  cameraPixels: vec2f,
  shake: vec2f,
  tileSize: f32,
  zoom: f32,
  interpolationAlpha: f32,
  devicePixelRatio: f32,
  worldOriginTiles: vec2f,
}

@group(0) @binding(0) var<uniform> camera: CameraUniform;
@group(0) @binding(1) var atlasSampler: sampler;
@group(0) @binding(2) var atlasTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) quadPosition: vec2f,
  @location(1) quadUv: vec2f,
  @location(2) previousPosition: vec2f,
  @location(3) currentPosition: vec2f,
  @location(4) size: vec2f,
  @location(5) uvRegion: vec4f,
  @location(6) tint: vec4f,
  @location(7) layer: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) tint: vec4f,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  let worldTile = mix(input.previousPosition, input.currentPosition, camera.interpolationAlpha);
  let absoluteCameraPixels = camera.cameraPixels + camera.worldOriginTiles * camera.tileSize;
  let unsnappedOrigin = (worldTile * camera.tileSize - absoluteCameraPixels) * camera.zoom
    + camera.viewport * 0.5 + camera.shake;
  let dpr = max(1.0, camera.devicePixelRatio);
  let origin = round(unsnappedOrigin * dpr) / dpr;
  let unsnappedFar = unsnappedOrigin + input.size * camera.tileSize * camera.zoom;
  let far = round(unsnappedFar * dpr) / dpr;
  let pixel = origin + input.quadPosition * (far - origin);
  let ndc = vec2f(
    pixel.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - pixel.y / camera.viewport.y * 2.0
  );

  var output: VertexOutput;
  output.position = vec4f(ndc, input.layer, 1.0);
  output.uv = mix(input.uvRegion.xy, input.uvRegion.zw, input.quadUv);
  output.tint = input.tint;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let sampled = textureSample(atlasTexture, atlasSampler, input.uv);
  if (sampled.a < 0.01) { discard; }
  return sampled * input.tint;
}
`;

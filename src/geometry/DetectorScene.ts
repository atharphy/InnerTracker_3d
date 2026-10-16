import {halfAnnulusGeometry} from './halfAnnulusGeometry';
import {buildPortcardInventory, InstalledPortcard} from '../data/portcards';
import {connectionRoutes} from './connectionRoutes';
import {electricalServices,disposeElectrical,ElectricalPart} from './electricalServices';
import {moduleMatrix,moduleFaceMatrix} from './connectionAnchors';
import {tbpxAssembly,BarrelAssemblyPart} from './tbpxAssembly';
import {captureModuleInstances,filterModuleInstances,ModuleInstances} from './moduleInstanceFilter';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CameraMode,
  HoveredModule,
  InnerTracker3DOptions,
  ModuleDescriptor,
  ModuleMeasurement,
  VisibilityState,
} from '../types';
import { measurementColor } from '../data/measurements';
import { mm } from './config';
import { outerServices } from './outerServices';
import { deeVisible, moduleDee, moduleVisible, partVisible } from './visibility';
import { COMPONENT_PHOTOS, photoMaterial, serviceHardware } from './componentPhotos';
import { modulePhotoKind } from './componentLayout';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface ElementMesh {
  mesh: THREE.InstancedMesh;
  statusColors: THREE.InstancedBufferAttribute;
  statusPresent: THREE.InstancedBufferAttribute;
  modules: ModuleDescriptor[];
  chipIndices: number[];
  matrices: THREE.Matrix4[];
  visibilityKey: string;
  sectionKey: string;
}

interface SupportMesh {
  dee?: number;
  mesh: THREE.Mesh;
  visibilityKey: string;
  sectionKey: string;
}

interface DividerMesh {
  dee?:number;
  mesh: THREE.LineSegments;
  visibilityKey: string;
  sectionKey: string;
}

interface AuxiliaryMesh {
  mesh: THREE.Object3D;
  visibilityKey?: string;
  sectionKey?: string;
}

interface BoardTextures {
  color: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

interface DetectorSceneCallbacks {
  onHover: (hovered?: HoveredModule) => void;
  onSelect: (
    module: ModuleDescriptor,
    chipIndex: number,
    measurement?: ModuleMeasurement
  ) => void;
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function setStatusColor(
  attribute: THREE.InstancedBufferAttribute,
  index: number,
  value: string
): void {
  new THREE.Color(value).toArray(attribute.array, index * 3);
}

/**
 * Lit status material with directional lighting, ambient shading, and specular highlights.
 * Preserves live monitoring color fidelity while giving modules physical 3D depth and shape.
 */
function statusMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { photoMode: { value: 0 } },
    vertexShader: `
      uniform float photoMode;
      attribute vec3 statusColor;
      attribute float statusPresent;
      varying float vPresent;
      varying vec2 vUv;
      varying vec3 vStatusColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vStatusColor = statusColor;
        vPresent = statusPresent; vUv = uv;
        mat3 normalMat = mat3(modelViewMatrix * instanceMatrix);
        vNormal = normalize(normalMat * normal);
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position * (photoMode > 0.5 ? 1.18 : 1.0), 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float photoMode;
      varying float vPresent;
      varying vec2 vUv;
      varying vec3 vStatusColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        if (photoMode > 0.5 && (vPresent < 0.5 || (min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y)) > 0.07))) discard;
        vec3 normal = normalize(vNormal);
        vec3 lightDir1 = normalize(vec3(0.45, 0.75, 0.65));
        vec3 lightDir2 = normalize(vec3(-0.6, -0.3, -0.5));
        float diff1 = max(dot(normal, lightDir1), 0.0);
        float diff2 = max(dot(normal, lightDir2), 0.0) * 0.35;
        vec3 viewDir = normalize(vViewPosition);
        vec3 halfDir = normalize(lightDir1 + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), 22.0) * 0.32;

        vec3 litColor = vStatusColor * (0.52 + 0.48 * diff1 + diff2) + vec3(spec);
        gl_FragColor = vec4(litColor, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function rectangularCell(
  xMin: number,
  xMax: number,
  zMin: number,
  zMax: number
): THREE.BoxGeometry {
  const width = xMax - xMin;
  const depth = zMax - zMin;
  const geometry = new THREE.BoxGeometry(width, 1, depth);
  geometry.translate((xMin + xMax) / 2, 0, (zMin + zMax) / 2);
  return geometry;
}

function rectangularPrismXY(
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
): THREE.BoxGeometry {
  const width = xMax - xMin;
  const height = yMax - yMin;
  const geometry = new THREE.BoxGeometry(width, height, 1);
  geometry.translate((xMin + xMax) / 2, (yMin + yMax) / 2, 0);
  return geometry;
}

// TBPX barrel chip geometries (aligned along local X/Z with Y as radial thickness)
const BARREL_DOUBLE_CELLS = [
  rectangularCell(-0.48, 0.48, -0.48, -0.01),
  rectangularCell(-0.48, 0.48, 0.01, 0.48),
];
const BARREL_QUAD_CELLS = [
  rectangularCell(-0.48, -0.01, -0.48, -0.01),
  rectangularCell(0.01, 0.48, -0.48, -0.01),
  rectangularCell(-0.48, -0.01, 0.01, 0.48),
  rectangularCell(0.01, 0.48, 0.01, 0.48),
];

// Physical rectangular chip geometries for disk modules (aligned along local X/Y with Z as thickness)
const DISK_DOUBLE_CELLS = [
  rectangularPrismXY(-0.48, 0.48, -0.48, -0.01),
  rectangularPrismXY(-0.48, 0.48, 0.01, 0.48),
];
const DISK_QUAD_CELLS = [
  rectangularPrismXY(-0.48, -0.01, -0.48, -0.01),
  rectangularPrismXY(0.01, 0.48, -0.48, -0.01),
  rectangularPrismXY(-0.48, -0.01, 0.01, 0.48),
  rectangularPrismXY(0.01, 0.48, 0.01, 0.48),
];

function chipGeometries(module: ModuleDescriptor): THREE.BufferGeometry[] {
  if (module.subdetector === 'TBPX') {
    return module.moduleType === 'double' ? BARREL_DOUBLE_CELLS : BARREL_QUAD_CELLS;
  }
  return module.moduleType === 'double' ? DISK_DOUBLE_CELLS : DISK_QUAD_CELLS;
}

function chipDividerSegments(module: ModuleDescriptor): THREE.Vector3[] {
  const segments: THREE.Vector3[] = [];
  const add = (a: THREE.Vector3, b: THREE.Vector3): void => {
    segments.push(a, b);
  };

  if (module.subdetector === 'TBPX') {
    for (const y of [-0.501, 0.501]) {
      add(new THREE.Vector3(-0.48, y, 0), new THREE.Vector3(0.48, y, 0));
      if (module.moduleType === 'quad') {
        add(new THREE.Vector3(0, y, -0.48), new THREE.Vector3(0, y, 0.48));
      }
      // Perimeter lines
      add(new THREE.Vector3(-0.48, y, -0.48), new THREE.Vector3(0.48, y, -0.48));
      add(new THREE.Vector3(0.48, y, -0.48), new THREE.Vector3(0.48, y, 0.48));
      add(new THREE.Vector3(0.48, y, 0.48), new THREE.Vector3(-0.48, y, 0.48));
      add(new THREE.Vector3(-0.48, y, 0.48), new THREE.Vector3(-0.48, y, -0.48));
    }
    return segments;
  }

  // Disk rectangular modules: divider lines along local X/Y on both front/back faces
  for (const z of [-0.501, 0.501]) {
    add(new THREE.Vector3(-0.48, 0, z), new THREE.Vector3(0.48, 0, z));
    if (module.moduleType === 'quad') {
      add(new THREE.Vector3(0, -0.48, z), new THREE.Vector3(0, 0.48, z));
    }
    // Perimeter outline
    add(new THREE.Vector3(-0.48, -0.48, z), new THREE.Vector3(0.48, -0.48, z));
    add(new THREE.Vector3(0.48, -0.48, z), new THREE.Vector3(0.48, 0.48, z));
    add(new THREE.Vector3(0.48, 0.48, z), new THREE.Vector3(-0.48, 0.48, z));
    add(new THREE.Vector3(-0.48, 0.48, z), new THREE.Vector3(-0.48, -0.48, z));
  }
  return segments;
}

/**
 * Distinctive white rectangular Airex reinforcement frame for TEPX 2x2 modules.
 */
function airexFrameGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = 0.52;
  const h = 0.52;
  shape.moveTo(-w, -h);
  shape.lineTo(w, -h);
  shape.lineTo(w, h);
  shape.lineTo(-w, h);
  shape.closePath();

  const hole = new THREE.Path();
  const iw = 0.485;
  const ih = 0.485;
  hole.moveTo(-iw, -ih);
  hole.lineTo(-iw, ih);
  hole.lineTo(iw, ih);
  hole.lineTo(iw, -ih);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, 0.5);
  return geometry;
}

/**
 * Aluminum Nitride (AlN) cooling baseplate for TBPX modules with mounting tabs.
 */
function alnCoolingPlateGeometry(isQuad: boolean): THREE.BufferGeometry {
  const width = 1.08;
  const depth = isQuad ? 1.06 : 0.56;
  const geometry = new THREE.BoxGeometry(width, 0.1, depth);
  geometry.translate(0, -0.55, 0);
  return geometry;
}

function carbonFiberTextures(): BoardTextures {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughnessCanvas = document.createElement('canvas');
  [colorCanvas, bumpCanvas, roughnessCanvas].forEach((canvas) => {
    canvas.width = size;
    canvas.height = size;
  });
  const color = colorCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');
  const roughness = roughnessCanvas.getContext('2d');
  if (!color || !bump || !roughness) {
    return {
      color: new THREE.CanvasTexture(colorCanvas),
      bump: new THREE.CanvasTexture(bumpCanvas),
      roughness: new THREE.CanvasTexture(roughnessCanvas),
    };
  }

  color.fillStyle = '#14171a';
  color.fillRect(0, 0, size, size);
  bump.fillStyle = '#808080';
  bump.fillRect(0, 0, size, size);
  roughness.fillStyle = '#555555';
  roughness.fillRect(0, 0, size, size);

  const cellSize = 16;
  for (let y = 0; y < size; y += cellSize) {
    for (let x = 0; x < size; x += cellSize) {
      const isAlt = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
      color.fillStyle = isAlt ? '#59616a' : '#555d66';
      color.fillRect(x, y, cellSize, cellSize);

      color.fillStyle = isAlt ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.025)';
      for (let i = 2; i < cellSize; i += 4) {
        if (isAlt) {
          color.fillRect(x + i, y, 2, cellSize);
        } else {
          color.fillRect(x, y + i, cellSize, 2);
        }
      }

      bump.fillStyle = isAlt ? '#909090' : '#707070';
      bump.fillRect(x, y, cellSize, cellSize);
      roughness.fillStyle = isAlt ? '#484848' : '#626262';
      roughness.fillRect(x, y, cellSize, cellSize);
    }
  }

  const makeTexture = (canvas: HTMLCanvasElement, srgb = false): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(canvas);
    if (srgb) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
  };

  return {
    color: makeTexture(colorCanvas, true),
    bump: makeTexture(bumpCanvas),
    roughness: makeTexture(roughnessCanvas),
  };
}

function circuitBoardTextures(): BoardTextures {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughnessCanvas = document.createElement('canvas');
  [colorCanvas, bumpCanvas, roughnessCanvas].forEach((canvas) => {
    canvas.width = size;
    canvas.height = size;
  });
  const color = colorCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');
  const roughness = roughnessCanvas.getContext('2d');
  if (!color || !bump || !roughness) {
    return {
      color: new THREE.CanvasTexture(colorCanvas),
      bump: new THREE.CanvasTexture(bumpCanvas),
      roughness: new THREE.CanvasTexture(roughnessCanvas),
    };
  }

  color.fillStyle = '#144634';
  color.fillRect(0, 0, size, size);
  const maskGradient = color.createRadialGradient(512, 512, 120, 512, 512, 700);
  maskGradient.addColorStop(0, 'rgba(64, 140, 102, 0.2)');
  maskGradient.addColorStop(1, 'rgba(4, 30, 22, 0.22)');
  color.fillStyle = maskGradient;
  color.fillRect(0, 0, size, size);

  bump.fillStyle = '#606060';
  bump.fillRect(0, 0, size, size);
  roughness.fillStyle = '#b5b5b5';
  roughness.fillRect(0, 0, size, size);

  // Wire bond pad rows and micro-vias
  for (let x = 60; x < size - 60; x += 18) {
    color.fillStyle = '#d4b256';
    color.fillRect(x, 40, 10, 24);
    color.fillRect(x, size - 64, 10, 24);
    bump.fillStyle = '#e8e8e8';
    bump.fillRect(x, 40, 10, 24);
    bump.fillRect(x, size - 64, 10, 24);
  }

  // Laser silkscreen markings
  color.fillStyle = 'rgba(235, 242, 238, 0.75)';
  color.font = 'bold 20px sans-serif';
  color.fillText('CMS IT PHASE-2  •  CROC 65nm', 50, 990);

  const makeTexture = (canvas: HTMLCanvasElement, srgb = false): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(canvas);
    if (srgb) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
  };

  return {
    color: makeTexture(colorCanvas, true),
    bump: makeTexture(bumpCanvas),
    roughness: makeTexture(roughnessCanvas),
  };
}

function supportTextureWindow(
  geometry: THREE.BufferGeometry,
  key: string
): void {
  const uv = geometry.getAttribute('uv');
  if (!(uv instanceof THREE.BufferAttribute)) {
    return;
  }
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const sampleWidth = 0.7 + ((hash >>> 8) & 0xff) / 255 * 0.12;
  const sampleHeight = 0.7 + ((hash >>> 16) & 0xff) / 255 * 0.12;
  const offsetX = (hash & 0xff) / 255 * (1 - sampleWidth);
  const offsetY = ((hash >>> 24) & 0xff) / 255 * (1 - sampleHeight);
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(
      index,
      offsetX + uv.getX(index) * sampleWidth,
      offsetY + uv.getY(index) * sampleHeight
    );
  }
  uv.needsUpdate = true;
}

function studioBackgroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(460, 390, 40, 512, 512, 760);
    gradient.addColorStop(0, '#f7f9fc');
    gradient.addColorStop(0.52, '#e7edf4');
    gradient.addColorStop(1, '#cfd9e4');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}


function visible(element: string, section: string, state: VisibilityState): boolean {
  return partVisible(state, element, section);
}

const matrixFor = moduleMatrix;

export class DetectorScene {
  private readonly container: HTMLDivElement;
  private readonly modules: ModuleDescriptor[];
  private readonly callbacks: DetectorSceneCallbacks;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly boardTextures: BoardTextures;
  private readonly carbonFiberTextures: BoardTextures;
  private readonly backgroundTexture: THREE.CanvasTexture;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly elements = new Map<string, ElementMesh>();
  private readonly supports: SupportMesh[] = [];
  private readonly dividers: DividerMesh[] = [];
  private readonly beamPipe = new THREE.Group();
  private readonly outline: THREE.LineSegments;
  private readonly resizeObserver: ResizeObserver;
  private readonly serviceCylinderGroup = new THREE.Group();
  private currentVisibility?: VisibilityState;
  private installedIds=new Set<string>();
  private readonly moduleInstances: ModuleInstances[]=[];
  private componentVisibility = { tbpxPortcards: true, tepxPortcards: true, cartridges: true, rails: true, mechanics: true, installedOnly: false, connectedPortcardsOnly: false, electrical: true, tbpxCables: true, exterior: true, cylinderLeft: true, axisX: true, axisY: true, axisZ: true };
  private readonly photos: AuxiliaryMesh[] = [];
  private readonly hardware = serviceHardware();
  private portcardBatches: ModuleInstances[] = [];
  private portcards: InstalledPortcard[] = [];
  private electricalParts: ElectricalPart[] = [];
  private portcardMappingKey = '';

  private readonly exteriorServices = outerServices();
  private readonly servicesGroup = new THREE.Group();
  private readonly tbpxMechanicsGroup = new THREE.Group();
  private readonly tbpxServiceParts: BarrelAssemblyPart[]=[];
  private readonly tbpxServicesGroup=new THREE.Group();
  private readonly tepxTraysGroup = new THREE.Group();
  private readonly subdetectorFeaturesGroup = new THREE.Group();
  private readonly subdetectorFeatures: AuxiliaryMesh[] = [];
  private readonly tbpxLayerMechanics: Array<{ layer: number; group: THREE.Group }> = [];
  private options: InnerTracker3DOptions;
  private measurements = new Map<string, ModuleMeasurement>();
  private animationFrame = 0;
  private pointerDown?: { x: number; y: number };
  private hoveredId?: string;

  constructor(
    container: HTMLDivElement,
    modules: ModuleDescriptor[],
    options: InnerTracker3DOptions,
    callbacks: DetectorSceneCallbacks
  ) {
    this.container = container;
    this.modules = modules;
    this.options = options;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = false;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 1.3;
    room.dispose();
    pmrem.dispose();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.backgroundTexture = studioBackgroundTexture();
    this.scene.background = this.backgroundTexture;
    this.boardTextures = circuitBoardTextures();
    this.carbonFiberTextures = carbonFiberTextures();
    const anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    Object.values(this.boardTextures).forEach((texture) => {
      texture.anisotropy = anisotropy;
    });
    Object.values(this.carbonFiberTextures).forEach((texture) => {
      texture.anisotropy = anisotropy;
    });
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 40;
    this.controls.target.set(0, 0, 0);

    const outlineGeometry = new THREE.EdgesGeometry(UNIT_BOX);
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: options.selectedColor,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    this.outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    this.outline.renderOrder = 100;
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.addLighting();
    this.addSupportStructures();
    this.addTbpxMechanics();
    this.addTepxBridgeTrays();
    this.addDetectorMeshes();
    this.addModulePhotos();
    this.scene.add(this.hardware.portcards, this.hardware.antlers, this.hardware.rails);
    this.hardware.portcards.traverse(o=>{if(o instanceof THREE.InstancedMesh){this.portcardBatches.push(captureModuleInstances(o,o.userData.slotIds));}});

    this.addSubdetectorFeatures();
    this.addChipDividers();
    this.addServiceCylinder();
    this.addAuxiliaryServices();
    this.addBeamPipe();
    this.addBeamAxis();
    this.updateOptions(options);
    this.resetCamera();

    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
  }

  private addLighting(): void {
    this.scene.add(new THREE.HemisphereLight(0xf8fbff, 0x607080, 1.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xfff9ef, 2.75);
    key.position.set(4.5, 6.5, 7.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 28;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.00015;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdcecff, 1.35);
    fill.position.set(-6, 2.0, -4.5);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xbad5e8, 1.1);
    rim.position.set(-2.5, 5.5, -7);
    this.scene.add(rim);
    const lowerFill = new THREE.PointLight(0xffffff, 0.75, 20, 2);
    lowerFill.position.set(0, -5, 2);
    this.scene.add(lowerFill);
  }

  private carbonFiberMaterial(opacity = 1.0, transparent = false): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: 0x85919d,
      map: this.carbonFiberTextures.color,
      bumpMap: this.carbonFiberTextures.bump,
      bumpScale: 0.0004,

      metalness: 0.15,
      roughness: 0.85,
      clearcoat: 0.08,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
      transparent,
      opacity,
      depthWrite: !transparent,
    });
  }

  private coolingCopperMaterial(): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({color:0xb87333,metalness:.78,roughness:.3,clearcoat:.15});
  }

  private titaniumMaterial(): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: 0xb5bec7,
      metalness: 0.65,
      roughness: 0.25,
      clearcoat: 0.22,
      clearcoatRoughness: 0.2,
    });
  }

  private airexMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0xf2f3ee,
      roughness: 0.85,
      metalness: 0.05,
    });
  }

  private alnMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0xcbd0d6,
      roughness: 0.45,
      metalness: 0.25,
    });
  }

  /**
   * Adds carbon-fiber Dee support plates with circular beam-pipe cutouts and perimeter frames.
   */
  private addSupportStructures(): void {
    const sections = new Map<string, ModuleDescriptor[]>();
    for (const module of this.modules) {
      if (module.subdetector === 'TBPX') { continue; }
      const key = `${module.visibilityKey}|${module.sectionKey}|${module.supportZ}`;
      sections.set(key, [...(sections.get(key) ?? []), module]);
    }
    for (const [key, modules] of sections) {
      const [visibilityKey, sectionKey] = key.split('|');
      const first = modules[0];
      const tfpx = first.subdetector === 'TFPX';
      // Each double disk has two carbon/foam sandwich dees per spatial half.
      const all = this.modules.filter(m => m.visibilityKey === visibilityKey && m.sectionKey === sectionKey);
      const inner = Math.min(...all.map(m => Math.hypot(m.position[0], m.position[1]) - m.size[1] / 2)) - mm(2);
      const outer = Math.max(...all.map(m => Math.hypot(m.position[0], m.position[1]) + m.size[1] / 2)) + mm(4);
      const start = sectionKey.endsWith(':upper') ? -Math.PI / 2 : Math.PI / 2;
      const z = first.supportZ ?? first.diskCenterZ ?? first.position[2];
      const add = (mesh: THREE.Mesh) => {
        mesh.position.z += z;
        this.supports.push({ mesh, visibilityKey, sectionKey, dee: moduleDee(first) });
        this.scene.add(mesh);
      };
      const plate = new THREE.Mesh(halfAnnulusGeometry(inner, outer, start, mm(tfpx ? 2.8 : 1.2)), this.carbonFiberMaterial());
      supportTextureWindow(plate.geometry, key);
      add(plate);
      if (!tfpx) {
        const k9 = new THREE.Mesh(halfAnnulusGeometry(inner+mm(1),outer-mm(1),start,mm(.08)),new THREE.MeshStandardMaterial({color:0xb6aa54,roughness:.8,side:THREE.DoubleSide}));
        k9.position.z=mm(.65);add(k9);
      }
      const edge = new THREE.Mesh(halfAnnulusGeometry(outer, outer + mm(1.8), start, mm(4)), this.titaniumMaterial());
      add(edge);
      // Exposed power flex / disk PCB annuli on each face. Module surfaces sit
      // clear of these layers; cooling follows the actual ring radii.
      for (const face of [-1, 1]) {
        const skin = new THREE.Mesh(halfAnnulusGeometry(inner, outer, start, mm(.2)), new THREE.MeshStandardMaterial({color:tfpx ? 0x75433f : 0x3b4649,roughness:.85,side:THREE.DoubleSide}));
        skin.position.z=face*mm(tfpx?1.5:.7); add(skin);
        const cover = new THREE.Mesh(halfAnnulusGeometry(inner+mm(1),outer-mm(1),start,mm(.12),modules.filter(m => (m.position[2]>z ? 1 : -1)===face)),this.carbonFiberMaterial());
        cover.position.z=face*mm(tfpx?2.02:1.18);add(cover);
        for (const ring of [...new Set(modules.map(m => m.ring))]) {
          const m=modules.find(m => m.ring===ring)!;
          const r=Math.hypot(m.position[0],m.position[1]);
          const flex=new THREE.Mesh(halfAnnulusGeometry(r-mm(2),r+mm(2),start,mm(.15)),new THREE.MeshStandardMaterial({color:tfpx?0x497c3e:0x25824a,roughness:.8,side:THREE.DoubleSide}));
          flex.position.z=face*mm(tfpx?2.12:1.28);add(flex);
        }
      }
      // Continuous embedded evaporator follows ring footprints and turns at the
      // half-disk boundary. Fittings connect its inlet/return to the outer envelope.
      const radii=[...new Set(modules.map(m=>m.ring))].map(ring=>{const m=modules.find(m=>m.ring===ring)!;return Math.hypot(m.position[0],m.position[1]);}).sort((a,b)=>a-b);
      const points:THREE.Vector3[]=[];
      radii.forEach((r,index)=>{
        for(let step=0;step<=48;step++){const t=index%2?1-step/48:step/48,a=start+.035+(Math.PI-.07)*t;points.push(new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),0));}
      });
      if(points.length){
        const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,false,'centripetal'),Math.max(96,radii.length*64),mm(.65),8,false),this.coolingCopperMaterial());add(tube);
        for(const endpoint of [points[0],points[points.length-1]]){
          const a=Math.atan2(endpoint.y,endpoint.x),outside=new THREE.Vector3((outer+mm(6))*Math.cos(a),(outer+mm(6))*Math.sin(a),mm(5));
          const riser=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([endpoint,endpoint.clone().multiplyScalar(1.02),outside]),24,mm(.65),8,false),this.coolingCopperMaterial());add(riser);
          const fitting=new THREE.Mesh(new THREE.CylinderGeometry(mm(1.3),mm(1.3),mm(3.5),8),this.coolingCopperMaterial());
          fitting.position.copy(outside);fitting.rotation.x=Math.PI/2;add(fitting);
        }
      }
    }
  }

  /**
   * TBPX ladder mechanics: carbon-fiber sheets, carbon-foam ribs, stainless cooling loops,
   * and circular end bulkhead rings per layer.
   */
  private addTbpxMechanics(): void {
    const assembly=tbpxAssembly(this.modules,this.carbonFiberMaterial());
    assembly.mechanics.forEach(part=>{this.subdetectorFeatures.push(part);this.tbpxMechanicsGroup.add(part.mesh);});
    assembly.services.forEach(part=>{this.tbpxServiceParts.push(part);this.tbpxServicesGroup.add(part.mesh);});
    this.scene.add(this.tbpxMechanicsGroup,this.tbpxServicesGroup);
  }

  /**
   * TEPX longitudinal bridge service trays connecting the 4 disks (TEPX octant box).
   */
  private addTepxBridgeTrays(): void {
    for (const side of [-1, 1]) {
      const modules = this.modules.filter(m => m.subdetector === 'TEPX' && Math.sign(m.position[2]) === side);
      const zs = modules.map(m => m.position[2]);
      const lo = Math.min(...zs) - mm(15);
      const hi = Math.max(...zs) + mm(15);
      for (const theta of [Math.PI / 2, -Math.PI / 2]) {
        const tray = new THREE.Mesh(new THREE.BoxGeometry(mm(32), mm(3), hi - lo), this.carbonFiberMaterial());
        tray.position.set(0, Math.sin(theta) * mm(258), (hi + lo) / 2);
        this.tepxTraysGroup.add(tray);
      }
    }
    this.scene.add(this.tepxTraysGroup);
  }

  private addModulePhotos(): void {
    const groups = new Map<string, ModuleDescriptor[]>();
    this.modules.forEach(m => { const key = `${modulePhotoKind(m)}|${m.visibilityKey}|${m.sectionKey}`; groups.set(key, [...(groups.get(key) ?? []), m]); });
    const materials = Object.fromEntries(Object.entries(COMPONENT_PHOTOS).map(([k,url]) => {
      const material=photoMaterial(url);
      // The HDI image belongs only to the exposed component face, not its back.
      material.side=THREE.FrontSide;
      return [k,material];
    }));
    for (const [key, modules] of groups) {
      const [kind, visibilityKey, sectionKey] = key.split('|');
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), materials[kind], modules.length);
      modules.forEach((m,i) => {
        mesh.setMatrixAt(i,moduleFaceMatrix(m));
      });
      this.moduleInstances.push(captureModuleInstances(mesh,modules.map(m=>m.id)));
      this.photos.push({mesh,visibilityKey,sectionKey}); this.scene.add(mesh);
    }
  }

  private addDetectorMeshes(): void {
    const grouped = new Map<string, Array<{ module: ModuleDescriptor; chipIndex: number }>>();
    for (const module of this.modules) {
      chipGeometries(module).forEach((_geometry, chipIndex) => {
        const key = `${module.visibilityKey}|${module.sectionKey}`;
        const existing = grouped.get(key) ?? [];
        existing.push({ module, chipIndex });
        grouped.set(key, existing);
      });
    }

    for (const [key, cells] of grouped) {
      const [visibilityKey, sectionKey] = key.split('|');
      const elementModules = cells.map((cell) => cell.module);
      const chipIndices = cells.map((cell) => cell.chipIndex);

      const material = statusMaterial();
      const moduleGeometry = UNIT_BOX.clone();
      const statusColors = new THREE.InstancedBufferAttribute(
        new Float32Array(elementModules.length * 3),
        3
      );
      statusColors.setUsage(THREE.DynamicDrawUsage);
      moduleGeometry.setAttribute('statusColor', statusColors);
      const statusPresent = new THREE.InstancedBufferAttribute(new Float32Array(elementModules.length), 1);
      moduleGeometry.setAttribute('statusPresent', statusPresent);
      const mesh = new THREE.InstancedMesh(moduleGeometry, material, elementModules.length);
      mesh.name = key;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const matrices = elementModules.map(matrixFor);

      matrices.forEach((matrix, index) => {
        const cell = chipGeometries(elementModules[index])[chipIndices[index]];
        cell.computeBoundingBox();
        const box = cell.boundingBox!;
        const transform = new THREE.Matrix4().compose(box.getCenter(new THREE.Vector3()), new THREE.Quaternion(), box.getSize(new THREE.Vector3()));
        mesh.setMatrixAt(index, matrix.clone().multiply(transform));
        setStatusColor(statusColors, index, this.options.noDataColor);
      });
      statusColors.needsUpdate = true;

      mesh.renderOrder = 2;
      mesh.castShadow = true;
      this.moduleInstances.push(captureModuleInstances(mesh,elementModules.map(m=>m.id)));
      this.elements.set(key, {
        mesh,
        statusColors,
        statusPresent,
        modules: elementModules,
        chipIndices,
        matrices,
        visibilityKey,
        sectionKey,
      });
      this.scene.add(mesh);
    }
  }

  /**
   * Subdetector-specific physical hardware features:
   * 1. White rectangular Airex foam frames on TEPX 2x2 modules.
   * 2. Aluminum Nitride (AlN) cooling plates under TBPX modules.
   */
  private addSubdetectorFeatures(): void {
    const groups = new Map<string, ModuleDescriptor[]>();
    for (const module of this.modules) {
      const key = `${module.visibilityKey}|${module.sectionKey}`;
      groups.set(key, [...(groups.get(key) ?? []), module]);
    }
    for (const [key, modules] of groups) {
      const [visibilityKey, sectionKey] = key.split('|');
      const barrel = modules[0].subdetector === 'TBPX';
      const geometry = barrel ? alnCoolingPlateGeometry(modules[0].moduleType === 'quad') : UNIT_BOX.clone();
      const mat = barrel ? this.alnMaterial() : new THREE.MeshStandardMaterial({ color: 0x327255, roughness: 0.72 });
      const board = new THREE.InstancedMesh(geometry, mat, modules.length);
      modules.forEach((module, i) => {
        const descriptor: ModuleDescriptor = { ...module, size: [...module.size] };
        if (!barrel) { descriptor.size = [module.size[0] * 1.06, module.size[1] * 1.06, module.size[2] * 0.7]; }
        board.setMatrixAt(i, matrixFor(descriptor));
      });
      this.moduleInstances.push(captureModuleInstances(board,modules.map(m=>m.id)));
      this.subdetectorFeaturesGroup.add(board);
      this.subdetectorFeatures.push({ mesh: board, visibilityKey, sectionKey });
      if (modules[0].subdetector === 'TEPX') {
        const frames = new THREE.InstancedMesh(airexFrameGeometry(), this.airexMaterial(), modules.length);
        modules.forEach((m, i) => frames.setMatrixAt(i, matrixFor(m)));
        this.moduleInstances.push(captureModuleInstances(frames,modules.map(m=>m.id)));
        this.subdetectorFeaturesGroup.add(frames);
        this.subdetectorFeatures.push({ mesh: frames, visibilityKey, sectionKey });
      }
    }
    this.scene.add(this.subdetectorFeaturesGroup);
  }

  private addChipDividers(): void {
    const sections = new Map<string, THREE.Vector3[]>();
    for (const module of this.modules) {
      const matrix = matrixFor(module);
      const transformed = chipDividerSegments(module)
        .map((point) => point.clone().applyMatrix4(matrix));
      const key = `${module.visibilityKey}|${module.sectionKey}|${moduleDee(module)??"barrel"}`;
      const points = sections.get(key) ?? [];
      points.push(...transformed);
      sections.set(key, points);
    }

    for (const [key, points] of sections) {
      const [visibilityKey, sectionKey, deeKey] = key.split('|');
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x465a70,
        transparent: true,
        opacity: 0.38,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.LineSegments(geometry, material);
      mesh.renderOrder = 4;
      this.dividers.push({ mesh, visibilityKey, sectionKey, dee:deeKey==='barrel'?undefined:Number(deeKey) });
      this.scene.add(mesh);
    }
  }

  /**
   * The IT Service Cylinder:
   * Central TBPX cutaway window frame, forward cylinders enclosing TFPX,
   * conical transition adapters, TEPX outer shell, and PP-2 flanges.
   */
  private addServiceCylinder(): void {
    this.rebuildServiceCylinder();
    this.serviceCylinderGroup.visible = this.options.showServiceCylinder;
    this.scene.add(this.serviceCylinderGroup);
  }

  private rebuildServiceCylinder(): void {
    const materials = new Set<THREE.Material>();
    this.serviceCylinderGroup.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); }
    });
    materials.forEach(m => m.dispose());
    this.serviceCylinderGroup.clear();
    for (const half of [-1,1]) {
    const halfGroup=new THREE.Group(); halfGroup.userData.nearHalf=half===1; this.serviceCylinderGroup.add(halfGroup);
    halfGroup.visible=half===1 ? !this.options.serviceCylinderCutaway : this.componentVisibility.cylinderLeft;
    // Keep the far/lower half in cutaway mode. CylinderGeometry's local Y
    // axis rotates onto Z; this angle leaves the +X/+Y camera side open.
    const start = half===1 ? 0 : Math.PI;
    const arc = Math.PI;
    const material = this.carbonFiberMaterial();
    const shell = (z0: number, z1: number, r0: number, r1: number) => {
      const geometry = new THREE.CylinderGeometry(r1, r0, z1 - z0, 64, 1, true, start, arc);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.z = (z0 + z1) / 2;
      halfGroup.add(mesh);
    };
    // Service envelope dimensions are illustrative clearances, not survey CAD.
    for (const side of [-1, 1]) {
      const sections = [[0, 215, 167, 167], [0, 215, 162, 162], [215, 220, 176, 190], [220, 1450, 190, 190], [1450, 1660, 190, 275], [1660, 2730, 275, 275]];
      for (const [a, b, ra, rb] of sections) {
        if (side > 0) { shell(mm(a), mm(b), mm(ra), mm(rb)); }
        else { shell(mm(-b), mm(-a), mm(rb), mm(ra)); }
      }
      // Basti p.19: CF skins around an Airex core, inner/outer radii 162/167 mm.
      const core=new THREE.Mesh(halfAnnulusGeometry(mm(162.46),mm(166.54),half===1?-Math.PI/2:Math.PI/2,mm(.3)),this.airexMaterial());
      core.position.z=side*mm(215);halfGroup.add(core);
      for (const z of [207, 220, 700, 1400, 1750, 2650, 2730]) {
        const radius = mm(z===207 ? 176 : z < 1500 ? 190 : 275);
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(radius, mm(2), 8, 64, arc), this.titaniumMaterial());
        hoop.rotation.z = half===1 ? -Math.PI/2 : Math.PI/2;
        hoop.position.z = side * mm(z);
        halfGroup.add(hoop);
      }
    }
    }
  }

  private addAuxiliaryServices(): void {
    this.servicesGroup.add(this.exteriorServices);
    this.exteriorServices.children.forEach(g=>{g.visible=g.userData.nearHalf ? !this.options.serviceCylinderCutaway : this.componentVisibility.cylinderLeft;});
    this.servicesGroup.visible = this.options.showServices;
    this.scene.add(this.servicesGroup);
  }

  private addBeamPipe(): void {
    const length = 11.6;
    const outerRadius = mm(23);
    const innerRadius = mm(22.2);
    const outerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb7aa82,
      metalness: 0.72,
      roughness: 0.3,
      clearcoat: 0.28,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
    });
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0x20262b,
      metalness: 0.25,
      roughness: 0.76,
      side: THREE.BackSide,
    });
    const ringMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8d8060,
      metalness: 0.82,
      roughness: 0.27,
      clearcoat: 0.18,
    });

    const outerGeometry = new THREE.CylinderGeometry(
      outerRadius,
      outerRadius,
      length,
      48,
      1,
      true
    );
    const outer = new THREE.Mesh(outerGeometry, outerMaterial);
    outer.rotation.x = Math.PI / 2;
    outer.castShadow = true;
    outer.receiveShadow = true;
    this.beamPipe.add(outer);

    const innerGeometry = new THREE.CylinderGeometry(
      innerRadius,
      innerRadius,
      length + 0.012,
      48,
      1,
      true
    );
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    inner.rotation.x = Math.PI / 2;
    this.beamPipe.add(inner);

    for (const z of [-5.25, -3.25, -1.55, 0, 1.55, 3.25, 5.25]) {
      const ringGeometry = new THREE.TorusGeometry(outerRadius * 1.07, 0.005, 10, 48);
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.z = z;
      ring.castShadow = true;
      this.beamPipe.add(ring);
    }

    for (const z of [-length / 2, length / 2]) {
      const faceGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 48);
      const face = new THREE.Mesh(faceGeometry, ringMaterial);
      face.position.z = z;
      face.rotation.y = z < 0 ? Math.PI : 0;
      this.beamPipe.add(face);
    }

    this.beamPipe.name = 'beam-pipe';
    this.beamPipe.renderOrder = 1;
    this.scene.add(this.beamPipe);
  }

  private addBeamAxis(): void {
    for (const [name,color,direction,length] of [
      ['x-axis',0xde4545,new THREE.Vector3(1,0,0),1.35],
      ['y-axis',0x27994e,new THREE.Vector3(0,1,0),1.35],
      ['beam-axis',0x3679e8,new THREE.Vector3(0,0,1),5.8],
    ] as Array<[string,number,THREE.Vector3,number]>) {
      const group=new THREE.Group();group.name=name;
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([direction.clone().multiplyScalar(-length),direction.clone().multiplyScalar(length)]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.8,depthTest:false}));
      line.renderOrder=90;group.add(line);
      for(const sign of [-1,1]) {
        const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
        const ctx=canvas.getContext('2d')!;ctx.font='bold 42px sans-serif';ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.textAlign='center';ctx.fillText((sign>0?'+':'−')+(name==='beam-axis'?'Z':name[0].toUpperCase()),64,48);
        const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false,transparent:true}));
        label.position.copy(direction).multiplyScalar(sign*(length+.12));label.scale.set(.24,.12,1);label.renderOrder=91;group.add(label);
      }
      this.scene.add(group);
    }
  }

  private animate = (): void => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private updatePointer(event: PointerEvent | MouseEvent): void {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private intersect(event: PointerEvent | MouseEvent): {
    module: ModuleDescriptor;
    chipIndex: number;
    matrix: THREE.Matrix4;
  } | undefined {
    this.updatePointer(event);
    const visibleMeshes = Array.from(this.elements.values())
      .map((element) => element.mesh)
      .filter((mesh) => mesh.visible);
    const hit = this.raycaster.intersectObjects(visibleMeshes, false).find(hit=>hit.instanceId!==undefined && (!this.currentVisibility || moduleVisible(this.currentVisibility,this.elements.get(hit.object.name)!.modules[hit.instanceId])) && (!this.componentVisibility.installedOnly || this.installedIds.has(this.elements.get(hit.object.name)!.modules[hit.instanceId].id)));
    if (!hit || hit.instanceId === undefined) {
      return undefined;
    }
    const element = this.elements.get(hit.object.name);
    if (!element) {
      return undefined;
    }
    return {
      module: element.modules[hit.instanceId],
      chipIndex: element.chipIndices[hit.instanceId],
      matrix: element.matrices[hit.instanceId],
    };
  }

  private onPointerMove = (event: PointerEvent): void => {
    const hit = this.intersect(event);
    if (!hit) {
      this.clearHover();
      return;
    }

    this.renderer.domElement.style.cursor = 'pointer';
    this.outline.matrixAutoUpdate = false;
    this.outline.matrix.copy(hit.matrix);
    this.outline.visible = true;
    this.hoveredId = hit.module.id;
    this.callbacks.onHover({
      module: hit.module,
      measurement: this.measurements.get(hit.module.id),
      chipIndex: hit.chipIndex,
      chipMeasurement: this.measurements.get(hit.module.id)?.chips[hit.chipIndex],
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  private onPointerLeave = (): void => this.clearHover();

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDown) {
      return;
    }
    const distance = Math.hypot(
      event.clientX - this.pointerDown.x,
      event.clientY - this.pointerDown.y
    );
    this.pointerDown = undefined;
    if (distance > 5) {
      return;
    }
    const hit = this.intersect(event);
    if (hit) {
      this.callbacks.onSelect(
        hit.module,
        hit.chipIndex,
        this.measurements.get(hit.module.id)
      );
    }
  };

  private onDoubleClick = (event: MouseEvent): void => {
    const hit = this.intersect(event);
    if (!hit) {
      this.resetCamera();
      return;
    }
    const target = new THREE.Vector3(...hit.module.position);
    this.controls.target.copy(target);
    const direction = this.camera.position.clone().sub(target).normalize();
    this.camera.position.copy(target.clone().add(direction.multiplyScalar(0.45)));
  };

  private clearHover(): void {
    if (this.hoveredId !== undefined) {
      this.hoveredId = undefined;
      this.outline.visible = false;
      this.renderer.domElement.style.cursor = 'grab';
      this.callbacks.onHover(undefined);
    }
  }

  updateOptions(options: InnerTracker3DOptions): void {
    this.options = options;
    const mappingKey=options.hardwareMappingJson+'|'+options.portcardMappingJson;
    if(mappingKey!==this.portcardMappingKey){
      this.portcardMappingKey=mappingKey;
      this.portcards=buildPortcardInventory(options.portcardMappingJson,options.hardwareMappingJson,this.modules).entries;
      this.rebuildElectrical();
      this.filterPortcards();
    }

    this.hardware.portcards.visible = options.showPortcards;
    this.hardware.antlers.visible = options.showAntlers;
    this.photos.forEach(p => { p.mesh.visible = options.moduleAppearance === 'photos' && p.mesh.userData.sectionVisible !== false; });
    this.elements.forEach(e => { (e.mesh.material as THREE.ShaderMaterial).uniforms.photoMode.value = options.moduleAppearance === 'photos' ? 1 : 0; });
    const axis = this.scene.getObjectByName('beam-axis');
    if (axis) {
      axis.visible = this.componentVisibility.axisZ;
    }
    const material = this.outline.material as THREE.LineBasicMaterial;
    material.color.set(options.selectedColor);
    this.setServiceCylinderVisible(options.showServiceCylinder);
    this.setServicesVisible(options.showServices);
    this.updateMeasurements(this.measurements);
    if(this.currentVisibility){this.setVisibility(this.currentVisibility);}
  }

  updateMeasurements(measurements: Map<string, ModuleMeasurement>): void {
    this.measurements = measurements;
    for (const element of this.elements.values()) {
      element.modules.forEach((module, index) => {
        const moduleMeasurement = measurements.get(module.id);
        const chipMeasurement = moduleMeasurement?.chips[element.chipIndices[index]];
        const hasChipMeasurements =
          moduleMeasurement !== undefined
          && Object.keys(moduleMeasurement.chips).length > 0;
        element.statusPresent.setX(index, (hasChipMeasurements ? chipMeasurement : moduleMeasurement) ? 1 : 0);
        setStatusColor(
          element.statusColors,
          index,
          measurementColor(
            hasChipMeasurements ? chipMeasurement : moduleMeasurement,
            this.options,
            {
              good: this.options.goodColor,
              bad: this.options.badColor,
              noData: this.options.noDataColor,
            }
          )
        );
      });
      element.statusColors.needsUpdate = true;
      element.statusPresent.needsUpdate = true;
    }
  }

  setVisibility(visibility: VisibilityState): void {
    this.currentVisibility = visibility;
    const allowed=new Set(this.modules.filter(m=>moduleVisible(visibility,m)&&(!this.componentVisibility.installedOnly||this.installedIds.has(m.id))).map(m=>m.id));
    this.moduleInstances.forEach(batch=>filterModuleInstances(batch,allowed,true));
    this.photos.forEach(p=>{
      const material=(p.mesh as THREE.Mesh).material as THREE.Material;
      const side=this.componentVisibility.mechanics?THREE.FrontSide:THREE.DoubleSide;
      if(material.side!==side){material.side=side;material.needsUpdate=true;}
    });
    this.tbpxServiceParts.forEach(part=>{const enabled=part.visibilityKey==='TBPX:0'
      ? visibility.TBPX.some((on,i)=>on && visible(`TBPX:${i+1}`,part.sectionKey,visibility))
      : visible(part.visibilityKey,part.sectionKey,visibility);
      part.mesh.visible=this.componentVisibility.tbpxCables && enabled;
    });
    this.photos.forEach(p => { const enabled = visible(p.visibilityKey!,p.sectionKey!,visibility); p.mesh.userData.sectionVisible = enabled; p.mesh.visible = enabled && this.options.moduleAppearance === 'photos'; });
    for (const element of this.elements.values()) {
      element.mesh.visible = visible(element.visibilityKey, element.sectionKey, visibility);
    }
    for (const support of this.supports) {
      support.mesh.visible = this.componentVisibility.mechanics && visible(support.visibilityKey, support.sectionKey, visibility) && deeVisible(visibility,support.visibilityKey,support.sectionKey,support.dee);
    }
    for (const divider of this.dividers) {
      divider.mesh.visible = this.options.moduleAppearance==='chips' && !this.componentVisibility.installedOnly && deeVisible(visibility,divider.visibilityKey,divider.sectionKey,divider.dee);
    }
    for (const feature of this.subdetectorFeatures) {
      if (feature.visibilityKey && feature.sectionKey) {
        feature.mesh.visible = this.componentVisibility.mechanics && visible(feature.visibilityKey, feature.sectionKey, visibility);
      }
    }
    // Update TBPX ladder mechanics per layer
    this.tbpxLayerMechanics.forEach(({ layer, group }) => {
      group.visible = this.componentVisibility.mechanics && (visibility.TBPX[layer - 1] ?? false);
    });
    // Update TEPX bridge trays
    const tepxVisible = visibility.TEPX.some(Boolean);
    this.tepxTraysGroup.visible = this.componentVisibility.rails && tepxVisible;
    this.electricalParts.forEach(p=>{p.mesh.visible=this.componentVisibility.electrical && this.options.showServices && this.options.showPortcards && deeVisible(visibility,p.visibilityKey,p.sectionKey,p.dee);});
    this.filterPortcards();
    this.clearHover();
  }

  private filterPortcards(): void {
    const connected=new Set(this.portcards.filter(c=>c.connections.length>0).map(c=>c.slot.id));
    const allowed=new Set<string>();
    this.portcardBatches.forEach(batch=>batch.ids.forEach(id=>{
      const [owner,side,half,element]=id.split(':');
      const section=owner==='TBPX' ? `TBPX:${half}:${side}` : `${owner}:${side}:${half==='right'?'upper':'lower'}`;
      const region=!this.currentVisibility || (owner==='TBPX' ? this.currentVisibility.TBPX.some((_,i)=>visible('TBPX:'+(i+1),section,this.currentVisibility!)) : visible(owner+':'+element.slice(1),section,this.currentVisibility));
      if(region && (!this.componentVisibility.connectedPortcardsOnly || connected.has(id))){allowed.add(id);}
    }));
    this.portcardBatches.forEach(batch=>filterModuleInstances(batch,allowed,true));
  }

  private rebuildElectrical(): void {
    disposeElectrical(this.electricalParts);
    const routes=connectionRoutes(this.modules,this.portcards,this.installedIds,this.componentVisibility.installedOnly,this.componentVisibility.connectedPortcardsOnly);
    this.electricalParts=electricalServices(routes);
    this.electricalParts.forEach(p=>this.scene.add(p.mesh));
    if(this.currentVisibility){this.setVisibility(this.currentVisibility);}
  }

  setInstalledModules(ids: Set<string>): void {
    const changed=ids.size!==this.installedIds.size || [...ids].some(id=>!this.installedIds.has(id));
    this.installedIds=new Set(ids);
    if(changed && this.componentVisibility.installedOnly){this.rebuildElectrical();}

    this.moduleInstances.forEach(batch=>filterModuleInstances(batch,this.installedIds,this.componentVisibility.installedOnly));
    if(this.currentVisibility){this.setVisibility(this.currentVisibility);}
  }

  setComponentVisibility(values: typeof this.componentVisibility): void {
    const changed=values.installedOnly!==this.componentVisibility.installedOnly;
    const routesChanged=changed || values.connectedPortcardsOnly!==this.componentVisibility.connectedPortcardsOnly;
    this.componentVisibility=values;
    if(routesChanged){this.rebuildElectrical();}
    this.filterPortcards();

    if(changed){this.moduleInstances.forEach(batch=>filterModuleInstances(batch,this.installedIds,values.installedOnly));this.clearHover();}
    this.serviceCylinderGroup.children.forEach(g=>{g.visible=g.userData.nearHalf ? !this.options.serviceCylinderCutaway : values.cylinderLeft;});
    this.exteriorServices.children.forEach(g=>{g.visible=g.userData.nearHalf ? !this.options.serviceCylinderCutaway : values.cylinderLeft;});
    for(const [name,on] of [['x-axis',values.axisX],['y-axis',values.axisY],['beam-axis',values.axisZ]] as Array<[string,boolean]>){const axis=this.scene.getObjectByName(name);if(axis){axis.visible=on;}}

    this.hardware.portcards.children.forEach(mount=>{
      mount.children.forEach(part=>{part.visible=part.userData.component==='cartridge' ? values.cartridges : mount.userData.kind==='tepx' ? values.tepxPortcards : values.tbpxPortcards;});
    });
    this.hardware.rails.visible=values.rails;
    this.exteriorServices.visible=values.exterior;
    if(this.currentVisibility){this.setVisibility(this.currentVisibility);}
  }

  focusInstalledModules(): void {
    const modules=this.modules.filter(m=>this.installedIds.has(m.id));
    if(modules.length){const first=modules[0];const direction=new THREE.Vector3(first.position[0],first.position[1],0).normalize();direction.z=.15;this.fitModules(modules,direction,mm(35));}
  }

  focusModule(module: ModuleDescriptor): void {
    this.fitModules([module],new THREE.Vector3(1,.5,.7),mm(35));
  }

  setCameraMode(mode: CameraMode): void {
    this.controls.mouseButtons.LEFT = mode === 'rotate'
      ? THREE.MOUSE.ROTATE
      : THREE.MOUSE.PAN;
    this.controls.mouseButtons.RIGHT = mode === 'rotate'
      ? THREE.MOUSE.PAN
      : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = mode === 'rotate'
      ? THREE.TOUCH.ROTATE
      : THREE.TOUCH.PAN;
    this.renderer.domElement.dataset.cameraMode = mode;
  }

  setBeamPipeVisible(visible: boolean): void {
    this.beamPipe.visible = visible;
  }

  setServiceCylinderVisible(visible: boolean): void {
    this.serviceCylinderGroup.visible = visible;
  }

  setServiceCylinderCutaway(cutaway: boolean): void {
    this.options = { ...this.options, serviceCylinderCutaway: cutaway };
    this.rebuildServiceCylinder();
    this.exteriorServices.children.forEach(g=>{g.visible=g.userData.nearHalf ? !cutaway : this.componentVisibility.cylinderLeft;});
  }

  setServicesVisible(visible: boolean): void {
    this.servicesGroup.visible = visible;
    this.tbpxServicesGroup.visible = visible;
    this.electricalParts.forEach(p=>{p.mesh.visible=visible && this.options.showPortcards && this.componentVisibility.electrical && (!this.currentVisibility || deeVisible(this.currentVisibility,p.visibilityKey,p.sectionKey,p.dee));});
  }

  private fitModules(modules: ModuleDescriptor[], direction: THREE.Vector3, margin: number): void {
    const box = new THREE.Box3();
    modules.forEach(m => {
      const point = new THREE.Vector3(...m.position);
      const radius = Math.max(...m.size) / 2;
      box.expandByPoint(point.clone().addScalar(radius));
      box.expandByPoint(point.clone().addScalar(-radius));
    });
    box.expandByScalar(margin);
    if (modules.length === this.modules.length && this.options.showAntlers) { box.expandByPoint(new THREE.Vector3(mm(440),mm(440),mm(3010))); box.expandByPoint(new THREE.Vector3(-mm(440),-mm(440),-mm(3010))); }
    const center = box.getCenter(new THREE.Vector3());
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(this.camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const aspect = Math.max(0.5, this.container.clientWidth / Math.max(1, this.container.clientHeight));
    const tanY = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 0.82;
    const tanX = tanY * aspect;
    let distance = 0;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const v = new THREE.Vector3(x, y, z).sub(center);
          distance = Math.max(distance, v.dot(direction) + Math.max(Math.abs(v.dot(right)) / tanX, Math.abs(v.dot(up)) / tanY));
        }
      }
    }
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, Math.max(0.3, distance));
    this.controls.update();
  }

  focusRegion(region: 'TBPX' | 'TFPX' | 'TEPX'): void {
    this.fitModules(this.modules.filter(m => m.subdetector === region && (region === 'TBPX' || m.side === '+z')),
      new THREE.Vector3(1, 0.5, 0.7), mm(10));
  }

  resetCamera(): void {
    this.fitModules(this.modules, new THREE.Vector3(1, 0.55, 0.65), mm(50));
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    disposeElectrical(this.electricalParts);
    this.electricalParts=[];
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('dblclick', this.onDoubleClick);
    this.installedIds.clear();
    this.controls.dispose();
    for(const name of ['x-axis','y-axis','beam-axis']){this.scene.getObjectByName(name)?.traverse(o=>{
      if(o instanceof THREE.Line){o.geometry.dispose();(o.material as THREE.Material).dispose();}
      if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}
    });}


    for (const element of this.elements.values()) {
      const materials = Array.isArray(element.mesh.material)
        ? element.mesh.material
        : [element.mesh.material];
      materials.forEach((material) => material.dispose());
      element.mesh.geometry.dispose();
    }
    for (const support of this.supports) {
      support.mesh.geometry.dispose();
      const materials = Array.isArray(support.mesh.material)
        ? support.mesh.material
        : [support.mesh.material];
      materials.forEach((material) => material.dispose());
    }
    for (const divider of this.dividers) {
      divider.mesh.geometry.dispose();
      (divider.mesh.material as THREE.Material).dispose();
    }
    this.beamPipe.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.serviceCylinderGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.tbpxServicesGroup.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}});
    this.tbpxMechanicsGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.tepxTraysGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.subdetectorFeaturesGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.servicesGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });

    (this.outline.geometry as THREE.BufferGeometry).dispose();
    (this.outline.material as THREE.Material).dispose();
    Object.values(this.boardTextures).forEach((texture) => texture.dispose());
    Object.values(this.carbonFiberTextures).forEach((texture) => texture.dispose());
    this.backgroundTexture.dispose();
    this.environment.dispose();
    const resources = new Set<THREE.Material>();
    [...this.photos.map(p => p.mesh), this.hardware.portcards, this.hardware.antlers, this.hardware.rails].forEach(root => root.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => resources.add(m)); }
    }));
    resources.forEach(m => { if (m instanceof THREE.MeshBasicMaterial) { m.map?.dispose(); } m.dispose(); });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

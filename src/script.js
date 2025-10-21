import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
import gsap from 'gsap'

///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// Consts //////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////
const J2 = 1.08263e-3;
let mass = 2300; // kg
let g = 9.81; // m/s
let Cd = 0.5;
const G = 6.6743e-11; // m³/kg/s²
const M = 5.972e24; // kg
const μ = G * M;
const R = 6.371e6; // m 
let radius = 0.6; // m 
let A = Math.PI * radius * radius; //m2
const orbitalAltitude = 693 * 1000;   //km
const orbitalInclination = 98.18 * Math.PI / 180;   // radian  
const orbitalRadius = R + orbitalAltitude;  //m
const sunRadius = R * 109;
const sunDistance = R * 235; // *100
const Pt = 500;
const λ = 0.055;
const σ = 1;
const T = 290;
const B = 1e6;
const L = 1;
const thrustCurve = [
  { time: 0, value: 0 },
  { time: 5, value: 400000 },
  { time: 50, value: 300000 },
  { time: 100, value: 150000 },
  { time: 110, value: 0 },
];
const k = 1.38e-23; //   (J/K)
const SIMULATION_SPEED_FACTOR = 98.48; // To make one orbit take 60 real seconds
const ECLIPSE_RADIUS_FACTOR = 0.736; // To adjust eclipse duration

const CIRCULAR_VELOCITY = 7507; // m/s for 700km orbit
const ESCAPE_VELOCITY = 10614; // m/s for Earth escape at 700km
const DECAY_THRESHOLD = 7000; // m/s threshold for noticeable decay



///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// Variables //////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

let velocity = 0; // m/s
let position = 0; // m
let thrust = 0;  // N
let dt = 0.1; // s
let isLaunched = false;
let isInOrbit = false;
let isOrbitalPhase = false;
let preLaunch = false;
let isFullView = false;
let isAnimationStopped = false; // New flag to stop animation
let hasBurnedUp = false; // New flag to track if satellite has burned up
let wasInEclipse = false; // To track eclipse state for smooth lighting
let orbitPath; // For visual feedback
let orbitPoints = []; // To store points for the orbit path
const MAX_ORBIT_POINTS = 1000; // Maximum points to store for the orbit path
let batteryPercentage = 100; // Initial battery percentage

///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// Environment ////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Texture
const textureLoader = new THREE.TextureLoader()
const earthTexture = textureLoader.load('/textures/earth.jpg')
const sunTexture = textureLoader.load('/textures/sun.jpg')
const partical = textureLoader.load('/textures/8.png')
const metalDiffuse = textureLoader.load('/textures/Metal/Metal_Displacement.jpg');
const metalRoughness = textureLoader.load('/textures/Metal/Metal_Roughness.jpg');
const metalMetalness = textureLoader.load('/textures/Metal/Metal_Metalness.jpg');
const metalNormal = textureLoader.load('/textures/Metal/Metal_Normal.jpg');
const SolarPanelDiffuse = textureLoader.load('/textures/SolarPanel/SolarPanel_Displacement.jpg');
const SolarPanelRoughness = textureLoader.load('/textures/SolarPanel/SolarPanel_Roughness.jpg');
const SolarPanelMetalness = textureLoader.load('/textures/SolarPanel/SolarPanel_Metalness.jpg');
const SolarPanelNormal = textureLoader.load('/textures/SolarPanel/SolarPanel_Normal.jpg');
const smokeTexture = new THREE.TextureLoader().load('textures/smoke.jpeg');
const flameTexture = new THREE.TextureLoader().load('textures/flame.png');
const fireTexture = new THREE.TextureLoader().load('static/textures/fire.jpeg'); // Load fire texture

// Camera
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, R * 100000);
scene.add(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enabled = false
controls.enableDamping = true

// Mouse variables for camera rotation
let isMouseDown = false;
let previousMouseX = 0;
let rotationAngle = 0;
let fullViewRotationZ = 0; // New variable for Z-axis rotation in full view

window.addEventListener('mousedown', (event) => {
  if (event.button === 0) { // Left mouse button
    isMouseDown = true;
    previousMouseX = event.clientX;
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) { // Left mouse button
    isMouseDown = false;
  }
});

window.addEventListener('mousemove', (event) => {
  if (isMouseDown) {
    const deltaX = event.clientX - previousMouseX;
    if (isFullView) {
      fullViewRotationZ -= deltaX * 0.005; // Adjust sensitivity for Z-axis rotation
    } else {
      rotationAngle -= deltaX * 0.005; // Adjust sensitivity for Y-axis rotation
    }
    previousMouseX = event.clientX;
  }
});

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambientLight)

// Resize
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
})
window.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) canvas.requestFullscreen()
  else document.exitFullscreen()
})


///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// Objects ////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

//STARS
const count = 3000;
const practicalsGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);
const minRadius = R + 10000000;
const maxRadius = R + 500000000;
for (let i = 0; i < count; i++) {
  const radius = minRadius + Math.random() * (maxRadius - minRadius);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);

  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  colors[i * 3] = 1;
  colors[i * 3 + 1] = 1;
  colors[i * 3 + 2] = 1;
}
practicalsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
practicalsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const practicalsMaterial = new THREE.PointsMaterial({
  size: 500,
  sizeAttenuation: true,
  transparent: true,
  alphaMap: partical,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true
});
const stars = new THREE.Points(practicalsGeometry, practicalsMaterial);
scene.add(stars);
stars.visible = false;

// EARTH
const earthGeometry = new THREE.SphereGeometry(R, 64, 64)
const earthMaterial = new THREE.MeshStandardMaterial({
  map: earthTexture,
  roughness: 1,
  transparent: false,
  opacity: 1,
  alphaTest: 0.5,
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial)
earth.position.set(0, 0, 0)
scene.add(earth)

// Sun
const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(sunDistance, 0, 0)
scene.add(sun);
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.copy(sun.position);
sunLight.target.position.set(0, 0, 0);
scene.add(sunLight.target);
scene.add(sunLight);


// Atmosphere
const atmosphereRealHeights = [15e3, 50e3, 85e3, 600e3, 10000e3];
const atmosphereColors = [0x88ccff, 0x66bbff, 0x5599ff, 0x4477ff, 0x3355ff];
const atmosphereOpacities = [0.1, 0.08, 0.06, 0.04, 0.02];
atmosphereRealHeights.forEach((realHeight, i) => {
  const scaledHeight = realHeight;
  const radius = R + scaledHeight;
  const layer = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.MeshStandardMaterial({
      color: atmosphereColors[i],
      transparent: true,
      opacity: atmosphereOpacities[i],
      side: THREE.DoubleSide,
    })
  );
  layer.position.copy(earth.position);
  scene.add(layer);
});
//rocket
const rocket = new THREE.Group();
const stageMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
function createStage(height, positionY, color = 0x555555) {
  const geometry = new THREE.CylinderGeometry(1, 1, height, 32);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = positionY;
  return mesh;
}

const stage1 = createStage(3, -4.5);
const stage2 = createStage(3, -1.5);
const stage3 = createStage(3, 1.5);
const stage4 = createStage(3, 4.5);

rocket.add(stage1, stage2, stage3, stage4);

const nose = new THREE.Mesh(
  new THREE.ConeGeometry(1, 3, 32),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
nose.position.y = 7.5;
rocket.add(nose);

// Satellite 
const satellite = new THREE.Group();
scene.add(satellite);

const satelliteCore = new THREE.Group();
satellite.add(satelliteCore);

// Body
const bodyHeight = 2
const bodyGeometry = new THREE.BoxGeometry(1, bodyHeight, 1)
const bodyMaterial = new THREE.MeshStandardMaterial({
  map: metalDiffuse,
  roughnessMap: metalRoughness,
  metalnessMap: metalMetalness,
  normalMap: metalNormal,
  metalness: 1,
  roughness: 1,
  color: 0xffffff,
})
const satelliteBody = new THREE.Mesh(bodyGeometry, bodyMaterial)
satelliteBody.position.set(0, 0, 0)
satelliteCore.add(satelliteBody) // Add to satelliteCore

// Solar Panel Pivot Group
const solarPanelPivot = new THREE.Group();
satellite.add(solarPanelPivot); // Keep as direct child of satellite

// SOLAR PANELS 
const panelGeometry = new THREE.BoxGeometry(0.1, 1.5, 2.95);
const panelMaterial = new THREE.MeshStandardMaterial({
  map: SolarPanelDiffuse,
  roughness: 0.3,
  color: 0xffffff,
});
const panelLeft1 = new THREE.Mesh(panelGeometry, panelMaterial);
const panelLeft2 = new THREE.Mesh(panelGeometry, panelMaterial);
const panelRight1 = new THREE.Mesh(panelGeometry, panelMaterial);
const panelRight2 = new THREE.Mesh(panelGeometry, panelMaterial);

const tubeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 16);
const tubeMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const tubeLeft = new THREE.Mesh(tubeGeometry, tubeMaterial);
const tubeRight = new THREE.Mesh(tubeGeometry, tubeMaterial);


tubeLeft.rotation.x = Math.PI / 2;
tubeRight.rotation.x = Math.PI / 2;


panelLeft1.position.set(0, 0, -3.55);
tubeLeft.position.set(0, 0, -5.1)
panelLeft2.position.set(0, 0, -6.65);

panelRight1.position.set(0, 0, 3.55);
tubeRight.position.set(0, 0, 5.1);
panelRight2.position.set(0, 0, 6.65);


solarPanelPivot.add(panelLeft1, panelLeft2, tubeLeft);
solarPanelPivot.add(panelRight1, panelRight2, tubeRight);

// Rods
const rodGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
const rodMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const rodLeft = new THREE.Mesh(rodGeometry, rodMaterial);
rodLeft.rotation.x = Math.PI / 2;
rodLeft.scale.set(1, 2, 1);
rodLeft.position.set(0, 0, -1.35); // Position relative to pivot
solarPanelPivot.add(rodLeft);
const rodRight = new THREE.Mesh(rodGeometry, rodMaterial);
rodRight.rotation.x = Math.PI / 2;
rodRight.scale.set(1, 2, 1);
rodRight.position.set(0, 0, 1.35); // Position relative to pivot
solarPanelPivot.add(rodRight);

// DISH 
const dishGeometry = new THREE.SphereGeometry(0.3, 32, 32, 0, Math.PI);
const dishMaterial = new THREE.MeshStandardMaterial({ color: 0xFFCC00, metalness: 0.9 });
const dish = new THREE.Mesh(dishGeometry, dishMaterial);
dish.rotation.z = Math.PI / 2;
dish.position.set(-1, 0, 0);
dish.lookAt(new THREE.Vector3(-20, 0, 0));
satelliteCore.add(dish);

// Base 
const baseGeometry = new THREE.BoxGeometry(1, 0.2, 3, 10);
const baseMaterial = new THREE.MeshStandardMaterial({
  map: metalDiffuse,
  roughnessMap: metalRoughness,
  metalnessMap: metalMetalness,
  normalMap: metalNormal,
  metalness: 1,
  roughness: 0.3,
  color: 0xFFCC00,
});
const base = new THREE.Mesh(baseGeometry, baseMaterial);
base.position.set(0, -bodyHeight / 2 - 0.1, 0);
const launchStart = new THREE.Vector3(0, R + 0.01, 0);
satellite.position.copy(launchStart);
satelliteCore.add(base);
panelLeft1.scale.z = 0.01;
panelLeft2.scale.z = 0.01;
panelRight1.scale.z = 0.01;
panelRight2.scale.z = 0.01;
satellite.scale.set(0.008, 0.008, 0.008);
satellite.position.y = 4.5;

// Add Satelite To The Rocket
rocket.add(satellite);
rocket.scale.set(0.5, 0.5, 0.5);
rocket.position.set(0, R + 10, 0);
scene.add(rocket);

// Smoke
const smokeGroup = new THREE.Group();
scene.add(smokeGroup);
const smokeParticles = [];
const baseSmokeMaterial = new THREE.SpriteMaterial({
  map: smokeTexture,
  transparent: true,
  opacity: 0.6,
  depthWrite: false
});

// Flame
const flameMaterial = new THREE.SpriteMaterial({
  map: flameTexture,
  transparent: true,
  opacity: 1,
  depthWrite: false
});
const flame = new THREE.Sprite(flameMaterial);
flame.scale.set(2, 4, 1);
flame.visible = false;
rocket.add(flame);
flame.position.set(0, -7.5, 0);

///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// Movement ///////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

function openBaseDoors() {
  gsap.to(satellite.scale, { x: 1, y: 1, z: 1, duration: 2, ease: "power2.out", delay: 0.5 });
  scene.attach(satellite);
  gsap.to(rocket.scale, { x: 0, y: 0, z: 0, duration: 2, delay: 0.5 });
}

function openSolarPanels() {
  gsap.to(panelLeft1.scale, { z: 1, duration: 2, ease: "power2.out" });
  gsap.to(panelLeft2.scale, { z: 1, duration: 2, ease: "power2.out" });
  gsap.to(panelRight1.scale, { z: 1, duration: 2, ease: "power2.out" });
  gsap.to(panelRight2.scale, { z: 1, duration: 2, ease: "power2.out" });
}

function createSmokeSprite(basePosition) {
  const sprite = new THREE.Sprite(baseSmokeMaterial.clone());
  const spread = 1.2;
  sprite.position.copy(basePosition).add(new THREE.Vector3(
    (Math.random() - 0.5) * spread,
    (Math.random() - 0.5) * spread,
    (Math.random() - 0.5) * spread
  ));
  const scale = 2 + Math.random() * 2.5;
  sprite.scale.set(scale, scale, 1);
  smokeGroup.add(sprite);
  smokeParticles.push({ sprite: sprite, life: 1.0 });
}

function updateSolarPanels() {
  // This function is for initial deployment, not continuous tracking
  // The continuous tracking is handled by updateSolarPanelOrientation
  gsap.to(panelLeft1.scale, { z: 1, duration: 20, ease: "power2.out" });
  gsap.to(panelLeft2.scale, { z: 1, duration: 20, ease: "power2.out" });
  gsap.to(panelRight1.scale, { z: 1, duration: 20, ease: "power2.out" });
  gsap.to(panelRight2.scale, { z: 1, duration: 20, ease: "power2.out" });
}

function updateSolarPanelOrientation() {
  if (!isOrbitalPhase) return;

  // Get the world position of the solarPanelPivot
  const pivotWorldPosition = new THREE.Vector3();
  solarPanelPivot.getWorldPosition(pivotWorldPosition);

  // Calculate the direction vector from the pivot to the sun in world coordinates
  const sunDirectionWorld = new THREE.Vector3().subVectors(sun.position, pivotWorldPosition).normalize();

  // Get the current local +Y axis of the solarPanelPivot in world coordinates
  const pivotLocalYAxisWorld = new THREE.Vector3(0, 1, 0);
  solarPanelPivot.localToWorld(pivotLocalYAxisWorld);
  pivotLocalYAxisWorld.sub(pivotWorldPosition).normalize(); // Convert to direction vector

  // Calculate the quaternion to rotate the pivot's local +Y axis to align with sunDirectionWorld
  const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(pivotLocalYAxisWorld, sunDirectionWorld);


}

function flameOutAndRemove(stage, nextStage = null) {
  gsap.to(flame.material, { duration: 0.5, opacity: 0, onComplete: () => { flame.visible = false; } });
  gsap.to(stage.material, { duration: 1.5, opacity: 0, onComplete: () => { rocket.remove(stage); } });
  gsap.to(stage.scale, { duration: 1.5, x: 0, y: 0, z: 0 });
  if (nextStage) {
    setTimeout(() => {
      const bbox = new THREE.Box3().setFromObject(nextStage);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      gsap.to(flame.position, { duration: 1, y: -size.y, ease: "power2.out" });
      nextStage.add(flame);
      flame.visible = true;
      gsap.to(flame.material, { duration: 0.5, opacity: 1 });
    }, 1500);
  }
}


///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// GUI ////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

const GUIInfo = {
  altitudeKm: 0,
  velocity: 0,
  dragForce: 0,
  thrust: 0,
  layer: 'التروبوسفير',
  orbitalSpeed: 0,
  omegaDot: 0,
  power: 0,
  snr: 0,
  solarPower: 0, // New property for solar power
  velocityMultiplier: 1.0,
  scenario: 'Stable Orbit',
  eclipseTime: 0, // New property for eclipse time
  simulationTime: 0, // New property for simulation time
  kineticEnergy: 0, // New property for kinetic energy
  potentialEnergy: 0, // New property for potential energy
  totalEnergy: 0, // New property for total energy
  batteryPercentage: 100, // New property for battery percentage
  solarPanelRotationY: 0, // New property for solar panel Y-axis rotation
  solarPanelRotationZ: 0, // New property for solar panel Z-axis rotation
  satelliteCoreRotationZ: 0 // New property for satellite core Z-axis rotation
};

let totalEclipseTime = 0; // Variable to accumulate eclipse time
let solarPanelOpenTime = 0; // Variable to store the time when solar panels open

const gui = new GUI()
gui.add(GUIInfo, 'altitudeKm').name('الارتفاع (كم)').listen();
gui.add(GUIInfo, 'velocity').name('السرعة (م/ث)').listen();
gui.add(GUIInfo, 'dragForce').name('مقاومة الهواء  (N)').listen();
gui.add(GUIInfo, 'thrust').name('قوة الدفع (N)').listen();
gui.add(GUIInfo, 'layer').name('الطبقة الجوية').listen();
gui.add(GUIInfo, 'orbitalSpeed').name('السرعة المدارية (م/ث)').listen();
gui.add(GUIInfo, 'omegaDot').name('(deg/s) تراجع العقدة').listen();
GUIInfo.snr = 0;
gui.add(GUIInfo, 'snr').name('SNR (dB)').listen();
gui.add(GUIInfo, 'solarPower').name('Solar Power (W)').listen(); // Add solar power to GUI
gui.add(GUIInfo, 'eclipseTime').name('Eclipse Time (s)').listen(); // Add eclipse time to GUI
gui.add(GUIInfo, 'simulationTime').name('Simulation Time (s)').listen(); // Add simulation time to GUI
gui.add(GUIInfo, 'batteryPercentage').name('Battery (%)').listen(); // Add battery percentage to GUI

// Solar Panel Rotation Controls
const solarPanelFolder = gui.addFolder('Solar Panel Rotation');
solarPanelFolder.add(GUIInfo, 'solarPanelRotationZ', -Math.PI / 2, Math.PI / 2, 0.001).name('Rotation Z (rad)').listen();
const satelliteFolder = gui.addFolder('satellite Rotation ');
satelliteFolder.add(GUIInfo, 'satelliteCoreRotationZ', -Math.PI / 2, Math.PI / 2, 0.001).name('Rotation Z (rad)').listen();
// Add velocity control to your GUI
const velocityFolder = gui.addFolder('orbital Velocity Control');
velocityFolder.add(GUIInfo, 'velocityMultiplier', 0.5, 1.5, 0.01).name('Velocity Multiplier').onChange(updateVelocity);
// velocityFolder.add(GUIInfo, 'scenario').name('Current Scenario').listen();

// Add scenario buttons
// const scenarios = {
//   'Decay Orbit': () => setVelocityScenario(0.85),
//   'Stable Ellipse': () => setVelocityScenario(0.95),
//   'Perfect Circle': () => setVelocityScenario(1.0),
//   'Extended Ellipse': () => setVelocityScenario(1.2),
//   'Escape Trajectory': () => setVelocityScenario(1.5)
// };

// for (const [name, func] of Object.entries(scenarios)) {
//   velocityFolder.add({ [name]: func }, name).name(name);
// }

const launchControls = {
  launch: () => {
    preLaunch = true;
    isLaunched = false;
  }
};
gui.add(launchControls, 'launch').name(' Start ');
gui.add({
  ToggleView: () => {
    if (!isFullView) {
      isFullView = true;
      gsap.to(camera.position, {
        x: fullViewPosition.x,
        y: fullViewPosition.y,
        z: fullViewPosition.z,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
          camera.lookAt(fullViewTarget);
        }
      });
    } else {
      isFullView = false;
      cameraTransitionStarted = false;
    }
  }
}, 'ToggleView').name('fullview');

const physicsControls = {
  rocketMass: mass,
  rocketRadius: radius,
};

gui.add(physicsControls, 'rocketMass', 500, 5000, 50).name('كتلة الصاروخ (كغ)').onChange((value) => {
  mass = value;
});

gui.add(physicsControls, 'rocketRadius', 0.2, 2, 0.01).name('نصف قطر الصاروخ (م)').onChange((value) => {
  radius = value;
  A = Math.PI * radius * radius;
});

///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// Rules //////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

function getDynamicThrust(t) {
  for (let i = 0; i < thrustCurve.length - 1; i++) {
    const current = thrustCurve[i];
    const next = thrustCurve[i + 1];
    if (t >= current.time && t < next.time) {
      const progress = (t - current.time) / (next.time - current.time);
      return current.value + progress * (next.value - current.value);
    }
  }
  return thrustCurve[thrustCurve.length - 1].value;
}
function calculateSSODynamics() {
  // w = sqrt(GM/r^3) == 0.001062
  const w = Math.sqrt(μ / Math.pow(orbitalRadius, 3));
  //  Ω̇ = - (3/2) × J₂ × (R_E / r)² × n × cos(i) == -96
  const omegaDot = (-1.5) * J2 * Math.pow(R / orbitalRadius, 2) * w * Math.cos(orbitalInclination);
  return omegaDot * (180 / Math.PI);
}

function computeSNR() {
  const G = 50;
  // SNR = (Pt * G^2 * λ^2 * σ) / [ (4π)^3 * R^4 * k * T * B * L ] == 1.49 × 10^11
  const numerator = Pt * G * G * λ * λ * σ;
  const denominator = Math.pow(4 * Math.PI, 3) * Math.pow(R, 4) * k * T * B * L;
  console.log({ numerator, denominator });
  return numerator / denominator;
}

function getAirDensityByAltitude(altitudeKm) {
  // rho = rho0 * e^(-h / H)
  const rho0 = 1.225;
  const H = 8.5;
  return rho0 * Math.exp(-altitudeKm / H);
}


function getAtmosphereLayer(altitudeKm) {
  if (altitudeKm < 1500) return 'التروبوسفير';
  if (altitudeKm < 5000) return 'الستراتوسفير';
  if (altitudeKm < 5800) return 'الميزوسفير';
  if (altitudeKm < 6000) return 'الترموسفير';
  return 'الأكسوسفير';
}

function updatePreLaunch(dt) {
  thrust = getDynamicThrust(clock.elapsedTime);
  if (clock.elapsedTime >= thrustCurve[1].time) {
    preLaunch = false;
    isLaunched = true;
  }
  GUIInfo.thrust = thrust.toFixed(2);
  GUIInfo.altitudeKm = (position / 1000).toFixed(2);
  GUIInfo.velocity = velocity.toFixed(2);
  GUIInfo.layer = getAtmosphereLayer(0);

  const rocketWorldPos = new THREE.Vector3();
  rocket.getWorldPosition(rocketWorldPos);
  const smokePos = rocketWorldPos.clone().add(new THREE.Vector3(0, -5, 0));
  if (Math.random() < 0.8) {
    createSmokeSprite(smokePos);
  }
}

// Launch Study
function updateRocketPhysics() {
  if (preLaunch) {
    updatePreLaunch(dt);
    return;
  }
  if (!isLaunched) return;
  thrust = getDynamicThrust(clock.elapsedTime);
  flame.visible = true;
  if (position >= orbitalAltitude - 10000 && thrust > 0) {
    thrust *= 0.98;
    if (thrust < 0.1) thrust = 0;
  }
  let altitudeKm = position / 10000;
  if (altitudeKm > 15 && rocket.children.includes(stage1)) {
    flameOutAndRemove(stage1, stage2);
  }
  if (altitudeKm > 80 && rocket.children.includes(stage2)) {
    flameOutAndRemove(stage2, stage3);
  }
  if (altitudeKm > 600 && rocket.children.includes(stage3)) {
    flameOutAndRemove(stage3, null);
    stars.visible = true;
  }
  let rho = getAirDensityByAltitude(altitudeKm);
  let gravityForce = mass * g;
  let dragForce = 0.5 * rho * velocity * velocity * Cd * A;
  if (velocity < 0) dragForce *= -1;

  let netForce = thrust - gravityForce - dragForce;
  let acceleration = netForce / mass;

  velocity += acceleration * dt;
  position += velocity * dt;

  rocket.position.y = position;

  GUIInfo.altitudeKm = altitudeKm.toFixed(2);
  GUIInfo.velocity = velocity.toFixed(2);
  GUIInfo.dragForce = dragForce.toFixed(2);
  GUIInfo.thrust = thrust.toFixed(2);
  GUIInfo.layer = getAtmosphereLayer(altitudeKm);

}

//  Orbital Study
function startOrbitalStudy() {
  isInOrbit = true;
  hasBurnedUp = false; // Reset burn flag
  satellite.position.copy(rocket.position);
  const r = satellite.position.length();
  const orbitalSpeed = Math.sqrt(G * M / r);
  const position = satellite.position.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(position.dot(up)) > 0.99) {
    up.set(0, 0, 1);
  }
  let velocityDirection = new THREE.Vector3().crossVectors(position, up).normalize();
  velocityDirection.applyAxisAngle(new THREE.Vector3(1, 0, 0), orbitalInclination);
  satellite.velocity = velocityDirection.multiplyScalar(orbitalSpeed);
  GUIInfo.orbitalSpeed = orbitalSpeed.toFixed(2);
  const initialSnr = computeSNR();
  const initialSnr_dB = 10 * Math.log10(initialSnr);
  GUIInfo.snr = initialSnr_dB.toFixed(2); // Set initial SNR
  GUIInfo.omegaDot = calculateSSODynamics().toFixed(5);
  updateScenarioInfo(orbitalSpeed); // Initialize scenario info
}

function setVelocityScenario(multiplier) {
  GUIInfo.velocityMultiplier = multiplier;
  updateVelocity();
}

function updateVelocity() {
  if (!isInOrbit) return;

  const newVelocity = CIRCULAR_VELOCITY * GUIInfo.velocityMultiplier;

  // Update the velocity vector direction and magnitude
  const currentDirection = satellite.velocity.clone().normalize();
  satellite.velocity.copy(currentDirection.multiplyScalar(newVelocity));

  // Update scenario information
  updateScenarioInfo(newVelocity);
}

function updateScenarioInfo(currentVelocity, isBurnedUp = false) {
  const infoPanel = document.getElementById('infoPanel');
  const title = document.getElementById('scenarioTitle');
  const description = document.getElementById('scenarioDescription');

  if (infoPanel) infoPanel.style.display = 'block';

  if (isBurnedUp) {
    GUIInfo.scenario = 'Satellite Burned Up';
    if (title) title.textContent = 'Satellite Burned Up';
    if (description) description.textContent = 'The satellite re-entered Earth\'s atmosphere at high speed and burned up due to atmospheric friction.';
  } else if (currentVelocity < DECAY_THRESHOLD) {
    GUIInfo.scenario = 'Orbital Decay';
    if (title) title.textContent = 'Orbital Decay';
    if (description) description.textContent = 'Velocity is too low. The satellite will experience rapid orbital decay and eventually re-enter Earth\'s atmosphere.';
  } else if (currentVelocity < CIRCULAR_VELOCITY * 0.98) {
    GUIInfo.scenario = 'Stable Ellipse (Low)';
    if (title) title.textContent = 'Stable Elliptical Orbit (Lower)';
    if (description) description.textContent = 'The satellite is in a stable elliptical orbit. The point where velocity was reduced is now the apogee (highest point).';
  } else if (currentVelocity > CIRCULAR_VELOCITY * 1.02) {
    GUIInfo.scenario = 'Stable Ellipse (High)';
    if (title) title.textContent = 'Stable Elliptical Orbit (Higher)';
    if (description) description.textContent = 'The satellite is in a stable elliptical orbit. The point where velocity was increased is now the perigee (lowest point).';
  } else {
    GUIInfo.scenario = 'Circular Orbit';
    if (title) title.textContent = 'Circular Orbit';
    if (description) description.textContent = 'The satellite is in a stable circular orbit. Velocity is perfectly balanced with Earth\'s gravity.';
  }

  if (currentVelocity >= ESCAPE_VELOCITY && !isBurnedUp) {
    GUIInfo.scenario = 'Escape Trajectory';
    if (title) title.textContent = 'Escape Trajectory';
    if (description) description.textContent = 'Velocity exceeds Earth\'s escape velocity. The satellite will leave Earth\'s gravitational influence entirely.';
  }

  // Auto-hide the info panel after 5 seconds, unless it's a burn-up scenario
  clearTimeout(window.infoPanelTimeout);
  if (!isBurnedUp) {
    window.infoPanelTimeout = setTimeout(() => {
      if (infoPanel) infoPanel.style.display = 'none';
    }, 5000);
  }
}

function updateOrbitPhysics(dt) {
  if (!isInOrbit) return;

  let rVec = satellite.position.clone();
  let r = rVec.length();
  let altitudeKm = (r - R) / 1000;

  // Check for burn up scenario
  if (GUIInfo.scenario === 'Orbital Decay' && altitudeKm < 600 && satellite.visible && !hasBurnedUp) {
    // Trigger burn up sequence
    satellite.visible = false; // Make satellite invisible
    isInOrbit = false; // Stop orbital simulation
    isAnimationStopped = true; // Stop the animation loop
    hasBurnedUp = true; // Set burn flag
    updateScenarioInfo(0, true); // Update info panel with burn up message

    // Add burn effect
    const burnEffectMaterial = new THREE.SpriteMaterial({
      map: fireTexture,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const burnEffect = new THREE.Sprite(burnEffectMaterial);
    burnEffect.scale.set(500000, 500000, 1); // Scale to be visible at orbital distances
    burnEffect.position.copy(satellite.position);
    scene.add(burnEffect);

    // Animate burn effect to fade out and disappear
    gsap.to(burnEffect.material, {
      opacity: 2,
      duration: 2,
      onComplete: () => {
        scene.remove(burnEffect);
        location.reload(); // Refresh the page after the burn effect
      }
    });

    // Clear orbit path visualization
    if (orbitPath) {
      scene.remove(orbitPath);
      orbitPath = null;
      orbitPoints = [];
    }

    return; // Stop further physics updates for this frame
  }

  // Calculate gravitational acceleration
  let gravityDir = rVec.clone().normalize().multiplyScalar(-1);
  let gravityAcc = gravityDir.multiplyScalar(G * M / (r * r));

  // For escape trajectory, we need special handling
  if (GUIInfo.scenario === 'Escape Trajectory') {
    // Gradually reduce the influence of gravity to simulate escape
    const escapeFactor = Math.min(1, (satellite.velocity.length() - ESCAPE_VELOCITY) / 1000);
    gravityAcc.multiplyScalar(1 - escapeFactor);
  }

  // Update velocity based on gravity
  satellite.velocity.add(gravityAcc.multiplyScalar(dt));

  // Update position
  satellite.position.add(satellite.velocity.clone().multiplyScalar(dt));

  // Update GUI altitude
  GUIInfo.altitudeKm = altitudeKm.toFixed(2);
  GUIInfo.orbitalSpeed = satellite.velocity.length().toFixed(2); // Update orbital speed in GUI

  // Calculate and update energy values
  calculateOrbitalEnergy(mass, satellite.velocity.length(), r);

  // For visualization, adjust the orbit path based on velocity
  updateOrbitVisualization();
}

function calculateOrbitalEnergy(m, v, r) {
  const kineticEnergy = 0.5 * m * v * v;
  const potentialEnergy = - (G * M * m) / r;
  const totalEnergy = kineticEnergy + potentialEnergy;

  document.getElementById('kineticEnergyDisplay').textContent = kineticEnergy.toFixed(2);
  document.getElementById('potentialEnergyDisplay').textContent = potentialEnergy.toFixed(2);
  document.getElementById('totalEnergyDisplay').textContent = totalEnergy.toFixed(2);
}

function updateOrbitVisualization() {
  // Add current position to orbit points
  orbitPoints.push(satellite.position.clone());

  // Limit the number of points
  if (orbitPoints.length > MAX_ORBIT_POINTS) {
    orbitPoints.shift(); // Remove the oldest point
  }

  // Update the orbit path geometry
  if (orbitPath) {
    scene.remove(orbitPath);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green line
  orbitPath = new THREE.Line(geometry, material);
  scene.add(orbitPath);
}

function deploySatelliteSequence() {
  isLaunched = false;
  openBaseDoors();
  setTimeout(() => {
    updateSolarPanels();
  }, 2000);
  setTimeout(() => {
    scene.attach(satellite);
    isOrbitalPhase = true;
    isInOrbit = true;
    startOrbitalStudy();
    openSolarPanels();
    solarPanelOpenTime = clock.elapsedTime; // Record the time when solar panels open
    // Initialize orbit path visualization
    orbitPoints = [];
    if (orbitPath) {
      scene.remove(orbitPath);
      orbitPath = null;
    }
  }, 5000);
}

function updatePhysics(dt) {
  if (!isInOrbit) {
    updateRocketPhysics(dt);
    if (position >= orbitalRadius) {
      deploySatelliteSequence();
    }
  } else {
    updateOrbitPhysics(dt);
  }
}

function checkEclipse() {
  // r_s: vector from Earth's center to the satellite
  const r_s = satellite.position.clone();
  // r_sun: vector from Earth's center to the Sun
  const r_sun = sun.position.clone();

  // u_sun: unit vector from Earth towards the Sun
  const u_sun = r_sun.normalize();

  // s_dot_u: component of the satellite's position along the Sun-Earth axis
  const s_dot_u = r_s.dot(u_sun);

  // d_perp_sq: squared perpendicular distance from the satellite to the Sun-Earth axis
  const d_perp_sq = r_s.lengthSq() - s_dot_u * s_dot_u;

  // Eclipse conditions:
  // 1. The satellite is on the night side of the Earth relative to the Sun (s_dot_u < 0)
  // 2. The satellite's perpendicular distance from the Sun-Earth axis is less than Earth's radius (d_perp_sq < R*R)
  const R_eclipse = R * ECLIPSE_RADIUS_FACTOR; // Use adjusted radius for eclipse calculation
  return s_dot_u < 0 && d_perp_sq < R_eclipse * R_eclipse;
}

function calculateSolarPower(sunVectorLocal, isEclipse) {
  if (isEclipse) {
    GUIInfo.solarPower = 0;
    return;
  }

  const rotationYAbs = Math.abs(GUIInfo.solarPanelRotationY);
  const rotationZAbs = Math.abs(GUIInfo.solarPanelRotationZ);
  const epsilon = 0.01; // Small epsilon for floating point comparison

  // Check if rotation is approximately 90 degrees (PI/2) or 180 degrees (PI)
  if (
    Math.abs(rotationYAbs - Math.PI / 2) < epsilon ||
    Math.abs(rotationYAbs - Math.PI) < epsilon ||
    Math.abs(rotationZAbs - Math.PI / 2) < epsilon ||
    Math.abs(rotationZAbs - Math.PI) < epsilon
  ) {
    GUIInfo.solarPower = 0;
    return;
  }

  GUIInfo.solarPower = 5700;
}

//camera update
const fullViewPosition = new THREE.Vector3(0, 50, -19000000);
const fullViewTarget = new THREE.Vector3(0, 0, 0);
let cameraOffset = new THREE.Vector3(0, 1, 8);
const targetCameraOffset = new THREE.Vector3(0, 2, 15);
let cameraTransitionStarted = false;

function updateCamera() {
  if (isFullView) {
    camera.lookAt(fullViewTarget);
    camera.rotation.y = fullViewRotationZ; // Apply Z-axis rotation
    return;
  }
  if (isOrbitalPhase) {
    if (!cameraTransitionStarted) {
      cameraTransitionStarted = true;
      gsap.to(cameraOffset, {
        x: targetCameraOffset.x,
        y: targetCameraOffset.y,
        z: targetCameraOffset.z,
        duration: 3,
        ease: "power2.inOut"
      });
    }
    const satellitePos = satellite.position.clone();
    const radius = cameraOffset.length();
    const cameraX = satellitePos.x + radius * Math.sin(rotationAngle);
    const cameraZ = satellitePos.z + radius * Math.cos(rotationAngle);
    camera.position.set(cameraX, satellitePos.y + cameraOffset.y, cameraZ);
    camera.lookAt(satellitePos);
  } else {
    const rocketPos = rocket.position.clone();
    const cameraPos = rocketPos.clone().add(cameraOffset);
    camera.position.copy(cameraPos);
    camera.lookAt(rocketPos);
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////// Animate ////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

const clock = new THREE.Clock();
function Animate() {
  const delta = clock.getDelta();

  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const p = smokeParticles[i];
    p.sprite.position.y -= 0.02;
    p.sprite.position.x += (Math.random() - 0.5) * 0.02;
    p.sprite.position.z += (Math.random() - 0.5) * 0.02;
    p.sprite.material.opacity -= 0.01;
    p.sprite.scale.multiplyScalar(1.01);
    p.life -= 0.01;
    if (p.life <= 0) {
      smokeGroup.remove(p.sprite);
      smokeParticles.splice(i, 1);
    }
  }

  updatePhysics(delta * SIMULATION_SPEED_FACTOR);
  updateCamera();

  if (isOrbitalPhase) {
    solarPanelPivot.rotation.y = GUIInfo.solarPanelRotationY;
    solarPanelPivot.rotation.z = GUIInfo.solarPanelRotationZ;
    satelliteCore.rotation.z = GUIInfo.satelliteCoreRotationZ;
    updateSolarPanelOrientation();
    const sunPositionLocal = sun.position.clone();
    satellite.worldToLocal(sunPositionLocal);
    const sunVector = sunPositionLocal.normalize();
    const isEclipse = checkEclipse();
    calculateSolarPower(sunVector, isEclipse); // This function now only sets the target power

    if (isEclipse && !wasInEclipse) {
      sunLight.intensity = 0; // Instantly turn off sunlight
      gsap.to(GUIInfo, { solarPower: 0, duration: 10 }); // Smoothly decrease solar power
    } else if (!isEclipse && wasInEclipse) {
      sunLight.intensity = 1; // Instantly turn on sunlight
      gsap.to(GUIInfo, { solarPower: 5700, duration: 2 }); // Smoothly increase solar power
    }
    wasInEclipse = isEclipse;

    if (isEclipse) {
      totalEclipseTime += delta; // Accumulate real-time seconds
      GUIInfo.eclipseTime = totalEclipseTime.toFixed(2); // Display in real-time seconds

      // Decrease battery during eclipse
      const dischargeRatePerSecond = 0.01442; // per simulation second
      batteryPercentage -= dischargeRatePerSecond * delta * SIMULATION_SPEED_FACTOR;
    } else {
      // Increase battery during sunlight, only if solar power is being generated
      if (GUIInfo.solarPower > 0) {
        const chargeRatePerSecond = 0.004335; // per simulation second
        batteryPercentage += chargeRatePerSecond * delta * SIMULATION_SPEED_FACTOR;
      } else {
        // If not in eclipse and solar power is 0, discharge
        const dischargeRatePerSecond = 0.01442; // per simulation second
        batteryPercentage -= dischargeRatePerSecond * delta * SIMULATION_SPEED_FACTOR;
      }
    }

    // Ensure battery percentage stays within 0-100
    batteryPercentage = Math.max(0, Math.min(100, batteryPercentage));
    GUIInfo.batteryPercentage = batteryPercentage.toFixed(2);

    // Set SNR to 0 if battery percentage is 0%
    if (batteryPercentage <= 0) {
      GUIInfo.snr = 0;
    } else {
      // Recalculate or use the initial SNR if battery is not 0
      const currentSnr = computeSNR(); // Recalculate SNR
      GUIInfo.snr = (10 * Math.log10(currentSnr)).toFixed(2);
    }

    if (!isAnimationStopped) {
      GUIInfo.simulationTime = (clock.elapsedTime - solarPanelOpenTime).toFixed(2);
    }
  }

  renderer.render(scene, camera);

  if (!isAnimationStopped) {
    requestAnimationFrame(Animate);
  }
}
Animate();

// Initialize satellite velocity
satellite.velocity = new THREE.Vector3();

// Solar panel normal vectors (initial, in satellite's local coordinate system)
const panelLeftNormal = new THREE.Vector3(0, 0, -1).normalize(); // Facing -Z initially
const panelRightNormal = new THREE.Vector3(0, 0, 1).normalize(); // Facing +Z initially
const panelLeft1Normal = new THREE.Vector3(0, 0, -1).normalize();
const panelLeft2Normal = new THREE.Vector3(0, 0, -1).normalize();
const panelRight1Normal = new THREE.Vector3(0, 0, 1).normalize();
const panelRight2Normal = new THREE.Vector3(0, 0, 1).normalize();

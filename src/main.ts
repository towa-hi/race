import '@melloware/coloris/dist/coloris.css';
import Coloris from '@melloware/coloris';

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const simCanvas = document.getElementById("simCanvas") as HTMLCanvasElement;
const simCtx = simCanvas.getContext("2d")!;
const addHorseBtn = document.getElementById("addHorse") as HTMLButtonElement;
const horseList = document.getElementById("horseList") as HTMLDivElement;
const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
const pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const sBtn = document.getElementById("sBtn") as HTMLButtonElement;

let courseImage: HTMLImageElement | null = null;
let collisionData: Uint8ClampedArray;
const obstacleThreshold = 10;

// Playback state
let isPlaying = false;
let isPaused = false;
let animationFrameId: number | null = null;
let simulationActive = false;
let isPlayback = false;
const playbackFrames = 20 * 60;
let playbackStates: SimState[][] = [];
let playbackFrameIndex = 0;

// Playback control functions
function play() {
  // halt live animation before starting playback
  pause();
  // If already playing back, resume if paused, else do nothing
  if (isPlayback) {
    if (isPlaying) return;
    isPlaying = true;
    playbackStep();
    return;
  }
  // First-time play: generate and cache playback frames
  // Reset horses to their defined start positions and velocities
  horses.forEach(h => {
    h.startX = h.initX;
    h.startY = h.initY;
    h.vx = h.speed * Math.cos(h.startRotation);
    h.vy = h.speed * Math.sin(h.startRotation);
  });
  // Build cache
  playbackStates = [];
  const initial = horses.map(h => ({ x: h.startX, y: h.startY, vx: h.vx, vy: h.vy, radius: h.radius, speed: h.speed }));
  playbackStates[0] = initial;
  for (let i = 1; i < playbackFrames; i++) {
    playbackStates[i] = computeNextStates(playbackStates[i - 1]);
  }
  // Start playback
  isPlayback = true;
  isPaused = false;
  isPlaying = true;
  playbackFrameIndex = 0;
  playbackStep();
}

function playbackStep() {
  if (!isPlayback || !isPlaying) return;
  if (playbackFrameIndex >= playbackFrames) {
    // End of playback cache: act like a pause
    isPlayback = false;
    isPlaying = false;
    isPaused = true;
    playbackStates = [];
    return;
  }
  // Apply cached frame
  const states = playbackStates[playbackFrameIndex];
  states.forEach((s, i) => {
    const h = horses[i];
    h.startX = s.x;
    h.startY = s.y;
    h.vx = s.vx;
    h.vy = s.vy;
  });
  playbackFrameIndex++;
  draw();
  requestAnimationFrame(playbackStep);
}

function pause() {
  if (isPlayback && isPlaying) {
    isPlaying = false;
    isPaused = true;
  }
}

function stop() {
  if (isPlayback || isPlaying || isPaused) {
    isPlaying = false;
    isPaused = false;
    isPlayback = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    simCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);
    horses.forEach(h => {
      h.startX = h.initX;
      h.startY = h.initY;
      h.vx = h.speed * Math.cos(h.startRotation);
      h.vy = h.speed * Math.sin(h.startRotation);
    });
    playbackStates = [];
    playbackFrameIndex = 0;
    // Immediately redraw to show reset positions
    draw();
  }
}

// Simulation state type
interface SimState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

// Compute next states by applying movement, collisions, and bounces
function computeNextStates(states: SimState[]): SimState[] {
  // shallow clone array and objects
  const next = states.map(s => ({ ...s }));
  const len = next.length;
  
  // Obstacle & wall bounces
  next.forEach(s => {
    let newX = s.x + s.vx;
    let newY = s.y + s.vy;
    // obstacle bounce
    for (let i = 0; i < 16; i++) {
      const sa = (2 * Math.PI * i) / 16;
      const sx = newX + s.radius * Math.cos(sa);
      const sy = newY + s.radius * Math.sin(sa);
      if (isObstacle(sx, sy)) {
        let { nx, ny } = getObstacleNormal(sx, sy);
        if (nx === 0 && ny === 0) { nx = Math.cos(sa); ny = Math.sin(sa); }
        const dot = s.vx * nx + s.vy * ny;
        s.vx -= 2 * dot * nx;
        s.vy -= 2 * dot * ny;
        newX = s.x + s.vx;
        newY = s.y + s.vy;
        break;
      }
    }
    // wall bounce
    if (newX - s.radius < 0 || newX + s.radius > canvas.width) {
      s.vx = -s.vx; newX = s.x + s.vx;
    }
    if (newY - s.radius < 0 || newY + s.radius > canvas.height) {
      s.vy = -s.vy; newY = s.y + s.vy;
    }
    s.x = newX;
    s.y = newY;
  });
  
  // Horse–horse collisions
  for (let i = 0; i < len; i++) {
    for (let j = i + 1; j < len; j++) {
      const a = next[i], b = next[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < a.radius + b.radius) {
        const nx = dx / dist, ny = dy / dist;
        const da = a.vx * nx + a.vy * ny;
        const db = b.vx * nx + b.vy * ny;
        a.vx -= 2 * da * nx; a.vy -= 2 * da * ny;
        b.vx -= 2 * db * nx; b.vy -= 2 * db * ny;
        // separate overlap
        const overlap = (a.radius + b.radius - dist) / 2;
        a.x += nx * overlap; a.y += ny * overlap;
        b.x -= nx * overlap; b.y -= ny * overlap;
      }
    }
  }
  
  // normalize speeds
  next.forEach(s => {
    const mag = Math.hypot(s.vx, s.vy);
    if (mag > 0) {
      s.vx = (s.vx / mag) * s.speed;
      s.vy = (s.vy / mag) * s.speed;
    }
  });
  return next;
}

// Refactor simulate() to use computeNextStates
function simulate() {
  pause();
  simCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);
  const frames = 20 * 60;
  const colors = horses.map(h => opaqueColor(h.tint));
  let simStates: SimState[] = horses.map(h => ({ x: h.initX, y: h.initY, vx: h.vx, vy: h.vy, radius: h.radius, speed: h.speed }));
  const prev = simStates.map(s => ({ x: s.x, y: s.y }));
  for (let f = 0; f < frames; f++) {
    simStates = computeNextStates(simStates);
    simStates.forEach((s, idx) => {
      simCtx.beginPath(); simCtx.strokeStyle = colors[idx]; simCtx.lineWidth = 1;
      simCtx.moveTo(prev[idx].x, prev[idx].y); simCtx.lineTo(s.x, s.y); simCtx.stroke();
      prev[idx].x = s.x; prev[idx].y = s.y;
    });
  }
  // draw end circles
  simStates.forEach((s, idx) => {
    simCtx.beginPath(); simCtx.arc(s.x, s.y, s.radius / 2, 0, 2 * Math.PI);
    simCtx.fillStyle = colors[idx]; simCtx.fill();
  });
}

// Add event listeners for playback controls
playBtn.addEventListener("click", play);
pauseBtn.addEventListener("click", pause);
stopBtn.addEventListener("click", stop);

// Add event listener for simulate button
sBtn.addEventListener("click", simulate);

// {{ edit_1: define Horse type and storage }}
interface Horse {
  id: number;
  name: string;
  tint: string;
  speed: number;
  spriteFile: File | null;
  spriteUrl: string;
  previewEl: HTMLDivElement | null;
  image?: HTMLImageElement;
  startX: number;
  startY: number;
  radius: number;
  startRotation: number;
  vx: number; // x velocity component
  vy: number; // y velocity component
  initX: number;   // initial start position X
  initY: number;   // initial start position Y
}
let horses: Horse[] = [];
let horseIdCounter = 1;

// {{ edit_1: move default horse-sprite URL here, before any preload/fetch }}
const testHorseUrl = new URL('./assets/test-horse.png', import.meta.url).href;

// {{ edit_2: preload the default sprite File at startup }}
let defaultHorseSpriteFile: File | null = null;
fetch(testHorseUrl)
  .then(res => res.blob())
  .then(blob => {
    defaultHorseSpriteFile = new File([blob], 'test-horse.png', { type: blob.type });
  });

// Initialize Coloris with our preferred settings
Coloris.init();
Coloris.setInstance('.coloris', {
  theme: 'polaroid',
  themeMode: 'dark',
  formatToggle: false,
  clearButton: false,
  swatches: [
    'rgba(255,255,255,0)',
    'rgba(255,0,0,0.3)',
    'rgba(0,255,0,0.3)',
    'rgba(0,0,255,0.3)',
    'rgba(255,255,0,0.3)',
    'rgba(0,255,255,0.3)',
  ]
});

// helper: force color to full‐alpha for outlines
function opaqueColor(color: string): string {
  const { r, g, b } = rgbaToComponents(color);
  return `rgba(${r},${g},${b},1)`;
}

// Central draw function for normal rendering and playback mode
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Draw course background
  if (courseImage) ctx.drawImage(courseImage, 0, 0, canvas.width, canvas.height);
  // In normal mode, overlay obstacles
  if (!isPlayback && development && collisionData) {
    const overlay = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < collisionData.length; i += 4) {
      if (collisionData[i + 3] > obstacleThreshold) {
        overlay.data[i    ] = 255;
        overlay.data[i + 1] = 0;
        overlay.data[i + 2] = 0;
        overlay.data[i + 3] = 80;
      }
    }
    ctx.putImageData(overlay, 0, 0);
  }
  // Draw all horses
  horses.forEach(h => {
    if (!h.image) return;
    const d = h.radius * 2;
    const x = h.startX - d / 2;
    const y = h.startY - d / 2;
    ctx.drawImage(h.image, x, y, d, d);
    applyTintToCanvas(ctx, h.tint, x, y, d, d);
    if (!isPlayback && development) {
      // debug circle
      ctx.save(); ctx.globalAlpha = 1;
      ctx.strokeStyle = opaqueColor(h.tint);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.startX, h.startY, h.radius, 0, 2*Math.PI); ctx.stroke();
      // debug direction
      const dir = Math.atan2(h.vy, h.vx);
      ctx.beginPath(); ctx.moveTo(h.startX, h.startY);
      ctx.lineTo(h.startX + h.radius * Math.cos(dir), h.startY + h.radius * Math.sin(dir));
      ctx.stroke();
      ctx.restore();
    }
  });
  // Schedule next draw only in normal live mode (not playback)
  if (!isPlayback) requestAnimationFrame(draw);
}

// {{ edit_2: define URL to the test image in src/assets }}
const testCourseUrl = new URL('./assets/test-course.png', import.meta.url).href;

// {{ edit_2: use development flag to auto-load the asset from src/assets }}
const development = true;

function prepareCollisionMap() {
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext('2d')!;
  offCtx.drawImage(courseImage!, 0, 0, canvas.width, canvas.height);
  collisionData = offCtx.getImageData(0, 0, canvas.width, canvas.height).data;
}

function isObstacle(x: number, y: number): boolean {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= canvas.width || yi >= canvas.height) return true;
  // alpha channel lives at index +3
  return collisionData[(yi * canvas.width + xi) * 4 + 3] > obstacleThreshold;
}

// Helper: compute obstacle surface normal via alpha gradient
function getObstacleNormal(x: number, y: number): { nx: number; ny: number } {
  const xi = Math.round(x);
  const yi = Math.round(y);
  const w = canvas.width;
  const h = canvas.height;
  function alphaAt(px: number, py: number): number {
    if (px < 0 || py < 0 || px >= w || py >= h) return 0;
    return collisionData[(py * w + px) * 4 + 3];
  }
  const ax = alphaAt(xi + 1, yi) - alphaAt(xi - 1, yi);
  const ay = alphaAt(xi, yi + 1) - alphaAt(xi, yi - 1);
  const len = Math.hypot(ax, ay);
  if (len < 1e-6) {
    return { nx: 0, ny: 0 };
  }
  return { nx: ax / len, ny: ay / len };
}

if (development) {
  const img = new Image();
  img.onload = () => {
    courseImage = img;
    prepareCollisionMap();
  };
  img.src = testCourseUrl;
} else {
  // show modal at first
  const modal = document.createElement("div");
  modal.id = "modal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.right = "0";
  modal.style.bottom = "0";
  modal.style.background = "rgba(0,0,0,0.8)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = "1000";

  modal.innerHTML = `
    <div id="modal-content">
      <h2>Select a transparent PNG for your course</h2>
      <input type="file" id="modalCourseInput" accept="image/png" /><br/><br/>
      <button id="modalAccept">Continue</button>
    </div>
  `;
  document.body.appendChild(modal);

  (document.getElementById("modalAccept") as HTMLButtonElement).onclick = () => {
    const fileInput = document.getElementById("modalCourseInput") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) {
      alert("Please select a PNG file for the course.");
      return;
    }
    if (file.type !== "image/png") {
      alert("Only PNG files are allowed.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        courseImage = img;
        prepareCollisionMap();
        modal.remove();
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
}

// {{ edit: add helper functions to manage Horse objects by ID }}
function getHorseById(id: number): Horse | undefined {
  return horses.find(h => h.id === id);
}

function updateHorseName(id: number, name: string) {
  const horse = getHorseById(id);
  if (!horse) return;
  horse.name = name;
  if (development) console.log(`Horse ${id} name updated:`, horse);
}

function updateHorseTint(id: number, tint: string) {
  const horse = getHorseById(id);
  if (!horse) return;
  horse.tint = tint;
  if (development) console.log(`Horse ${id} tint updated:`, horse);
  renderHorsePreview(horse);
}

function updateHorseSpeed(id: number, speed: number) {
  const horse = getHorseById(id);
  if (!horse) return;
  horse.speed = speed;
  if (development) console.log(`Horse ${id} speed updated:`, horse);
}

function updateHorseRadius(id: number, radius: number) {
  const horse = getHorseById(id);
  if (!horse) return;
  horse.radius = radius;
  if (development) console.log(`Horse ${id} radius updated:`, horse);
}

function renderHorsePreview(horse: Horse) {
  if (!horse.previewEl || !horse.image) return;
  
  // Clear the preview element
  horse.previewEl.innerHTML = '';
  
  // Create preview canvas
  const canvas = document.createElement('canvas');
  const size = 50; // Preview size
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  
  const ctx = canvas.getContext('2d')!;
  
  // Draw sprite
  ctx.drawImage(horse.image, 0, 0, size, size);
  
  // Apply tint
  applyTintToCanvas(ctx, horse.tint, 0, 0, size, size);
  
  horse.previewEl.appendChild(canvas);
}

/**
 * Reads a File, updates spriteFile & spriteUrl on the horse,
 * and returns a Promise that resolves to the data-URL.
 */
function loadHorseSpriteFile(id: number, file: File): Promise<string> {
  const horse = getHorseById(id);
  if (!horse) return Promise.reject(`No horse with id ${id}`);
  return new Promise(resolve => {
    horse.spriteFile = file;
    if (development) console.log(`Horse ${id} spriteFile set:`, file);
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      horse.spriteUrl = url;
      if (development) console.log(`Horse ${id} spriteUrl set:`, url, horse);
      resolve(url);
    };
    reader.readAsDataURL(file);
  });
}

// {{ edit_delete_1: encapsulate deleteHorse logic }}
function deleteHorse(id: number, horseEl: HTMLDivElement) {
  // remove DOM element
  horseEl.remove();
  // remove from data store
  horses = horses.filter(h => h.id !== id);
  // log in development
  if (development) {
    console.log(`Deleted horse ${id}. Remaining horses:`, horses);
  }
}

// Helper functions to convert between hex/rgba and extract components
function rgbaToComponents(color: string): { r: number, g: number, b: number, a: number } {
  // Handle rgba format
  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: parseFloat(rgbaMatch[4])
    };
  }

  // Handle hex format with alpha
  const hex = color.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: parseInt(hex.slice(6, 8), 16) / 255
  };
}

// {{ edit_1: encapsulate the "add horse" logic into its own function }}
function addHorse() {
  const id = horseIdCounter++;
  // set initial position
  const initX = canvas.width / 2;
  const initY = canvas.height / 2;
  const rotation = Math.random() * 2 * Math.PI;
  const speedVal = 3;
  const horse: Horse = {
    id,
    name: "",
    tint: "#ffffff00",
    speed: speedVal,
    vx: speedVal * Math.cos(rotation),
    vy: speedVal * Math.sin(rotation),
    spriteFile: defaultHorseSpriteFile,
    spriteUrl: testHorseUrl,
    previewEl: null,
    startX: initX,
    startY: initY,
    initX,
    initY,
    radius: 16,
    startRotation: rotation
  };

  horses.push(horse);

  const horseEl = document.createElement("div");
  horseEl.style.border = "1px solid #666";
  horseEl.style.padding = "8px";
  horseEl.style.marginBottom = "8px";
  horseEl.style.position = "relative";
  horseEl.dataset.id = id.toString();

  horseEl.innerHTML = `
    <div class="horse-top" style="display:flex; align-items:center; justify-content:space-between;">
      <input id="name-${id}" type="text" class="horse-name" placeholder="Horse Name" style="flex:1; margin-right:8px;" />
      <button class="delete-horse" style="background:none; border:none; color:#f00; font-size:16px; cursor:pointer;">×</button>
    </div>
    <div class="horse-sprite" style="display:flex; align-items:center; margin-top:8px;">
      <div class="sprite-preview" style="width:50px; height:50px; border:1px solid #666; margin-right:8px;"></div>
      <button class="choose-sprite" style="flex-shrink:0;">Choose Sprite</button>
      <input id="sprite-${id}" type="file" accept="image/*" class="sprite-input" style="display:none" />
    </div>
    <div class="horse-settings" style="display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: auto; row-gap: 4px; column-gap: 12px; margin-top: 8px;">
      <label for="tint-${id}" style="text-align: center;">Tint:</label>
      <label for="speed-${id}" style="text-align: center;">Speed:</label>
      <label for="radius-${id}" style="text-align: center;">Radius:</label>
      <input id="tint-${id}" type="text" class="coloris" value="${horse.tint}" data-coloris style="width: 100%;" />
      <input id="speed-${id}" type="number" class="horse-speed" value="${horse.speed}" min="1" max="10" step="0.1" style="width: 100%;" />
      <input id="radius-${id}" type="number" class="horse-radius" value="${horse.radius}" min="1" step="1" style="width: 100%;" />
    </div>
  `;

  horseList.insertBefore(horseEl, addHorseBtn);

  // Get references to all inputs
  const nameInputEl = horseEl.querySelector(".horse-name") as HTMLInputElement;
  const tintInputEl = horseEl.querySelector(".coloris") as HTMLInputElement;
  const speedInputEl = horseEl.querySelector(".horse-speed") as HTMLInputElement;
  const radiusInputEl = horseEl.querySelector(".horse-radius") as HTMLInputElement;
  const spriteInputEl = horseEl.querySelector(".sprite-input") as HTMLInputElement;
  const previewEl = horseEl.querySelector(".sprite-preview") as HTMLDivElement;

  // Store preview element reference
  horse.previewEl = previewEl;

  // Wire up input handlers
  nameInputEl.addEventListener("input", () => {
    updateHorseName(id, nameInputEl.value);
  });

  // Coloris color change handler
  tintInputEl.addEventListener("input", () => {
    updateHorseTint(id, tintInputEl.value);
  });

  speedInputEl.addEventListener("input", () => {
    updateHorseSpeed(id, parseFloat(speedInputEl.value) || horse.speed);
  });

  radiusInputEl.addEventListener("input", () => {
    updateHorseRadius(id, parseInt(radiusInputEl.value) || horse.radius);
  });

  // Handle sprite file selection
  horseEl.querySelector(".choose-sprite")!.addEventListener("click", () => spriteInputEl.click());
  spriteInputEl.addEventListener("change", async () => {
    const file = spriteInputEl.files?.[0];
    if (!file) return;
    const url = await loadHorseSpriteFile(id, file);
    const img = new Image();
    img.onload = () => {
      horse.image = img;
      renderHorsePreview(horse);
    };
    img.src = url;
  });

  // Load initial sprite
  const initialImg = new Image();
  initialImg.onload = () => {
    horse.image = initialImg;
    renderHorsePreview(horse);
  };
  initialImg.src = horse.spriteUrl;

  // Handle deletion
  const deleteBtn = horseEl.querySelector(".delete-horse") as HTMLButtonElement;
  deleteBtn.addEventListener("click", () => {
    deleteHorse(id, horseEl);
  });
}

// {{ edit_2: replace inline listener with the new function reference }}
addHorseBtn.addEventListener("click", addHorse);

// DEBUG: give every <div> a unique HSL border
document.querySelectorAll('div').forEach((div, i) => {
  const hue = (i * 40) % 360;
  div.style.border = `2px solid hsl(${hue},70%,50%)`;
});

function applyTintToCanvas(
  ctx: CanvasRenderingContext2D,
  tint: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();
  const { a } = rgbaToComponents(tint);
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

// {{ edit_drag: enable dragging of horses on canvas }}
let draggingHorse: Horse | null = null;

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  // pick topmost horse under cursor
  for (let i = horses.length - 1; i >= 0; i--) {
    const h = horses[i];
    if (Math.hypot(x - h.startX, y - h.startY) <= h.radius) {
      draggingHorse = h;
      break;
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!draggingHorse) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width  / rect.width);
  const y = (e.clientY - rect.top ) * (canvas.height / rect.height);
  updateHorseStartPosition(draggingHorse.id, x, y);
});

canvas.addEventListener("mouseup",   () => { draggingHorse = null; });
canvas.addEventListener("mouseleave", () => { draggingHorse = null; });

// {{ edit_drag: extract start‐position update into its own function }}
function updateHorseStartPosition(id: number, x: number, y: number) {
  const horse = getHorseById(id);
  if (!horse) return;
  // update initial and current positions when dragging
  horse.initX = x;
  horse.initY = y;
  horse.startX = x;
  horse.startY = y;
  if (development) console.log(`Horse ${id} start position updated:`, horse);
}

// Start live rendering loop
draw();

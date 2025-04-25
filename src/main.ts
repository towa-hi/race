import '@melloware/coloris/dist/coloris.css';
import Coloris from '@melloware/coloris';

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const courseInput = document.getElementById("courseInput") as HTMLInputElement;
const spriteInput = document.getElementById("spriteInput") as HTMLInputElement;
const tintInput = document.getElementById("tintInput") as HTMLInputElement;
const nameInput = document.getElementById("nameInput") as HTMLInputElement;
const speedInput = document.getElementById("speedInput") as HTMLInputElement;
const addHorseBtn = document.getElementById("addHorse") as HTMLButtonElement;

const horseList = document.getElementById("horseList") as HTMLDivElement;

let courseImage: HTMLImageElement | null = null;

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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (courseImage) {
    ctx.drawImage(courseImage, 0, 0, canvas.width, canvas.height);
  }

  horses.forEach(h => {
    if (!h.image) return;

    const diameter = h.radius * 2;
    const x = h.startX - diameter / 2;
    const y = h.startY - diameter / 2;

    // draw the base sprite
    ctx.drawImage(h.image, x, y, diameter, diameter);

    // apply tint
    applyTintToCanvas(ctx, h.tint, x, y, diameter, diameter);

    // development mode radius circle
    if (development) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = h.tint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.startX, h.startY, h.radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  });

  requestAnimationFrame(draw);
}
draw();

// {{ edit_2: define URL to the test image in src/assets }}
const testCourseUrl = new URL('./assets/test-course.png', import.meta.url).href;

// {{ edit_2: use development flag to auto-load the asset from src/assets }}
const development = true;

if (development) {
  const img = new Image();
  img.onload = () => {
    courseImage = img;
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
  
  // Draw radius circle in development mode
  if (development) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = horse.tint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/4, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
  
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

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// {{ edit_1: encapsulate the "add horse" logic into its own function }}
function addHorse() {
  const id = horseIdCounter++;
  const horse: Horse = {
    id,
    name: "",
    tint: "#ffffff00",  // Changed from "rgba(255,255,255,0)" to hex format
    speed: 3,
    spriteFile: defaultHorseSpriteFile,
    spriteUrl: testHorseUrl,
    previewEl: null,
    startX: canvas.width / 2,
    startY: canvas.height / 2,
    radius: 16
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
    <div class="horse-settings" style="display:flex; align-items:center; margin-top:8px;">
      <label for="tint-${id}" style="margin-right:12px;">
        Tint:
        <input id="tint-${id}" 
               type="text" 
               class="coloris" 
               value="${horse.tint}"
               data-coloris 
               style="width:120px;" />
      </label>
      <label for="speed-${id}" style="margin-left:12px;">
        Speed:
        <input id="speed-${id}" type="number" class="horse-speed" value="${horse.speed}" min="1" max="10" step="0.1" style="width:60px;" />
      </label>
      <label style="margin-left:12px;">
        Radius:
        <input id="radius-${id}" type="number" class="horse-radius"
               value="${horse.radius}" min="1" step="1"
               style="width:60px;" />
      </label>
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

function applyTintToCanvas(ctx: CanvasRenderingContext2D, tint: string, x: number, y: number, width: number, height: number) {
  // Create temp canvas to isolate sprite pixels
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;

  // Copy just the sprite area
  tempCtx.drawImage(ctx.canvas, x, y, width, height, 0, 0, width, height);

  // Apply tint to temp canvas
  tempCtx.save();
  const { a } = rgbaToComponents(tint);
  tempCtx.globalAlpha = a;
  tempCtx.globalCompositeOperation = 'source-atop';
  tempCtx.fillStyle = tint;
  tempCtx.fillRect(0, 0, width, height);
  tempCtx.restore();

  // Draw tinted result back to main canvas
  ctx.drawImage(tempCanvas, x, y);
}

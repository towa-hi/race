interface Horse {
  id: number;
  name: string;
  tint: string;
  speed: number;
  spriteFile: File | null;
  spriteUrl: string;
  previewEl: HTMLDivElement | null;
  image?: HTMLImageElement;
  tintAlpha: number;
}
let horses: Horse[] = [];
let horseIdCounter = 1;

addHorseBtn.addEventListener("click", () => {
  const id = horseIdCounter++;
  const horse: Horse = { id, name: "", tint: "#ffffff", speed: 3, spriteFile: null, spriteUrl: testHorseUrl, previewEl: null, tintAlpha: 1 };
  horses.push(horse);

  const horseEl = document.createElement("div");
  horseEl.style.border = "1px solid #666";
  horseEl.style.padding = "8px";
  horseEl.style.marginBottom = "8px";
  horseEl.style.position = "relative";
  horseEl.dataset.id = id.toString();

  // … existing markup and wiring …

  const deleteBtn = horseEl.querySelector(".delete-horse") as HTMLButtonElement;
  deleteBtn.addEventListener("click", () => {
    horseEl.remove();
    horses = horses.filter(h => h.id !== id);
  });

  // grab the inputs & preview
  const nameInputEl   = horseEl.querySelector(".horse-name")  as HTMLInputElement;
  const tintInputEl   = horseEl.querySelector(".horse-tint")  as HTMLInputElement;
  const speedInputEl  = horseEl.querySelector(".horse-speed") as HTMLInputElement;
  const spriteInputEl = horseEl.querySelector(".sprite-input") as HTMLInputElement;
  const previewEl     = horseEl.querySelector(".sprite-preview") as HTMLDivElement;
  horse.previewEl = previewEl;

  // {{ edit_3: wire inputs to the new updater functions }}
  nameInputEl.addEventListener("input", () => {
    updateHorseName(id, nameInputEl.value);
  });

  tintInputEl.addEventListener("input", () => {
    updateHorseTint(id, tintInputEl.value);
  });

  speedInputEl.addEventListener("input", () => {
    updateHorseSpeed(id, parseFloat(speedInputEl.value) || horse.speed);
  });

  // {{ edit_4: use the loadHorseSpriteFile helper }}
  spriteInputEl.addEventListener("change", async () => {
    const file = spriteInputEl.files?.[0];
    if (!file) return;
    const url = await loadHorseSpriteFile(id, file);
    // update the preview
    previewEl.innerHTML = "";
    const img = new Image();
    img.src = url;
    img.style.width  = "100%";
    img.style.height = "100%";
    img.style.filter = `drop-shadow(0 0 0 ${horse.tint})`;
    previewEl.appendChild(img);

    // when image is loaded, render preview
    img.onload = () => {
      horse.image = img;
      renderHorsePreview(horse);
    };
  });
});

// {{ edit_1: helper to find a horse by ID }}
function getHorseById(id: number): Horse | undefined {
  return horses.find(h => h.id === id);
}

// {{ edit_2: functions to update individual horse properties }}
function updateHorseName(id: number, name: string) {
  const horse = getHorseById(id);
  if (!horse) return;
  horse.name = name;
  if (development) console.log(`Horse ${id} name updated:`, horse);
}

function updateHorseTint(id: number, tintRgba: string) {
  const horse = getHorseById(id);
  if (!horse) return;
  horse.tint = tintRgba;
  // extract alpha from RGBA
  horse.tintAlpha = parseFloat(tintRgba.split(',')[3]);
  if (development) console.log(`Horse ${id} tint updated:`, horse);
  // re-render preview
  renderHorsePreview(horse);
}

function updateHorseSpeed(id: number, speed: number) {
  const horse = getHorseById(id);
  if (!horse) return;
  horse.speed = speed;
  if (development) console.log(`Horse ${id} speed updated:`, horse);
}

/**
 * Reads a File, updates spriteFile & spriteUrl on the horse,
 * and returns a Promise that resolves to the data-URL.
 */
function loadHorseSpriteFile(id: number, file: File): Promise<string> {
  const horse = getHorseById(id);
  if (!horse) return Promise.reject(`No horse with id ${id}`);
  return new Promise((resolve) => {
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

/**
 * {{ edit: render a horse preview into its previewEl using canvas + same tint logic }}
 */
function renderHorsePreview(horse: Horse) {
  if (!horse.previewEl || !horse.image) return;
  // clear any existing children
  horse.previewEl.innerHTML = '';
  // create preview canvas
  const c = document.createElement('canvas');
  const size = 50;
  c.width = size;
  c.height = size;
  const cctx = c.getContext('2d')!;
  // draw sprite scaled to fit
  cctx.drawImage(horse.image, 0, 0, size, size);
  // apply tint overlay
  cctx.save();
  cctx.globalAlpha = horse.tintAlpha;
  cctx.globalCompositeOperation = 'source-atop';
  cctx.fillStyle = horse.tint;
  cctx.fillRect(0, 0, size, size);
  cctx.restore();
  horse.previewEl.appendChild(c);
}
const promptEl = document.getElementById("prompt");
const editPromptEl = document.getElementById("editPrompt");
const editSectionEl = document.getElementById("editSection");
const sizeEl = document.getElementById("size");
const qualityEl = document.getElementById("quality");
const formatEl = document.getElementById("format");
const compressionEl = document.getElementById("compression");
const generateBtn = document.getElementById("generate");
const editBtn = document.getElementById("edit");
const referenceImagesInputEl = document.getElementById("referenceImages");
const clearReferencesBtn = document.getElementById("clearReferences");
const referenceSummaryEl = document.getElementById("referenceSummary");
const editReferenceImagesInputEl = document.getElementById("editReferenceImages");
const clearEditReferencesBtn = document.getElementById("clearEditReferences");
const editReferenceSummaryEl = document.getElementById("editReferenceSummary");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const downloadEl = document.getElementById("download");
const historyEl = document.getElementById("history");

const imageHistory = [];
const allowedSourceMimeTypes = new Set(["image/jpeg", "image/png"]);
let referenceImages = [];
let editReferenceImages = [];
let selectedId = null;
const SETTINGS_STORAGE_KEY = "mini-dalle-settings-v1";

function setButtons(disabled) {
  generateBtn.disabled = disabled;
  editBtn.disabled = disabled;
}

function setEditUIVisible(visible) {
  editSectionEl.style.display = visible ? "block" : "none";
  editBtn.style.display = visible ? "inline-block" : "none";
}

function getSelectedSize() {
  const size = sizeEl.value;
  const allowed = new Set(["1024x1024", "1024x1536", "1536x1024"]);
  if (!allowed.has(size)) {
    return {
      size: null,
      error: "Unsupported size. Use 1024x1024, 1024x1536, or 1536x1024."
    };
  }
  return { size, error: null };
}

function saveSettings() {
  const payload = {
    size: sizeEl.value,
    quality: qualityEl.value,
    output_format: formatEl.value,
    output_compression: compressionEl.value
  };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.size === "string") sizeEl.value = parsed.size;
    if (typeof parsed.quality === "string") qualityEl.value = parsed.quality;
    if (typeof parsed.output_format === "string") formatEl.value = parsed.output_format;
    if (parsed.output_compression !== undefined && parsed.output_compression !== null) {
      compressionEl.value = String(parsed.output_compression);
    }
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  }
}

function getSelectedRenderSettings() {
  const { size, error: sizeError } = getSelectedSize();
  if (!size) {
    return { settings: null, error: sizeError };
  }
  const quality = qualityEl.value;
  const output_format = formatEl.value;
  const output_compression = Number.parseInt(compressionEl.value, 10);
  const allowedQualities = new Set(["low", "medium", "high"]);
  const allowedFormats = new Set(["jpeg", "png"]);

  if (!allowedQualities.has(quality)) {
    return { settings: null, error: "Unsupported quality. Use low, medium, or high." };
  }
  if (!allowedFormats.has(output_format)) {
    return { settings: null, error: "Unsupported format. Use jpeg or png." };
  }
  if (!Number.isInteger(output_compression) || output_compression < 0 || output_compression > 100) {
    return { settings: null, error: "Compression must be an integer from 0 to 100." };
  }

  return {
    settings: { size, quality, output_format, output_compression },
    error: null
  };
}

function getFileExtensionFromMimeType(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "bin";
}

function renderReferenceSummary() {
  if (!referenceImages.length) {
    referenceSummaryEl.textContent = "No reference images selected.";
    return;
  }

  const names = referenceImages.map((file) => file.name).join(", ");
  referenceSummaryEl.textContent = "Using " + referenceImages.length + " reference image(s): " + names;
}

function renderEditReferenceSummary() {
  if (!editReferenceImages.length) {
    editReferenceSummaryEl.textContent = "No edit reference images selected.";
    return;
  }

  const names = editReferenceImages.map((file) => file.name).join(", ");
  editReferenceSummaryEl.textContent =
    "Using " + editReferenceImages.length + " edit reference image(s): " + names;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const commaIndex = dataUrl.indexOf(",");
      resolve(commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error("Failed to read " + file.name));
    reader.readAsDataURL(file);
  });
}

async function updateReferenceImagesFromInput() {
  const files = Array.from(referenceImagesInputEl.files || []);
  if (files.length > 4) {
    referenceImages = [];
    referenceImagesInputEl.value = "";
    renderReferenceSummary();
    throw new Error("You can upload up to 4 reference images.");
  }

  const next = [];
  for (const file of files) {
    if (!allowedSourceMimeTypes.has(file.type)) {
      referenceImages = [];
      referenceImagesInputEl.value = "";
      renderReferenceSummary();
      throw new Error("Unsupported file type for " + file.name + ". Use PNG or JPEG.");
    }
    next.push({
      name: file.name,
      mime_type: file.type,
      b64: await readFileAsBase64(file)
    });
  }

  referenceImages = next;
  renderReferenceSummary();
}

async function updateEditReferenceImagesFromInput() {
  const files = Array.from(editReferenceImagesInputEl.files || []);
  if (files.length > 4) {
    editReferenceImages = [];
    editReferenceImagesInputEl.value = "";
    renderEditReferenceSummary();
    throw new Error("You can upload up to 4 edit reference images.");
  }

  const next = [];
  for (const file of files) {
    if (!allowedSourceMimeTypes.has(file.type)) {
      editReferenceImages = [];
      editReferenceImagesInputEl.value = "";
      renderEditReferenceSummary();
      throw new Error("Unsupported file type for " + file.name + ". Use PNG or JPEG.");
    }
    next.push({
      name: file.name,
      mime_type: file.type,
      b64: await readFileAsBase64(file)
    });
  }

  editReferenceImages = next;
  renderEditReferenceSummary();
}

function normalizeHistoryEntry(entry) {
  return {
    id: entry.id,
    b64: entry.b64,
    mimeType: entry.mime_type || entry.mimeType || "image/png",
    originPrompt: entry.origin_prompt || entry.originPrompt || "",
    parentId: entry.parent_id ?? entry.parentId ?? null
  };
}

function renderHistory() {
  historyEl.innerHTML = "";
  for (const item of imageHistory) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb";
    button.dataset.id = String(item.id);
    button.title = item.originPrompt || "Generated image";

    const img = document.createElement("img");
    img.alt = "Generated thumbnail";
    img.src = "data:" + (item.mimeType || "image/png") + ";base64," + item.b64;
    button.appendChild(img);
    button.addEventListener("click", () => selectImage(item.id));

    historyEl.appendChild(button);
  }
}

function selectImage(id) {
  selectedId = id;
  const item = imageHistory.find((entry) => entry.id === id);
  if (!item) return;

  setEditUIVisible(true);
  const mimeType = item.mimeType || "image/png";
  const imageDataUrl = "data:" + mimeType + ";base64," + item.b64;
  previewEl.src = imageDataUrl;
  previewEl.style.display = "block";
  downloadEl.href = imageDataUrl;
  downloadEl.download = "mini-dalle-image." + getFileExtensionFromMimeType(mimeType);
  downloadEl.style.display = "inline-block";

  for (const thumb of historyEl.querySelectorAll(".thumb")) {
    thumb.classList.toggle("active", thumb.dataset.id === String(id));
  }
}

function addToHistory(entry) {
  const item = normalizeHistoryEntry(entry);
  const existingIndex = imageHistory.findIndex((it) => it.id === item.id);
  if (existingIndex >= 0) {
    imageHistory.splice(existingIndex, 1);
  }
  imageHistory.unshift(item);
  renderHistory();
  selectImage(item.id);
}

async function requestJSON(path, payload, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function loadHistory() {
  try {
    const data = await requestJSON("/api/history", undefined, "GET");
    const normalized = Array.isArray(data.items) ? data.items.map(normalizeHistoryEntry) : [];
    imageHistory.splice(0, imageHistory.length, ...normalized);
    renderHistory();
    if (imageHistory.length) {
      selectImage(imageHistory[0].id);
    }
  } catch (error) {
    statusEl.textContent = "Error loading history: " + (error?.message || "Unknown error");
  }
}

async function generateImage() {
  const prompt = promptEl.value.trim();
  const { settings, error } = getSelectedRenderSettings();

  if (!prompt) {
    statusEl.textContent = "Please enter a base prompt.";
    return;
  }
  if (!settings) {
    statusEl.textContent = error;
    return;
  }

  saveSettings();
  setButtons(true);
  statusEl.textContent = "Generating image...";

  try {
    const payload = { prompt, ...settings };
    if (referenceImages.length) {
      payload.reference_images = referenceImages;
    }

    const data = await requestJSON("/api/generate", payload);
    addToHistory(data.history_item || { b64: data.b64, mime_type: data.mime_type, origin_prompt: prompt });
    statusEl.textContent = "Done.";
  } catch (requestError) {
    statusEl.textContent = "Error: " + (requestError?.message || "Unknown error");
  } finally {
    setButtons(false);
  }
}

async function editImage() {
  const prompt = editPromptEl.value.trim();
  const { settings, error } = getSelectedRenderSettings();
  const base = imageHistory.find((entry) => entry.id === selectedId);

  if (!base) {
    statusEl.textContent = "Generate an image first, then select one to edit.";
    return;
  }
  if (!settings) {
    statusEl.textContent = error;
    return;
  }
  if (!prompt) {
    statusEl.textContent = "Please enter what you want to change.";
    return;
  }

  saveSettings();
  setButtons(true);
  statusEl.textContent = "Editing image...";

  try {
    const payload = {
      prompt,
      ...settings,
      image_b64: base.b64,
      image_mime_type: base.mimeType || "image/png",
      parent_id: base.id
    };
    if (editReferenceImages.length) {
      payload.reference_images = editReferenceImages;
    }

    const data = await requestJSON("/api/edit", payload);
    addToHistory(data.history_item || { b64: data.b64, mime_type: data.mime_type, origin_prompt: prompt });
    statusEl.textContent = "Edit complete.";
  } catch (requestError) {
    statusEl.textContent = "Error: " + (requestError?.message || "Unknown error");
  } finally {
    setButtons(false);
  }
}

generateBtn.addEventListener("click", generateImage);
editBtn.addEventListener("click", editImage);
sizeEl.addEventListener("change", saveSettings);
qualityEl.addEventListener("change", saveSettings);
formatEl.addEventListener("change", saveSettings);
compressionEl.addEventListener("change", saveSettings);
referenceImagesInputEl.addEventListener("change", async () => {
  try {
    await updateReferenceImagesFromInput();
  } catch (error) {
    statusEl.textContent = "Error: " + (error?.message || "Invalid reference image");
  }
});
clearReferencesBtn.addEventListener("click", () => {
  referenceImages = [];
  referenceImagesInputEl.value = "";
  renderReferenceSummary();
});
editReferenceImagesInputEl.addEventListener("change", async () => {
  try {
    await updateEditReferenceImagesFromInput();
  } catch (error) {
    statusEl.textContent = "Error: " + (error?.message || "Invalid edit reference image");
  }
});
clearEditReferencesBtn.addEventListener("click", () => {
  editReferenceImages = [];
  editReferenceImagesInputEl.value = "";
  renderEditReferenceSummary();
});

loadSettings();
renderReferenceSummary();
renderEditReferenceSummary();
setEditUIVisible(false);
await loadHistory();

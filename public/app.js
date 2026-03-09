const MAX_IMAGES_PER_TAB = 10;
const DB_NAME = "dalle-goblin";
const DB_VERSION = 1;
const CREATE_STORE = "create_history";
const EDIT_STORE = "edit_history";

const tabCreateEl = document.getElementById("tabCreate");
const tabEditEl = document.getElementById("tabEdit");
const createPanelEl = document.getElementById("createPanel");
const editPanelEl = document.getElementById("editPanel");

const promptEl = document.getElementById("prompt");
const quickEditPromptEl = document.getElementById("quickEditPrompt");
const externalEditPromptEl = document.getElementById("externalEditPrompt");

const sizeEl = document.getElementById("size");
const qualityEl = document.getElementById("quality");
const formatEl = document.getElementById("format");
const compressionEl = document.getElementById("compression");
const toggleApiKeyPanelBtn = document.getElementById("toggleApiKeyPanel");
const apiKeyPanelBodyEl = document.getElementById("apiKeyPanelBody");
const userApiKeyEl = document.getElementById("userApiKey");
const saveUserApiKeyBtn = document.getElementById("saveUserApiKey");
const clearUserApiKeyBtn = document.getElementById("clearUserApiKey");
const editUserApiKeyBtn = document.getElementById("editUserApiKey");
const savedApiKeyDisplayEl = document.getElementById("savedApiKeyDisplay");
const apiKeyModeHintEl = document.getElementById("apiKeyModeHint");

const generateBtn = document.getElementById("generate");
const quickEditBtn = document.getElementById("quickEdit");
const externalEditBtn = document.getElementById("externalEdit");

const referenceImagesInputEl = document.getElementById("referenceImages");
const clearReferencesBtn = document.getElementById("clearReferences");
const referenceSummaryEl = document.getElementById("referenceSummary");

const quickEditReferenceImagesInputEl = document.getElementById("quickEditReferenceImages");
const clearQuickEditReferencesBtn = document.getElementById("clearQuickEditReferences");
const quickEditReferenceSummaryEl = document.getElementById("quickEditReferenceSummary");

const externalSourceImageInputEl = document.getElementById("externalSourceImage");
const clearExternalSourceImageBtn = document.getElementById("clearExternalSourceImage");
const externalSourceSummaryEl = document.getElementById("externalSourceSummary");
const externalPreviewCanvasEl = document.getElementById("externalPreviewCanvas");
const externalPreviewEl = document.getElementById("externalPreview");

const externalEditReferenceImagesInputEl = document.getElementById("externalEditReferenceImages");
const clearExternalEditReferencesBtn = document.getElementById("clearExternalEditReferences");
const externalEditReferenceSummaryEl = document.getElementById("externalEditReferenceSummary");
const externalResultPreviewEl = document.getElementById("externalResultPreview");

const quickEditCardEl = document.getElementById("quickEditCard");
const selectedGeneratedInfoEl = document.getElementById("selectedGeneratedInfo");
const quickEditStatusEl = document.getElementById("quickEditStatus");
const createStatusEl = document.getElementById("createStatus");
const editStatusEl = document.getElementById("editStatus");
const createPreviewCanvasEl = document.getElementById("createPreviewCanvas");
const previewEl = document.getElementById("preview");
const editResultCanvasEl = document.getElementById("editResultCanvas");
const createHistoryEl = document.getElementById("createHistory");
const editHistoryEl = document.getElementById("editHistory");
const createHistoryCountEl = document.getElementById("createHistoryCount");
const editHistoryCountEl = document.getElementById("editHistoryCount");
const clearCreateHistoryBtn = document.getElementById("clearCreateHistory");
const clearEditHistoryBtn = document.getElementById("clearEditHistory");
const quickDownloadEl = document.getElementById("quickDownload");
const externalDownloadEl = document.getElementById("externalDownload");
const paywallModalEl = document.getElementById("paywallModal");
const paywallCloseEl = document.getElementById("paywallClose");
const paywallMessageEl = document.getElementById("paywallMessage");
const paywallOptionsEl = document.getElementById("paywallOptions");
const paywallUseOwnKeyEl = document.getElementById("paywallUseOwnKey");
const paywallSubscribeOptionEl = document.getElementById("paywallSubscribeOption");
const paywallInterestFormEl = document.getElementById("paywallInterestForm");
const interestEmailEl = document.getElementById("interestEmail");
const interestWillingnessEl = document.getElementById("interestWillingness");
const interestCommentsEl = document.getElementById("interestComments");
const interestErrorEl = document.getElementById("interestError");
const interestSubmitEl = document.getElementById("interestSubmit");
const interestBackEl = document.getElementById("interestBack");
const contactEmailEl = document.getElementById("contactEmail");
const contactMessageEl = document.getElementById("contactMessage");
const contactWebsiteEl = document.getElementById("contactWebsite");
const contactSubmitEl = document.getElementById("contactSubmit");
const contactStatusEl = document.getElementById("contactStatus");
const openContactModalEl = document.getElementById("openContactModal");
const contactModalEl = document.getElementById("contactModal");
const contactModalCloseEl = document.getElementById("contactModalClose");

const allowedSourceMimeTypes = new Set(["image/jpeg", "image/png"]);
const createHistory = [];
const editHistory = [];

let selectedCreateId = null;
let selectedEditId = null;
let createReferenceImages = [];
let quickEditReferenceImages = [];
let externalEditReferenceImages = [];
let externalSourceImage = null;
let isEditingSavedApiKey = false;
let previousQualityValue = "low";

const SETTINGS_STORAGE_KEY = "mini-dalle-settings-v1";
const USER_API_KEY_STORAGE_KEY = "dalle-goblin-user-api-key";
const API_KEY_PANEL_OPEN_STORAGE_KEY = "dalle-goblin-api-key-panel-open";

let dbPromise = null;

function activeStatusScope() {
  return editPanelEl.style.display === "none" ? "create" : "edit";
}

function setStatus(message, scope = "auto") {
  const resolvedScope = scope === "auto" ? activeStatusScope() : scope;
  if (resolvedScope === "edit") {
    editStatusEl.textContent = message;
  } else {
    createStatusEl.textContent = message;
  }
}

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CREATE_STORE)) {
          db.createObjectStore(CREATE_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(EDIT_STORE)) {
          db.createObjectStore(EDIT_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
    });
  }
  return dbPromise;
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error("Failed to read history"));
  });
}

async function dbReplaceAll(storeName, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const clearReq = store.clear();
    clearReq.onerror = () => reject(clearReq.error || new Error("Failed to clear store"));
    clearReq.onsuccess = () => {
      for (const item of items) {
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to write history"));
  });
}

async function dbAddCapped(storeName, item) {
  const all = await dbGetAll(storeName);
  const next = all.filter((it) => String(it.id) !== String(item.id));
  next.unshift(item);
  if (next.length > MAX_IMAGES_PER_TAB) {
    next.length = MAX_IMAGES_PER_TAB;
  }
  await dbReplaceAll(storeName, next);
}

async function dbDeleteById(storeName, id) {
  const all = await dbGetAll(storeName);
  const next = all.filter((it) => String(it.id) !== String(id));
  await dbReplaceAll(storeName, next);
}

async function dbClearStore(storeName) {
  await dbReplaceAll(storeName, []);
}

function switchTab(mode) {
  const createActive = mode === "create";
  createPanelEl.style.display = createActive ? "block" : "none";
  editPanelEl.style.display = createActive ? "none" : "block";
  tabCreateEl.classList.toggle("active", createActive);
  tabEditEl.classList.toggle("active", !createActive);
  tabCreateEl.setAttribute("aria-selected", createActive ? "true" : "false");
  tabEditEl.setAttribute("aria-selected", createActive ? "false" : "true");
}

function setButtons(disabled) {
  generateBtn.disabled = disabled;
  quickEditBtn.disabled = disabled;
  externalEditBtn.disabled = disabled;
}

function getSelectedRenderSettings() {
  const size = sizeEl.value;
  const quality = qualityEl.value;
  const output_format = formatEl.value;
  const output_compression = Number.parseInt(compressionEl.value, 10);

  const allowedSizes = new Set(["1024x1024", "1024x1536", "1536x1024"]);
  const allowedQualities = new Set(["low", "medium", "high"]);
  const allowedFormats = new Set(["jpeg", "png"]);

  if (!allowedSizes.has(size)) return { settings: null, error: "Unsupported size selected." };
  if (!allowedQualities.has(quality)) return { settings: null, error: "Unsupported quality selected." };
  if (!allowedFormats.has(output_format)) return { settings: null, error: "Unsupported format selected." };
  if (!Number.isInteger(output_compression) || output_compression < 0 || output_compression > 100) {
    return { settings: null, error: "Compression must be an integer from 0 to 100." };
  }

  return { settings: { size, quality, output_format, output_compression }, error: null };
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

function getUserApiKey() {
  const stored = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
  if (typeof stored !== "string") return null;
  const trimmed = stored.trim();
  return trimmed || null;
}

function isUsingOwnApiKey() {
  return Boolean(getUserApiKey());
}

function canUseHighQuality() {
  return isUsingOwnApiKey();
}

function setApiKeyPanelOpen(open) {
  apiKeyPanelBodyEl.style.display = open ? "block" : "none";
  toggleApiKeyPanelBtn.textContent = open ? "Hide" : "Show";
  localStorage.setItem(API_KEY_PANEL_OPEN_STORAGE_KEY, open ? "1" : "0");
}

function isApiKeyPanelOpen() {
  return apiKeyPanelBodyEl.style.display !== "none";
}

function ensureApiKeyPanelOpen() {
  if (!isApiKeyPanelOpen()) {
    setApiKeyPanelOpen(true);
  }
}

function maskApiKey(key) {
  const normalized = String(key || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 10) {
    return normalized.slice(0, 3) + "..." + normalized.slice(-2);
  }
  return normalized.slice(0, 6) + "..." + normalized.slice(-4);
}

function setApiKeySavedState(saved) {
  const showInput = !saved || isEditingSavedApiKey;
  userApiKeyEl.style.display = showInput ? "inline-block" : "none";
  saveUserApiKeyBtn.style.display = showInput ? "inline-block" : "none";
  clearUserApiKeyBtn.style.display = saved ? "inline-block" : "none";
  savedApiKeyDisplayEl.style.display = saved ? "inline-block" : "none";
  editUserApiKeyBtn.style.display = saved && !isEditingSavedApiKey ? "inline-block" : "none";
}

function updateApiKeyModeHint() {
  const key = getUserApiKey();
  apiKeyModeHintEl.textContent = key
    ? "Using your own API key for requests."
    : "Using free server key (2 requests available).";
}

function loadUserApiKey() {
  const raw = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
  isEditingSavedApiKey = false;
  if (typeof raw === "string" && raw.trim()) {
    const masked = maskApiKey(raw);
    savedApiKeyDisplayEl.textContent = "Saved key: " + masked;
    userApiKeyEl.value = "";
    setApiKeySavedState(true);
  } else {
    userApiKeyEl.value = "";
    savedApiKeyDisplayEl.textContent = "";
    setApiKeySavedState(false);
  }
  updateApiKeyModeHint();
}

function saveUserApiKeyFromInput() {
  const key = typeof userApiKeyEl.value === "string" ? userApiKeyEl.value.trim() : "";
  const existing = localStorage.getItem(USER_API_KEY_STORAGE_KEY);

  if (!key) {
    if (existing && isEditingSavedApiKey) {
      isEditingSavedApiKey = false;
      userApiKeyEl.value = "";
      setApiKeySavedState(true);
      return;
    }
    localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
    savedApiKeyDisplayEl.textContent = "";
    isEditingSavedApiKey = false;
    setApiKeySavedState(false);
    updateApiKeyModeHint();
    return;
  }

  localStorage.setItem(USER_API_KEY_STORAGE_KEY, key);
  savedApiKeyDisplayEl.textContent = "Saved key: " + maskApiKey(key);
  userApiKeyEl.value = "";
  isEditingSavedApiKey = false;
  setApiKeySavedState(true);
  updateApiKeyModeHint();
  setApiKeyPanelOpen(false);
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

function getFileExtensionFromMimeType(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "bin";
}

function setDownloadLink(anchorEl, b64, mimeType, baseName) {
  const dataUrl = "data:" + mimeType + ";base64," + b64;
  anchorEl.href = dataUrl;
  anchorEl.download = baseName + "." + getFileExtensionFromMimeType(mimeType);
  anchorEl.style.display = "inline-block";
}

function updateSelectedGeneratedInfo(item) {
  if (!item) {
    selectedGeneratedInfoEl.textContent = "No generated image selected.";
    quickEditStatusEl.textContent = "";
    quickEditCardEl.style.display = "none";
    return;
  }
  const snippet = item.originPrompt ? item.originPrompt.slice(0, 90) : "Generated image";
  selectedGeneratedInfoEl.textContent = "Selected image: " + snippet;
  quickEditCardEl.style.display = "block";
}

function renderSummary(targetEl, files, emptyText, prefixText) {
  if (!files.length) {
    targetEl.textContent = emptyText;
    return;
  }
  const names = files.map((f) => f.name).join(", ");
  targetEl.textContent = prefixText + files.length + ": " + names;
}

function createHistoryEntry({ b64, mimeType, prompt, parentId }) {
  return {
    id: Date.now() + Math.floor(Math.random() * 100000),
    b64,
    mimeType,
    originPrompt: prompt || "",
    parentId: parentId ?? null,
    createdAt: new Date().toISOString()
  };
}

function renderCounter(counterEl, count) {
  counterEl.textContent = count + "/" + MAX_IMAGES_PER_TAB;
}

function renderHistoryList(containerEl, items, onSelect, onDelete, selectedId) {
  containerEl.innerHTML = "";
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb";
    button.dataset.id = String(item.id);
    button.title = item.originPrompt || "Image";

    const img = document.createElement("img");
    img.alt = "Thumbnail";
    img.src = "data:" + item.mimeType + ";base64," + item.b64;
    button.appendChild(img);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "thumb-delete";
    deleteBtn.title = "Delete this image";
    deleteBtn.textContent = "X";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      void onDelete(item.id);
    });
    button.appendChild(deleteBtn);

    button.addEventListener("click", () => onSelect(item.id));
    button.classList.toggle("active", String(item.id) === String(selectedId));
    containerEl.appendChild(button);
  }
}

function selectCreateImage(id) {
  selectedCreateId = id;
  const item = createHistory.find((entry) => String(entry.id) === String(id));
  if (!item) {
    previewEl.removeAttribute("src");
    previewEl.style.display = "none";
    createPreviewCanvasEl.classList.add("hidden");
    quickDownloadEl.style.display = "none";
    updateSelectedGeneratedInfo(null);
    return;
  }
  createPreviewCanvasEl.classList.remove("hidden");
  previewEl.src = "data:" + item.mimeType + ";base64," + item.b64;
  previewEl.style.display = "block";
  setDownloadLink(quickDownloadEl, item.b64, item.mimeType, "dall-e-goblin-image");
  updateSelectedGeneratedInfo(item);
  renderHistoryList(createHistoryEl, createHistory, selectCreateImage, deleteCreateImage, selectedCreateId);
}

function selectEditImage(id) {
  selectedEditId = id;
  const item = editHistory.find((entry) => String(entry.id) === String(id));
  if (!item) {
    externalResultPreviewEl.removeAttribute("src");
    externalResultPreviewEl.style.display = "none";
    editResultCanvasEl.classList.add("hidden");
    externalDownloadEl.style.display = "none";
    return;
  }
  editResultCanvasEl.classList.remove("hidden");
  externalResultPreviewEl.src = "data:" + item.mimeType + ";base64," + item.b64;
  externalResultPreviewEl.style.display = "block";
  setDownloadLink(externalDownloadEl, item.b64, item.mimeType, "dall-e-goblin-edit");
  renderHistoryList(editHistoryEl, editHistory, selectEditImage, deleteEditImage, selectedEditId);
}

async function addCreateHistoryItem(item) {
  await dbAddCapped(CREATE_STORE, item);
  createHistory.unshift(item);
  if (createHistory.length > MAX_IMAGES_PER_TAB) createHistory.length = MAX_IMAGES_PER_TAB;
  renderCounter(createHistoryCountEl, createHistory.length);
  renderHistoryList(createHistoryEl, createHistory, selectCreateImage, deleteCreateImage, selectedCreateId);
  selectCreateImage(item.id);
}

async function addEditHistoryItem(item) {
  await dbAddCapped(EDIT_STORE, item);
  editHistory.unshift(item);
  if (editHistory.length > MAX_IMAGES_PER_TAB) editHistory.length = MAX_IMAGES_PER_TAB;
  renderCounter(editHistoryCountEl, editHistory.length);
  renderHistoryList(editHistoryEl, editHistory, selectEditImage, deleteEditImage, selectedEditId);
  selectEditImage(item.id);
}

async function deleteCreateImage(id) {
  if (!confirm("Delete this create image?")) return;
  await dbDeleteById(CREATE_STORE, id);
  const index = createHistory.findIndex((it) => String(it.id) === String(id));
  if (index >= 0) createHistory.splice(index, 1);
  renderCounter(createHistoryCountEl, createHistory.length);
  renderHistoryList(createHistoryEl, createHistory, selectCreateImage, deleteCreateImage, selectedCreateId);
  if (String(selectedCreateId) === String(id)) {
    if (createHistory.length) selectCreateImage(createHistory[0].id);
    else selectCreateImage(null);
  }
}

async function deleteEditImage(id) {
  if (!confirm("Delete this edit image?")) return;
  await dbDeleteById(EDIT_STORE, id);
  const index = editHistory.findIndex((it) => String(it.id) === String(id));
  if (index >= 0) editHistory.splice(index, 1);
  renderCounter(editHistoryCountEl, editHistory.length);
  renderHistoryList(editHistoryEl, editHistory, selectEditImage, deleteEditImage, selectedEditId);
  if (String(selectedEditId) === String(id)) {
    if (editHistory.length) selectEditImage(editHistory[0].id);
    else selectEditImage(null);
  }
}

async function clearCreateHistory() {
  if (!confirm("Clear all create history?")) return;
  await dbClearStore(CREATE_STORE);
  createHistory.splice(0, createHistory.length);
  renderCounter(createHistoryCountEl, 0);
  renderHistoryList(createHistoryEl, createHistory, selectCreateImage, deleteCreateImage, selectedCreateId);
  selectCreateImage(null);
  setStatus("Create history cleared.", "create");
}

async function clearEditHistory() {
  if (!confirm("Clear all edit history?")) return;
  await dbClearStore(EDIT_STORE);
  editHistory.splice(0, editHistory.length);
  renderCounter(editHistoryCountEl, 0);
  renderHistoryList(editHistoryEl, editHistory, selectEditImage, deleteEditImage, selectedEditId);
  selectEditImage(null);
  setStatus("Edit history cleared.", "edit");
}

async function readFileAsBase64(file) {
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

async function filesToPayload(files, label) {
  if (files.length > 4) throw new Error("You can upload up to 4 " + label + ".");
  const out = [];
  for (const file of files) {
    if (!allowedSourceMimeTypes.has(file.type)) {
      throw new Error("Unsupported file type for " + file.name + ". Use PNG or JPEG.");
    }
    out.push({
      name: file.name,
      mime_type: file.type,
      b64: await readFileAsBase64(file)
    });
  }
  return out;
}

async function requestJSON(path, payload, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.code = data.code || null;
    error.status = response.status;
    throw error;
  }
  return data;
}

function openPaywallModal(message, reasonEventType) {
  paywallMessageEl.textContent = message;
  paywallInterestFormEl.style.display = "none";
  paywallOptionsEl.style.display = "flex";
  paywallModalEl.style.display = "grid";
  void requestJSON("/api/interest/event", { event_type: reasonEventType || "paywall_shown" }).catch(() => {});
}

function closePaywallModal() {
  paywallModalEl.style.display = "none";
}

function openContactModal() {
  contactStatusEl.textContent = "";
  contactModalEl.style.display = "grid";
}

function closeContactModal() {
  contactModalEl.style.display = "none";
}

async function loadHistoriesFromDB() {
  const [createItems, editItems] = await Promise.all([dbGetAll(CREATE_STORE), dbGetAll(EDIT_STORE)]);
  createItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  editItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  createHistory.splice(0, createHistory.length, ...createItems.slice(0, MAX_IMAGES_PER_TAB));
  editHistory.splice(0, editHistory.length, ...editItems.slice(0, MAX_IMAGES_PER_TAB));

  renderCounter(createHistoryCountEl, createHistory.length);
  renderCounter(editHistoryCountEl, editHistory.length);

  renderHistoryList(createHistoryEl, createHistory, selectCreateImage, deleteCreateImage, selectedCreateId);
  renderHistoryList(editHistoryEl, editHistory, selectEditImage, deleteEditImage, selectedEditId);

  if (createHistory.length) selectCreateImage(createHistory[0].id);
  else selectCreateImage(null);

  if (editHistory.length) selectEditImage(editHistory[0].id);
  else selectEditImage(null);
}

async function generateImage() {
  const prompt = promptEl.value.trim();
  const { settings, error } = getSelectedRenderSettings();
  if (!prompt) return setStatus("Please enter a base prompt.", "create");
  if (!settings) return setStatus(error, "create");
  if (!canUseHighQuality() && settings.quality === "high") {
    openPaywallModal(
      "High quality generation is available when you use your own API key or choose subscription.",
      "paywall_shown_high_quality_locked"
    );
    return;
  }

  saveSettings();
  setButtons(true);
  setStatus("Generating image...", "create");

  try {
    const payload = { prompt, ...settings };
    const userApiKey = getUserApiKey();
    if (userApiKey) payload.user_api_key = userApiKey;
    if (createReferenceImages.length) payload.reference_images = createReferenceImages;
    const data = await requestJSON("/api/generate", payload);

    const mimeType = data.mime_type || "image/png";
    const entry = createHistoryEntry({ b64: data.b64, mimeType, prompt, parentId: null });
    await addCreateHistoryItem(entry);
    setStatus("Base image created. (" + createHistory.length + "/" + MAX_IMAGES_PER_TAB + ")", "create");
  } catch (requestError) {
    if (requestError?.code === "TRIAL_EXPIRED_NEEDS_API_KEY") {
      openPaywallModal(
        "Your free usage is over. Add your own API key or choose subscription.",
        "paywall_shown_trial_expired"
      );
    }
    if (requestError?.code === "INVALID_USER_API_KEY") {
      alert("Your API key is invalid. Please update it.");
      ensureApiKeyPanelOpen();
      userApiKeyEl.focus();
    }
    setStatus("Error: " + (requestError?.message || "Unknown error"), "create");
  } finally {
    setButtons(false);
  }
}

async function quickEditGeneratedImage() {
  const prompt = quickEditPromptEl.value.trim();
  const { settings, error } = getSelectedRenderSettings();
  const base = createHistory.find((entry) => String(entry.id) === String(selectedCreateId));

  if (!base) {
    quickEditStatusEl.textContent = "Select a generated image first.";
    return;
  }
  if (!prompt) {
    quickEditStatusEl.textContent = "Please enter a quick edit prompt.";
    return;
  }
  if (!settings) {
    quickEditStatusEl.textContent = error;
    return;
  }
  if (!canUseHighQuality() && settings.quality === "high") {
    openPaywallModal(
      "High quality generation is available when you use your own API key or choose subscription.",
      "paywall_shown_high_quality_locked"
    );
    return;
  }

  saveSettings();
  setButtons(true);
  quickEditStatusEl.textContent = "Creating variation...";

  try {
    const payload = {
      prompt,
      ...settings,
      image_b64: base.b64,
      image_mime_type: base.mimeType,
      parent_id: base.id
    };
    const userApiKey = getUserApiKey();
    if (userApiKey) payload.user_api_key = userApiKey;
    if (quickEditReferenceImages.length) payload.reference_images = quickEditReferenceImages;
    const data = await requestJSON("/api/edit", payload);

    const mimeType = data.mime_type || "image/png";
    const entry = createHistoryEntry({ b64: data.b64, mimeType, prompt, parentId: base.id });
    await addCreateHistoryItem(entry);
    quickEditStatusEl.textContent = "Variation created. (" + createHistory.length + "/" + MAX_IMAGES_PER_TAB + ")";
  } catch (requestError) {
    if (requestError?.code === "TRIAL_EXPIRED_NEEDS_API_KEY") {
      openPaywallModal(
        "Your free usage is over. Add your own API key or choose subscription.",
        "paywall_shown_trial_expired"
      );
    }
    if (requestError?.code === "INVALID_USER_API_KEY") {
      alert("Your API key is invalid. Please update it.");
      ensureApiKeyPanelOpen();
      userApiKeyEl.focus();
    }
    quickEditStatusEl.textContent = "Error: " + (requestError?.message || "Unknown error");
  } finally {
    setButtons(false);
  }
}

async function editUploadedImage() {
  const prompt = externalEditPromptEl.value.trim();
  const { settings, error } = getSelectedRenderSettings();

  if (!externalSourceImage) return setStatus("Upload a source image to edit.", "edit");
  if (!prompt) return setStatus("Please enter an edit prompt.", "edit");
  if (!settings) return setStatus(error, "edit");
  if (!canUseHighQuality() && settings.quality === "high") {
    openPaywallModal(
      "High quality generation is available when you use your own API key or choose subscription.",
      "paywall_shown_high_quality_locked"
    );
    return;
  }

  saveSettings();
  setButtons(true);
  setStatus("Editing uploaded image...", "edit");

  try {
    const payload = {
      prompt,
      ...settings,
      image_b64: externalSourceImage.b64,
      image_mime_type: externalSourceImage.mime_type
    };
    const userApiKey = getUserApiKey();
    if (userApiKey) payload.user_api_key = userApiKey;
    if (externalEditReferenceImages.length) payload.reference_images = externalEditReferenceImages;
    const data = await requestJSON("/api/edit", payload);

    const mimeType = data.mime_type || "image/png";
    const entry = createHistoryEntry({ b64: data.b64, mimeType, prompt, parentId: null });
    await addEditHistoryItem(entry);

    setStatus("Uploaded image edited. (" + editHistory.length + "/" + MAX_IMAGES_PER_TAB + ")", "edit");
  } catch (requestError) {
    if (requestError?.code === "TRIAL_EXPIRED_NEEDS_API_KEY") {
      openPaywallModal(
        "Your free usage is over. Add your own API key or choose subscription.",
        "paywall_shown_trial_expired"
      );
    }
    if (requestError?.code === "INVALID_USER_API_KEY") {
      alert("Your API key is invalid. Please update it.");
      ensureApiKeyPanelOpen();
      userApiKeyEl.focus();
    }
    setStatus("Error: " + (requestError?.message || "Unknown error"), "edit");
  } finally {
    setButtons(false);
  }
}

tabCreateEl.addEventListener("click", () => switchTab("create"));
tabEditEl.addEventListener("click", () => switchTab("edit"));

generateBtn.addEventListener("click", generateImage);
quickEditBtn.addEventListener("click", quickEditGeneratedImage);
externalEditBtn.addEventListener("click", editUploadedImage);
clearCreateHistoryBtn.addEventListener("click", () => void clearCreateHistory());
clearEditHistoryBtn.addEventListener("click", () => void clearEditHistory());

sizeEl.addEventListener("change", saveSettings);
formatEl.addEventListener("change", saveSettings);
compressionEl.addEventListener("change", saveSettings);
qualityEl.addEventListener("change", () => {
  const selected = qualityEl.value;
  if (selected === "high" && !canUseHighQuality()) {
    qualityEl.value = previousQualityValue === "high" ? "medium" : previousQualityValue;
    saveSettings();
    openPaywallModal(
      "High quality generation is available when you use your own API key or choose subscription.",
      "paywall_shown_high_quality_locked"
    );
    return;
  }
  previousQualityValue = qualityEl.value;
  saveSettings();
});
saveUserApiKeyBtn.addEventListener("click", () => {
  saveUserApiKeyFromInput();
});
toggleApiKeyPanelBtn.addEventListener("click", () => {
  setApiKeyPanelOpen(!isApiKeyPanelOpen());
});
editUserApiKeyBtn.addEventListener("click", () => {
  ensureApiKeyPanelOpen();
  isEditingSavedApiKey = true;
  userApiKeyEl.value = "";
  setApiKeySavedState(true);
  userApiKeyEl.focus();
});
clearUserApiKeyBtn.addEventListener("click", () => {
  if (!confirm("Clear your saved API key from this browser?")) {
    return;
  }
  localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
  isEditingSavedApiKey = false;
  userApiKeyEl.value = "";
  savedApiKeyDisplayEl.textContent = "";
  setApiKeySavedState(false);
  updateApiKeyModeHint();
});
paywallCloseEl.addEventListener("click", closePaywallModal);
paywallUseOwnKeyEl.addEventListener("click", async () => {
  closePaywallModal();
  await requestJSON("/api/interest/event", { event_type: "paywall_clicked_use_own_key" }).catch(() => {});
  ensureApiKeyPanelOpen();
  if (editUserApiKeyBtn.style.display !== "none") {
    editUserApiKeyBtn.click();
  } else {
    userApiKeyEl.focus();
  }
});
paywallSubscribeOptionEl.addEventListener("click", async () => {
  await requestJSON("/api/interest/event", { event_type: "paywall_clicked_subscribe_option" }).catch(() => {});
  paywallMessageEl.textContent = "This feature is being developed. Enter your email to be notified when it is available.";
  paywallOptionsEl.style.display = "none";
  paywallInterestFormEl.style.display = "block";
});
interestBackEl.addEventListener("click", () => {
  interestErrorEl.textContent = "";
  paywallMessageEl.textContent = "Add your own API key or join the subscription waitlist.";
  paywallInterestFormEl.style.display = "none";
  paywallOptionsEl.style.display = "flex";
});
async function submitInterestForm() {
  const email = String(interestEmailEl.value || "").trim();
  const willingness = String(interestWillingnessEl.value || "").trim();
  const comments = String(interestCommentsEl.value || "").trim();
  interestErrorEl.textContent = "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    interestErrorEl.textContent = "Please enter a valid email address.";
    interestEmailEl.focus();
    return;
  }
  if (willingness && Number.isNaN(Number(willingness))) {
    interestErrorEl.textContent = "Please enter a valid numeric amount.";
    interestWillingnessEl.focus();
    return;
  }
  try {
    await requestJSON("/api/interest/submit", { email, willingness, comments });
    await requestJSON("/api/interest/event", { event_type: "paywall_interest_submitted" }).catch(() => {});
    closePaywallModal();
    setStatus("Thanks. We saved your subscription interest.", "edit");
    interestEmailEl.value = "";
    interestWillingnessEl.value = "";
    interestCommentsEl.value = "";
    interestErrorEl.textContent = "";
  } catch (error) {
    interestErrorEl.textContent = error?.message || "Failed to submit interest";
  }
}
interestSubmitEl.addEventListener("click", () => {
  void submitInterestForm();
});
interestEmailEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void submitInterestForm();
  }
});
interestWillingnessEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void submitInterestForm();
  }
});

contactSubmitEl.addEventListener("click", async () => {
  const email = String(contactEmailEl.value || "").trim();
  const message = String(contactMessageEl.value || "").trim();
  const honeypot = String(contactWebsiteEl.value || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    contactStatusEl.textContent = "Please enter a valid email address.";
    contactEmailEl.focus();
    return;
  }
  if (!message || message.length < 5) {
    contactStatusEl.textContent = "Please enter a message with at least 5 characters.";
    contactMessageEl.focus();
    return;
  }

  contactStatusEl.textContent = "Sending message...";
  contactSubmitEl.disabled = true;
  try {
    await requestJSON("/api/contact", {
      email,
      message,
      contact_website: honeypot
    });
    contactStatusEl.textContent = "Message sent. Thanks for reaching out.";
    contactMessageEl.value = "";
    setTimeout(() => {
      closeContactModal();
    }, 500);
  } catch (error) {
    if (error?.code === "CONTACT_RATE_LIMIT_EXCEEDED") {
      contactStatusEl.textContent = "Contact limit reached for now. Please try again later.";
    } else {
      contactStatusEl.textContent = error?.message || "Failed to send contact message.";
    }
  } finally {
    contactSubmitEl.disabled = false;
  }
});
openContactModalEl.addEventListener("click", openContactModal);
contactModalCloseEl.addEventListener("click", closeContactModal);

referenceImagesInputEl.addEventListener("change", async () => {
  try {
    createReferenceImages = await filesToPayload(Array.from(referenceImagesInputEl.files || []), "reference images");
    renderSummary(referenceSummaryEl, createReferenceImages, "No reference images selected.", "Using reference images ");
  } catch (error) {
    createReferenceImages = [];
    referenceImagesInputEl.value = "";
    renderSummary(referenceSummaryEl, createReferenceImages, "No reference images selected.", "Using reference images ");
    setStatus("Error: " + (error?.message || "Invalid reference image"), "create");
  }
});
clearReferencesBtn.addEventListener("click", () => {
  createReferenceImages = [];
  referenceImagesInputEl.value = "";
  renderSummary(referenceSummaryEl, createReferenceImages, "No reference images selected.", "Using reference images ");
});

quickEditReferenceImagesInputEl.addEventListener("change", async () => {
  try {
    quickEditReferenceImages = await filesToPayload(
      Array.from(quickEditReferenceImagesInputEl.files || []),
      "edit guidance images"
    );
    renderSummary(
      quickEditReferenceSummaryEl,
      quickEditReferenceImages,
      "",
      "Using edit guidance images "
    );
  } catch (error) {
    quickEditReferenceImages = [];
    quickEditReferenceImagesInputEl.value = "";
    renderSummary(
      quickEditReferenceSummaryEl,
      quickEditReferenceImages,
      "",
      "Using edit guidance images "
    );
    setStatus("Error: " + (error?.message || "Invalid quick edit reference"), "create");
  }
});
clearQuickEditReferencesBtn.addEventListener("click", () => {
  quickEditReferenceImages = [];
  quickEditReferenceImagesInputEl.value = "";
  renderSummary(
    quickEditReferenceSummaryEl,
    quickEditReferenceImages,
    "",
    "Using edit guidance images "
  );
});

externalSourceImageInputEl.addEventListener("change", async () => {
  const files = Array.from(externalSourceImageInputEl.files || []);
  if (!files.length) {
    externalSourceImage = null;
    externalPreviewEl.style.display = "none";
    externalPreviewCanvasEl.classList.add("hidden");
    externalSourceSummaryEl.textContent = "No source image selected.";
    return;
  }
  const file = files[0];
  try {
    if (!allowedSourceMimeTypes.has(file.type)) {
      throw new Error("Unsupported source image type. Use PNG or JPEG.");
    }
    externalSourceImage = {
      name: file.name,
      mime_type: file.type,
      b64: await readFileAsBase64(file)
    };
    externalPreviewEl.src = "data:" + file.type + ";base64," + externalSourceImage.b64;
    externalPreviewEl.style.display = "block";
    externalPreviewCanvasEl.classList.remove("hidden");
    externalSourceSummaryEl.textContent = "Source image: " + file.name;
  } catch (error) {
    externalSourceImage = null;
    externalSourceImageInputEl.value = "";
    externalPreviewEl.style.display = "none";
    externalPreviewCanvasEl.classList.add("hidden");
    externalSourceSummaryEl.textContent = "No source image selected.";
    setStatus("Error: " + (error?.message || "Invalid source image"), "edit");
  }
});
clearExternalSourceImageBtn.addEventListener("click", () => {
  externalSourceImage = null;
  externalSourceImageInputEl.value = "";
  externalPreviewEl.style.display = "none";
  externalPreviewCanvasEl.classList.add("hidden");
  externalSourceSummaryEl.textContent = "No source image selected.";
});

externalEditReferenceImagesInputEl.addEventListener("change", async () => {
  try {
    externalEditReferenceImages = await filesToPayload(
      Array.from(externalEditReferenceImagesInputEl.files || []),
      "edit references"
    );
    renderSummary(
      externalEditReferenceSummaryEl,
      externalEditReferenceImages,
      "No edit references selected.",
      "Using edit references "
    );
  } catch (error) {
    externalEditReferenceImages = [];
    externalEditReferenceImagesInputEl.value = "";
    renderSummary(
      externalEditReferenceSummaryEl,
      externalEditReferenceImages,
      "No edit references selected.",
      "Using edit references "
    );
    setStatus("Error: " + (error?.message || "Invalid edit reference"), "edit");
  }
});
clearExternalEditReferencesBtn.addEventListener("click", () => {
  externalEditReferenceImages = [];
  externalEditReferenceImagesInputEl.value = "";
  renderSummary(
    externalEditReferenceSummaryEl,
    externalEditReferenceImages,
    "No edit references selected.",
    "Using edit references "
  );
});

loadSettings();
previousQualityValue = qualityEl.value;
loadUserApiKey();
setApiKeyPanelOpen(localStorage.getItem(API_KEY_PANEL_OPEN_STORAGE_KEY) === "1");
switchTab("create");
updateSelectedGeneratedInfo(null);
renderSummary(referenceSummaryEl, [], "No reference images selected.", "Using reference images ");
renderSummary(
  quickEditReferenceSummaryEl,
  [],
  "",
  "Using edit guidance images "
);
renderSummary(
  externalEditReferenceSummaryEl,
  [],
  "No edit references selected.",
  "Using edit references "
);
await loadHistoriesFromDB();

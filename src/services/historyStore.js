import { promises as fs } from "node:fs";
import path from "node:path";
import { MAX_HISTORY_ITEMS } from "../config/constants.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

let initPromise = null;
let writeQueue = Promise.resolve();

async function ensureStoreReady() {
  if (!initPromise) {
    initPromise = (async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      try {
        await fs.access(HISTORY_FILE);
      } catch {
        await fs.writeFile(HISTORY_FILE, "[]", "utf8");
      }
    })();
  }
  await initPromise;
}

async function readHistoryUnsafe() {
  await ensureStoreReady();
  const raw = await fs.readFile(HISTORY_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeHistoryUnsafe(items) {
  await ensureStoreReady();
  await fs.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2), "utf8");
}

function enqueueWrite(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

export async function getAllHistory() {
  return readHistoryUnsafe();
}

export async function saveHistoryItem(item) {
  return enqueueWrite(async () => {
    const items = await readHistoryUnsafe();
    items.unshift(item);
    if (items.length > MAX_HISTORY_ITEMS) {
      items.length = MAX_HISTORY_ITEMS;
    }
    await writeHistoryUnsafe(items);
    return item;
  });
}

import "dotenv/config";
import { createApp } from "./src/app.js";
import { PORT } from "./src/config/constants.js";
import { initializeRequestLogStore } from "./src/services/requestLogStore.js";

const app = createApp();

try {
  await initializeRequestLogStore();
  app.listen(PORT, () => {
    console.log("Open http://localhost:" + PORT);
  });
} catch (error) {
  console.error("Failed to initialize request log store:", error?.message || error);
  process.exit(1);
}

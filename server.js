import "dotenv/config";
import { createApp } from "./src/app.js";
import { PORT } from "./src/config/constants.js";

const app = createApp();

app.listen(PORT, () => {
  console.log("Open http://localhost:" + PORT);
});

import { createApp } from "./app.js";
import { createDeviceService } from "./device-service.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = createApp({
  service: createDeviceService()
});

app.listen(port, () => {
  console.log(`iPhone App Manager listening at http://localhost:${port}`);
});

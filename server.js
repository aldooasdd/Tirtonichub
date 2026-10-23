// Entry Passenger untuk cPanel "Setup Node.js App".
// Jalankan Next.js produksi di PORT yang diberi Passenger.
// Build dulu: `next build`. Startup file di cPanel = server.js.
const next = require("next");
const http = require("http");

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  http.createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Tirtonichub siap di port ${port}`);
  });
});

/* eslint-disable no-console */
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.SOCKET_SERVER_PORT || 4001;
const SECRET = process.env.SOCKET_SERVER_SECRET || "dev-secret";

const httpServer = http.createServer((req, res) => {
  // Minimal health endpoint
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/emit") {
    const provided = req.headers["x-socket-secret"];
    if (!provided || provided !== SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { boardId, event, payload } = JSON.parse(body || "{}");
        if (!boardId || !event) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing boardId or event" }));
          return;
        }
        io.to(`board-${boardId}`).emit(event, payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  socket.on("join-board", (boardId) => {
    if (typeof boardId === "string" && boardId.length > 0) {
      socket.join(`board-${boardId}`);
    }
  });
  socket.on("leave-board", (boardId) => {
    socket.leave(`board-${boardId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server listening on :${PORT}`);
});



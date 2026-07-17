import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { engine } from "@/lib/game/engine";
import { authenticateSocket } from "@/lib/game/socket-auth";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  await engine.whenReady();
  engine.startTickLoop();

  const httpServer = createServer((req, res) => handle(req, res));
  const io = new SocketIOServer(httpServer);

  const forward = (event: unknown) => io.emit("world-event", event);
  engine.on("event", forward);

  io.on("connection", async (socket) => {
    const auth = await authenticateSocket(socket.request.headers.cookie);
    if (!auth) {
      socket.emit("world-event", { type: "error", message: "unauthenticated" });
      socket.disconnect(true);
      return;
    }

    const entity = await engine.ensureLoaded(auth.userId, "player");
    socket.emit("world-event", { type: "self", entityId: entity?.id ?? null });
    socket.emit("world-event", { type: "tick", entities: engine.snapshot() });

    socket.on("move", ({ dx, dy }: { dx: number; dy: number }) => {
      if (!entity) return;
      const clampedDx = Math.max(-1, Math.min(1, Math.trunc(dx) || 0));
      const clampedDy = Math.max(-1, Math.min(1, Math.trunc(dy) || 0));
      engine.move(entity.id, clampedDx, clampedDy);
    });

    socket.on("chat", ({ content }: { content: string }) => {
      if (!entity || typeof content !== "string") return;
      void engine.chat(entity.id, auth.userId, content);
    });

    socket.on("placeTile", ({ x, y, terrain }: { x: number; y: number; terrain: string }) => {
      if (!entity || typeof terrain !== "string") return;
      void engine.placeTile(Math.trunc(x), Math.trunc(y), terrain);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Almaren running at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

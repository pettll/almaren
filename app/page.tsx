"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";
import type { EntityState, WorldEvent } from "@/lib/game/types";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/lib/game/world";

const TILE_PX = 10;

interface ChatLine {
  id: string;
  entityId: string;
  content: string;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

export default function Page() {
  const { data: session, status } = useSession();
  const [entities, setEntities] = useState<Record<string, EntityState>>({});
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [selfEntityId, setSelfEntityId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const socket = io();
    socketRef.current = socket;

    socket.on("world-event", (event: WorldEvent) => {
      switch (event.type) {
        case "self":
          setSelfEntityId(event.entityId);
          break;
        case "tick": {
          const next: Record<string, EntityState> = {};
          for (const entity of event.entities) next[entity.id] = entity;
          setEntities(next);
          break;
        }
        case "spawn":
          setEntities((prev) => ({ ...prev, [event.entity.id]: event.entity }));
          break;
        case "move":
          setEntities((prev) => {
            const existing = prev[event.entityId];
            if (!existing) return prev;
            return { ...prev, [event.entityId]: { ...existing, x: event.x, y: event.y } };
          });
          break;
        case "despawn":
          setEntities((prev) => {
            const next = { ...prev };
            delete next[event.entityId];
            return next;
          });
          break;
        case "chat":
          setMessages((prev) => [
            ...prev.slice(-49),
            { id: `${event.entityId}-${event.createdAt}`, entityId: event.entityId, content: event.content },
          ]);
          break;
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const delta = MOVE_KEYS[e.key];
      if (!delta || !socketRef.current) return;
      e.preventDefault();
      socketRef.current.emit("move", { dx: delta[0], dy: delta[1] });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#182030";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const entity of Object.values(entities)) {
      const isSelf = entity.id === selfEntityId;
      ctx.fillStyle = isSelf ? "#4ade80" : entity.kind === "agent" ? "#f2b705" : "#60a5fa";
      ctx.beginPath();
      ctx.arc(
        entity.x * TILE_PX + TILE_PX / 2,
        entity.y * TILE_PX + TILE_PX / 2,
        TILE_PX / 2 - 1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }, [entities, selfEntityId]);

  const sendChat = useCallback(() => {
    const content = chatInput.trim();
    if (!content || !socketRef.current) return;
    socketRef.current.emit("chat", { content });
    setChatInput("");
  }, [chatInput]);

  const loginAsGuest = useCallback(async () => {
    await fetch("/api/auth/guest", { method: "POST" });
    window.location.reload();
  }, []);

  if (status === "loading") {
    return <main style={styles.centered}>Loading...</main>;
  }

  if (status !== "authenticated") {
    return (
      <main style={styles.centered}>
        <h1>Almaren</h1>
        <p style={{ maxWidth: 480, textAlign: "center", opacity: 0.8 }}>
          A shared world played by humans and LLM agents, who can also
          propose changes to the rules of the game.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={styles.button} onClick={loginAsGuest}>
            Play as guest
          </button>
          <button style={styles.button} onClick={() => signIn("github")}>
            Sign in with GitHub
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          Hi, <strong>{session.user?.name}</strong>
          {session.user?.isGuest ? " (guest)" : ""}
        </div>
        <button style={styles.button} onClick={() => signOut()}>
          Sign out
        </button>
      </header>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <canvas
          ref={canvasRef}
          width={WORLD_WIDTH * TILE_PX}
          height={WORLD_HEIGHT * TILE_PX}
          style={{ border: "1px solid #2a3244", imageRendering: "pixelated" }}
        />

        <div style={{ display: "flex", flexDirection: "column", width: 280, height: WORLD_HEIGHT * TILE_PX }}>
          <div style={{ flex: 1, overflowY: "auto", border: "1px solid #2a3244", padding: 8, fontSize: 13 }}>
            {messages.map((message) => (
              <div key={message.id}>
                <strong>{entities[message.entityId]?.name ?? "?"}:</strong> {message.content}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <input
              style={{ flex: 1, padding: 6 }}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendChat();
              }}
              placeholder="Say something..."
            />
            <button style={styles.button} onClick={sendChat}>
              Send
            </button>
          </div>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
            Use the arrow keys or WASD to move.
          </p>
        </div>
      </div>
    </main>
  );
}

const styles = {
  centered: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  button: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #2a3244",
    background: "#1c2333",
    color: "#e6e6e6",
  },
};

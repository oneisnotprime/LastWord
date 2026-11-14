import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { defineRoom, defineServer } from "colyseus";
import { WorldRoom } from "./WorldRoom.js";

/** The built client, if present: the server then also serves the game page on the same port. */
const CLIENT = fileURLToPath(new URL("../../client/dist", import.meta.url));

const server = defineServer({
  // Friends ("mode": "friends") never land in a room someone started with bots ("mode": "bots").
  rooms: { world: defineRoom(WorldRoom).filterBy(["mode"]) },
  express: (app) => {
    app.get("/health", (_req, res) => { res.json({ ok: true }); });
    if (existsSync(CLIENT)) app.use(express.static(CLIENT));
  },
});
export default server;

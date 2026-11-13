import { defineRoom, defineServer } from "colyseus";
import { WorldRoom } from "./WorldRoom.js";

const server = defineServer({ rooms: { world: defineRoom(WorldRoom) } });
export default server;

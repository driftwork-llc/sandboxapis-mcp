#!/usr/bin/env node
// Speak JSON-RPC to the built server over stdio: initialize, then tools/list.
// Exit 0 when it answers with its name and at least one tool, 1 otherwise.
// No key, no network: neither request reaches the hosted service.
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["bundle/stdio.js"], { stdio: ["pipe", "pipe", "inherit"] });
const pending = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id != null && pending.has(msg.id)) pending.get(msg.id)(msg);
  }
});
let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer to ${method} in 15s`)), 15_000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}
try {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "handshake", version: "0" } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  const { tools } = await rpc("tools/list", {});
  if (init?.serverInfo?.name !== "sandboxapis" || !Array.isArray(tools) || tools.length === 0) throw new Error(`unexpected answer: ${JSON.stringify({ serverInfo: init?.serverInfo, tools: tools?.length })}`);
  console.log(`ok: ${init.serverInfo.name} ${init.serverInfo.version}, ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
  child.kill();
} catch (err) {
  console.error(`handshake failed: ${err.message}`);
  child.kill();
  process.exit(1);
}

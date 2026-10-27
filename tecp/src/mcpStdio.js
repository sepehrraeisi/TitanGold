import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { fileURLToPath } from 'node:url';
import { createTitanMcpServer } from './mcpServer.js';

export function startTitanMcpStdio(options = undefined) {
  return serveStdio(() => createTitanMcpServer(), options);
}

const entryPath = process.argv[1];
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  startTitanMcpStdio();
}

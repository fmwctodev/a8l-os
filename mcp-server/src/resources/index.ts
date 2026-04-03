import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..', '..');

function safeReadFile(path: string): string {
  try {
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8');
    }
  } catch {
    // ignore read errors
  }
  return `File not found: ${path}`;
}

export function registerResources(server: McpServer): void {
  server.resource(
    'api-documentation',
    'autom8ion://api-docs',
    {
      description: 'Complete Autom8ion Lab API documentation covering all 20 modules, REST endpoints, and Edge Functions',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'autom8ion://api-docs',
          mimeType: 'text/markdown',
          text: safeReadFile(resolve(projectRoot, 'postman', 'API_DOCUMENTATION.md')),
        },
      ],
    }),
  );

  server.resource(
    'postman-environment',
    'autom8ion://postman-environment',
    {
      description: 'Postman environment variables for Autom8ion Lab API',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'autom8ion://postman-environment',
          mimeType: 'application/json',
          text: safeReadFile(resolve(projectRoot, 'postman', 'autom8ion-lab.postman_environment.json')),
        },
      ],
    }),
  );

  server.resource(
    'postman-collection',
    'autom8ion://postman-collection',
    {
      description: 'Postman collection with all Autom8ion Lab API requests',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'autom8ion://postman-collection',
          mimeType: 'application/json',
          text: safeReadFile(resolve(projectRoot, 'postman', 'autom8ion-lab.postman_collection.json')),
        },
      ],
    }),
  );
}

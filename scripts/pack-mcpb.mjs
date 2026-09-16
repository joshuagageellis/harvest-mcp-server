#!/usr/bin/env node
/**
 * Pack the server into a `.mcpb` bundle that Claude Desktop installs by
 * double-click — no Docker, no terminal, no hand-edited JSON config.
 *
 * The bundle is staged in a clean directory rather than packed from the repo
 * root, so `.env`, `.git`, `node_modules` and the sources cannot end up inside
 * a file that gets passed around. Only the manifest and the single esbuild
 * bundle go in.
 *
 * The manifest's `tools` list is generated from TOOLS_CONFIG at pack time, so
 * the list shown in the Desktop install dialog cannot drift from the tools the
 * server actually registers.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, 'dist-mcpb');
const bundlePath = join(root, 'build', 'index.mjs');

/** Load TOOLS_CONFIG from the TypeScript source by compiling it on its own. */
async function readToolsConfig() {
  const compiled = join(stage, '.tools-config.mjs');
  await build({
    entryPoints: [join(root, 'src', 'tools-config.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: compiled,
  });
  const { TOOLS_CONFIG } = await import(pathToFileURL(compiled).href);
  rmSync(compiled);
  return TOOLS_CONFIG;
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (manifest.version !== pkg.version) {
  throw new Error(
    `version mismatch: manifest.json is ${manifest.version}, package.json is ${pkg.version}`,
  );
}

try {
  readFileSync(bundlePath);
} catch {
  throw new Error(`missing ${bundlePath} — run \`pnpm run build\` first`);
}

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'build'), { recursive: true });

const toolsConfig = await readToolsConfig();
manifest.tools = Object.entries(toolsConfig)
  .filter(([, tool]) => tool.enabled)
  .map(([name, tool]) => ({ name, description: tool.description }));

writeFileSync(join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(bundlePath, join(stage, 'build', 'index.mjs'));

const output = join(root, `${manifest.name}.mcpb`);
execFileSync('pnpm', ['dlx', '@anthropic-ai/mcpb@latest', 'pack', stage, output], {
  stdio: 'inherit',
});

console.log(`\nPacked ${manifest.tools.length} tools into ${output}`);
console.log('Install it by opening the file with Claude Desktop.');

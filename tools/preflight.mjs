#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOT_NAMES,
  readJson,
  resolveContainedPath,
  validateComposition,
  validateConfigBoundaries,
  validateSlotContract
} from './composer-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compositionPath = path.join(root, 'COMPOSITION.json');
if (!fs.existsSync(compositionPath)) {
  throw new Error('COMPOSITION.json is missing. Copy COMPOSITION.example.json to COMPOSITION.json and configure both slots.');
}
const composition = validateComposition(readJson(compositionPath));
const contracts = {};
for (const slot of SLOT_NAMES) {
  if (!composition.slots[slot].contract) continue;
  const contractPath = resolveContainedPath(root, composition.slots[slot].contract, `${slot} contract path`);
  if (!fs.existsSync(contractPath)) throw new Error(`${slot} slot contract is missing.`);
  contracts[slot] = validateSlotContract(readJson(contractPath), slot);
}
if (Object.keys(contracts).length === SLOT_NAMES.length) validateConfigBoundaries(contracts);
console.log('Composition and external slot contracts passed.');

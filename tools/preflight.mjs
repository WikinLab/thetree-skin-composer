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
const composition = validateComposition(readJson(path.join(root, 'COMPOSITION.json')));
const contracts = {};
for (const slot of SLOT_NAMES) {
  const contractPath = resolveContainedPath(root, composition.slots[slot].contract, `${slot} contract path`);
  if (!fs.existsSync(contractPath)) throw new Error(`${slot} slot contract is missing.`);
  contracts[slot] = validateSlotContract(readJson(contractPath), slot);
}
validateConfigBoundaries(contracts);
console.log('Composition and external slot contracts passed.');

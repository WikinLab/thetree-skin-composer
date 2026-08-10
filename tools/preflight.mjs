#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, validateComposition } from './composer-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
validateComposition(readJson(path.join(root, 'COMPOSITION.json')));
console.log('Composition source contract passed.');

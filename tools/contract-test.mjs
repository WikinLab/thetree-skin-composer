#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeLicenseInventory,
  renderSlotLoaders,
  validateChildManifest,
  validateComposition,
  validateConfigBoundaries
} from './composer-core.mjs';
import { resolveCompositionSlot } from '../lib/resolveCompositionSlot.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composition = validateComposition(JSON.parse(fs.readFileSync(path.join(root, 'COMPOSITION.json'), 'utf8')));
const mobileFrontendContract = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'mobilefrontend-data-contract.json'), 'utf8'));
assert.deepEqual(Object.keys(composition.slots), ['desktop', 'mobile']);
assert.equal(resolveCompositionSlot({}, mobileFrontendContract), 'desktop');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'thetree-mobilefrontend/v1', mode: 'desktop' } }, mobileFrontendContract), 'desktop');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'thetree-mobilefrontend/v1', mode: 'mobile' } }, mobileFrontendContract), 'mobile');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'unknown', mode: 'mobile' } }, mobileFrontendContract), 'desktop');

const manifests = {
  desktop: validateChildManifest({
    schema: 'thetree-composable-skin/v1', id: 'fixture-desktop', entry: 'components/Desktop.vue',
    contentSurface: 'host', configNamespaces: ['skin.desktop'], sharedConfigKeys: ['wiki.lang'], license: 'MIT'
  }, 'desktop'),
  mobile: validateChildManifest({
    schema: 'thetree-composable-skin/v1', id: 'fixture-mobile', entry: 'components/Mobile.vue',
    contentSurface: 'host', configNamespaces: ['skin.mobile'], sharedConfigKeys: ['wiki.lang'], license: 'GPL-2.0-or-later'
  }, 'mobile')
};
assert.deepEqual(validateConfigBoundaries(manifests), { 'skin.desktop': 'desktop', 'skin.mobile': 'mobile' });
assert.throws(() => validateConfigBoundaries({
  desktop: manifests.desktop,
  mobile: { ...manifests.mobile, configNamespaces: ['skin.desktop'] }
}), /claimed by desktop and mobile/);
const loaders = renderSlotLoaders(manifests, mobileFrontendContract);
assert.match(loaders, /slots\/desktop\/components\/Desktop\.vue/);
assert.match(loaders, /slots\/mobile\/components\/Mobile\.vue/);
assert.deepEqual(makeLicenseInventory(manifests).slots.mobile.license, 'GPL-2.0-or-later');

const implementation = [
  fs.readFileSync(path.join(root, 'layout.vue'), 'utf8'),
  fs.readFileSync(path.join(root, 'lib', 'resolveCompositionSlot.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'tools', 'composer-core.mjs'), 'utf8'),
  fs.readFileSync(path.join(root, 'tools', 'bootstrap.mjs'), 'utf8')
].join('\n');
assert.doesNotMatch(implementation, /vector|minerva/i, 'Composer implementation must not know concrete skin names.');
assert.match(fs.readFileSync(path.join(root, 'layout.vue'), 'utf8'), /slotComponents\[this\.activeSlot\]/);
console.log('Neutral skin composer contract passed.');

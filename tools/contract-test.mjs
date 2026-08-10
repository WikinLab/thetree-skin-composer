#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeLicenseInventory,
  packageManagerScriptMatches,
  renderSlotLoaders,
  resolveContainedPath,
  validateComposition,
  validateConfigBoundaries,
  validateSlotContract
} from './composer-core.mjs';
import { resolveCompositionSlot } from '../lib/resolveCompositionSlot.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composition = validateComposition(JSON.parse(fs.readFileSync(path.join(root, 'COMPOSITION.json'), 'utf8')));
const mobileFrontendContract = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'mobilefrontend-data-contract.json'), 'utf8'));
assert.deepEqual(Object.keys(composition.slots), ['desktop', 'mobile']);
assert.equal(composition.slots.desktop.contract, 'contracts/slots/desktop.json');
assert.equal(resolveCompositionSlot({}, mobileFrontendContract), 'desktop');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'thetree-mobilefrontend/v1', mode: 'desktop' } }, mobileFrontendContract), 'desktop');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'thetree-mobilefrontend/v1', mode: 'mobile' } }, mobileFrontendContract), 'mobile');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'unknown', mode: 'mobile' } }, mobileFrontendContract), 'desktop');
assert.equal(packageManagerScriptMatches('npm', 'C:/runtime/npm-cli.js'), true);
assert.equal(packageManagerScriptMatches('npm', 'C:/runtime/pnpm.cjs'), false);
assert.equal(packageManagerScriptMatches('pnpm', 'C:/runtime/pnpm.cjs'), true);

const contracts = {
  desktop: validateSlotContract({
    schema: 'thetree-skin-slot-contract/v1', id: 'fixture-desktop', entry: 'layout.vue',
    contentSurface: 'host', configNamespaces: [], sharedConfigKeys: ['wiki.lang'], license: 'MIT'
  }, 'desktop'),
  mobile: validateSlotContract({
    schema: 'thetree-skin-slot-contract/v1', id: 'fixture-mobile', adapter: 'adapters/Mobile.vue',
    contentSurface: 'host', configNamespaces: ['skin.mobile'], sharedConfigKeys: ['wiki.lang'],
    license: 'GPL-2.0-or-later', prepare: ['npm', 'run', 'generate']
  }, 'mobile')
};
assert.equal(contracts.desktop.prepare, undefined, 'A native skin needs no preparation command.');
assert.deepEqual(validateConfigBoundaries(contracts), { 'skin.mobile': 'mobile' });
assert.throws(() => validateConfigBoundaries({
  desktop: { ...contracts.desktop, configNamespaces: ['skin.shared'] },
  mobile: { ...contracts.mobile, configNamespaces: ['skin.shared'] }
}), /claimed by desktop and mobile/);
assert.throws(() => validateSlotContract({ ...contracts.desktop, adapter: 'Adapter.vue' }, 'desktop'), /exactly one/);
assert.throws(() => resolveContainedPath(root, '../outside.json', 'fixture path'), /escapes/);
const loaders = renderSlotLoaders(contracts, mobileFrontendContract);
assert.match(loaders, /slots\/desktop\/layout\.vue/);
assert.match(loaders, /\.\.\/\.\.\/adapters\/Mobile\.vue/);
assert.deepEqual(makeLicenseInventory(contracts).slots.mobile.license, 'GPL-2.0-or-later');

const bootstrapSource = fs.readFileSync(path.join(root, 'tools', 'bootstrap.mjs'), 'utf8');
const implementation = [
  fs.readFileSync(path.join(root, 'layout.vue'), 'utf8'),
  fs.readFileSync(path.join(root, 'lib', 'resolveCompositionSlot.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'tools', 'composer-core.mjs'), 'utf8'),
  bootstrapSource
].join('\n');
assert.doesNotMatch(implementation, /vector|minerva/i, 'Composer implementation must not know concrete skin names.');
assert.doesNotMatch(implementation, /COMPOSABLE-SKIN/, 'Composer must not require changes in a child repository.');
assert.ok(
  bootstrapSource.indexOf('runSlotPrepare(slotRoot, contracts[slot])') < bootstrapSource.indexOf('const componentPath ='),
  'A preparation command must be allowed to generate the configured entry.'
);
assert.match(fs.readFileSync(path.join(root, 'layout.vue'), 'utf8'), /slotComponents\[this\.activeSlot\]/);
console.log('External-contract neutral skin composer passed.');

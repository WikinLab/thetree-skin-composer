#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeCompositionResolution,
  makeLicenseInventory,
  makeRuntimeContract,
  normalizeComposableSkin,
  inferNativeSlotContract,
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
assert.equal(composition.slots.desktop.contract, undefined);
assert.equal(resolveCompositionSlot({}, mobileFrontendContract), 'desktop');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'thetree-mobilefrontend/v1', mode: 'desktop' } }, mobileFrontendContract), 'desktop');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'thetree-mobilefrontend/v1', mode: 'mobile' } }, mobileFrontendContract), 'mobile');
assert.equal(resolveCompositionSlot({ thetreeMobileFrontend: { schema: 'unknown', mode: 'mobile' } }, mobileFrontendContract), 'desktop');
assert.equal(packageManagerScriptMatches('npm', 'C:/runtime/npm-cli.js'), true);
assert.equal(packageManagerScriptMatches('npm', 'C:/runtime/pnpm.cjs'), false);
assert.equal(packageManagerScriptMatches('pnpm', 'C:/runtime/pnpm.cjs'), true);
const resolvedRepositories = [];
const resolution = makeCompositionResolution(composition, (repository, ref) => {
  resolvedRepositories.push([repository, ref]);
  return repository === composition.slots.desktop.repository
    ? '1111111111111111111111111111111111111111'
    : '2222222222222222222222222222222222222222';
});
assert.deepEqual(resolvedRepositories, [
  [composition.slots.desktop.repository, composition.slots.desktop.ref],
  [composition.slots.mobile.repository, composition.slots.mobile.ref]
]);
assert.equal(resolution.schema, 'thetree-skin-composition-resolution/v1');
assert.equal(resolution.slots.desktop.commit, '1111111111111111111111111111111111111111');
assert.equal(resolution.slots.mobile.commit, '2222222222222222222222222222222222222222');
assert.throws(() => makeCompositionResolution(composition, () => 'main'), /full Git object id/);

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
assert.deepEqual(normalizeComposableSkin({
  schema: 'thetree-composable-skin/v1', id: 'self-described', entry: 'layout.vue',
  contentSurface: 'host', configNamespaces: ['skin.self'], sharedConfigKeys: [],
  license: 'MIT', prepare: ['npm', 'run', 'build']
}, 'desktop').prepare, ['npm', 'run', 'build']);
const inferredRoot = path.join(root, '.contract-fixture-native');
fs.mkdirSync(inferredRoot, { recursive: true });
try {
  fs.writeFileSync(path.join(inferredRoot, 'package.json'), '{"name":"native-fixture","license":"MIT"}\n');
  assert.deepEqual(inferNativeSlotContract(inferredRoot, 'desktop'), {
    schema: 'thetree-skin-slot-contract/v1', id: 'native-fixture', entry: 'layout.vue',
    contentSurface: 'host', configNamespaces: [], sharedConfigKeys: [], license: 'MIT'
  });
} finally {
  fs.rmSync(inferredRoot, { recursive: true, force: true });
}
assert.deepEqual(validateConfigBoundaries(contracts), { 'skin.mobile': ['mobile'] });
assert.deepEqual(validateConfigBoundaries({
  desktop: { ...contracts.desktop, configNamespaces: ['skin.shared'] },
  mobile: { ...contracts.mobile, configNamespaces: ['skin.shared'] }
}), { 'skin.shared': ['desktop', 'mobile'] });
assert.throws(() => validateSlotContract({ ...contracts.desktop, adapter: 'Adapter.vue' }, 'desktop'), /exactly one/);
assert.throws(() => resolveContainedPath(root, '../outside.json', 'fixture path'), /escapes/);
const loaders = renderSlotLoaders(contracts, mobileFrontendContract);
assert.match(loaders, /import \{ defineAsyncComponent \} from 'vue';/);
assert.match(loaders, /slots\/desktop\/layout\.vue/);
assert.match(loaders, /\.\.\/\.\.\/adapters\/Mobile\.vue/);
assert.match(loaders, /desktop: defineAsyncComponent\(\(\) => import\('/);
assert.match(loaders, /mobile: defineAsyncComponent\(\(\) => import\('/);
assert.doesNotMatch(loaders, /^\s+(?:desktop|mobile): \(\) => import\(/m);
assert.deepEqual(makeLicenseInventory(contracts).slots.mobile.license, 'GPL-2.0-or-later');
assert.deepEqual(makeRuntimeContract(contracts), {
  schema: 'thetree-skin-composer-runtime/v1',
  configNamespaces: ['skin.mobile'],
  sharedConfigKeys: ['wiki.lang']
});

const bootstrapSource = fs.readFileSync(path.join(root, 'tools', 'bootstrap.mjs'), 'utf8');
const implementation = [
  fs.readFileSync(path.join(root, 'layout.vue'), 'utf8'),
  fs.readFileSync(path.join(root, 'lib', 'resolveCompositionSlot.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'tools', 'composer-core.mjs'), 'utf8'),
  bootstrapSource
].join('\n');
assert.doesNotMatch(implementation, /vector|minerva/i, 'Composer implementation must not know concrete skin names.');
assert.match(implementation, /COMPOSABLE-SKIN/, 'Composer should accept optional child self-description.');
assert.match(implementation, /inferNativeSlotContract/, 'Composer must support unmodified native skins.');
assert.doesNotMatch(bootstrapSource, /COMPOSITION-LOCK|--refresh/, 'Bootstrap must resolve current slot refs instead of consuming a tracked lock.');
assert.match(bootstrapSource, /makeCompositionResolution\(composition, resolveHead\)/);
assert.ok(
  bootstrapSource.indexOf('runSlotPrepare(slotRoot, contracts[slot])') < bootstrapSource.indexOf('const componentPath ='),
  'A preparation command must be allowed to generate the configured entry.'
);
assert.match(fs.readFileSync(path.join(root, 'layout.vue'), 'utf8'), /slotComponents\[this\.activeSlot\]/);
console.log('External-contract neutral skin composer passed.');

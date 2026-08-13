#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverNativeConfigNamespaces,
  makeCompositionResolution,
  makeLicenseInventory,
  makeRuntimeContract,
  normalizeComposableSkin,
  inferNativeSlotContract,
  packageManagerScriptMatches,
  readCompositionConfigNamespaces,
  renderSlotLoaders,
  resolveContainedPath,
  validateComposition,
  validateConfigBoundaries,
  validateSlotContract
} from './composer-core.mjs';
import { resolveCompositionSlot } from '../lib/resolveCompositionSlot.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composition = validateComposition(JSON.parse(fs.readFileSync(path.join(root, 'COMPOSITION.example.json'), 'utf8')));
assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\/COMPOSITION\.json$/m);
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
  fs.writeFileSync(path.join(inferredRoot, 'layout.vue'), [
    '<template><nuxt /></template>',
    `<script>const unrelated = 'skin.unrelated.color';`,
    `const color = config['skin.native.brand_color'];`,
    `const ambiguous = config['skin.nested.group.color'];`,
    `// const ignoredComment = config['skin.comment.color'];`,
    `/* const ignoredBlock = config['skin.block.color']; */</script>`,
    ''
  ].join('\n'));
  fs.mkdirSync(path.join(inferredRoot, 'tests'));
  fs.writeFileSync(path.join(inferredRoot, 'tests', 'ignored.test.js'), `const ignored = 'skin.ignored.color';\n`);
  assert.deepEqual(discoverNativeConfigNamespaces(inferredRoot), ['skin.native']);
  assert.deepEqual(inferNativeSlotContract(inferredRoot, 'desktop'), {
    schema: 'thetree-skin-slot-contract/v1', id: 'native-fixture', entry: 'layout.vue',
    contentSurface: 'host', configNamespaces: ['skin.native'], sharedConfigKeys: [], license: 'MIT'
  });
  assert.throws(
    () => inferNativeSlotContract(inferredRoot, 'desktop', ['skin.wrong']),
    /source uses skin\.native/
  );
  assert.deepEqual(
    inferNativeSlotContract(inferredRoot, 'desktop', ['skin.dynamic', 'skin.native']).configNamespaces,
    ['skin.dynamic', 'skin.native']
  );
} finally {
  fs.rmSync(inferredRoot, { recursive: true, force: true });
}
const unresolvedRoot = path.join(root, '.contract-fixture-unresolved');
fs.mkdirSync(unresolvedRoot, { recursive: true });
try {
  fs.writeFileSync(path.join(unresolvedRoot, 'layout.vue'), '<template><nuxt /></template>\n');
  assert.throws(() => inferNativeSlotContract(unresolvedRoot, 'mobile'), /config namespace could not be discovered/);
  assert.deepEqual(inferNativeSlotContract(unresolvedRoot, 'mobile', []).configNamespaces, []);
  assert.deepEqual(inferNativeSlotContract(unresolvedRoot, 'mobile', ['skin.manual']).configNamespaces, ['skin.manual']);
} finally {
  fs.rmSync(unresolvedRoot, { recursive: true, force: true });
}
assert.deepEqual(readCompositionConfigNamespaces({ configSkin: 'liberty' }, 'desktop'), ['skin.liberty']);
assert.deepEqual(readCompositionConfigNamespaces({ configSkin: 'skin.liberty' }, 'desktop'), ['skin.liberty']);
assert.deepEqual(readCompositionConfigNamespaces({ configNamespaces: [] }, 'mobile'), []);
assert.throws(
  () => readCompositionConfigNamespaces({ configSkin: 'liberty', configNamespaces: [] }, 'desktop'),
  /only one/
);
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
assert.match(bootstrapSource, /COMPOSITION\.example\.json/, 'Missing local composition guidance must point to the tracked example.');
assert.match(bootstrapSource, /makeCompositionResolution\(composition, resolveHead\)/);
assert.ok(
  bootstrapSource.indexOf('runSlotPrepare(slotRoot, contracts[slot])') < bootstrapSource.indexOf('const componentPath ='),
  'A preparation command must be allowed to generate the configured entry.'
);
assert.match(fs.readFileSync(path.join(root, 'layout.vue'), 'utf8'), /slotComponents\[this\.activeSlot\]/);
console.log('External-contract neutral skin composer passed.');

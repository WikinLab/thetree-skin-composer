#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SLOT_NAMES,
  makeCompositionResolution,
  makeLicenseInventory,
  makeRuntimeContract,
  normalizeComposableSkin,
  inferNativeSlotContract,
  packageManagerScriptMatches,
  readJson,
  renderSlotLoaders,
  resolveContainedPath,
  validateComposition,
  validateConfigBoundaries,
  validateSlotContract,
  writeDeterministicJson
} from './composer-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedRoot = path.join(root, '.skin-composer');
const slotsRoot = path.join(generatedRoot, 'slots');
const generatedOutput = path.join(generatedRoot, 'generated');
const compositionPath = path.join(root, 'COMPOSITION.json');
const mobileFrontendContractPath = path.join(root, 'contracts', 'mobilefrontend-data-contract.json');

function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', windowsHide: true, shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}.`);
}

function capture(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `${command} ${args.join(' ')} failed.`);
  return result.stdout.trim();
}

function resolveHead(repository, ref) {
  const rows = capture('git', ['ls-remote', repository, ref]).split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) throw new Error(`Expected one Git ref for ${repository} ${ref}, got ${rows.length}.`);
  return rows[0].split(/\s+/)[0];
}

function cloneExact(repository, commit, target) {
  const gitDirectory = path.join(target, '.git');
  if (fs.existsSync(target) && !fs.existsSync(gitDirectory)) fs.rmSync(target, { recursive: true, force: true });
  if (fs.existsSync(gitDirectory)) {
    const currentRemote = capture('git', ['remote', 'get-url', 'origin'], target);
    if (currentRemote !== repository) fs.rmSync(target, { recursive: true, force: true });
  }
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
    run('git', ['init', '--quiet'], target);
    run('git', ['remote', 'add', 'origin', repository], target);
  }
  const hasCommit = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
    cwd: target, stdio: 'ignore', windowsHide: true, shell: false
  }).status === 0;
  if (!hasCommit) run('git', ['fetch', '--quiet', '--depth=1', 'origin', commit], target);
  run('git', ['checkout', '--quiet', '--detach', '--force', commit], target);
  const observed = capture('git', ['rev-parse', 'HEAD'], target);
  if (observed !== commit) throw new Error(`Checked out ${observed}, expected ${commit}.`);
}

function resolveSlotContract(source, slotRoot, slot) {
  if (source.contract) {
    const contractPath = resolveContainedPath(root, source.contract, `${slot} contract path`);
    if (!fs.existsSync(contractPath)) throw new Error(`${slot} external slot contract is missing.`);
    return validateSlotContract(readJson(contractPath), slot);
  }
  const selfDescriptionPath = path.join(slotRoot, 'COMPOSABLE-SKIN.json');
  if (fs.existsSync(selfDescriptionPath)) return normalizeComposableSkin(readJson(selfDescriptionPath), slot);
  return inferNativeSlotContract(slotRoot, slot);
}

function runSlotPrepare(slotRoot, contract) {
  const words = contract.prepare || [];
  if (!words.length) return;
  const env = {
    ...process.env,
    THETREE_BOOTSTRAP_CACHE_ROOT: path.join(generatedRoot, 'cache')
  };
  if (packageManagerScriptMatches(words[0], process.env.npm_execpath)) {
    run(process.execPath, [process.env.npm_execpath, ...words.slice(1)], slotRoot, env);
    return;
  }
  run(words[0], words.slice(1), slotRoot, env);
}

function assertHostContentSurface(componentPath, slot) {
  const component = fs.readFileSync(componentPath, 'utf8');
  if (!/<nuxt(?:\s|\/|>)/i.test(component)) {
    throw new Error(`${slot} slot component does not expose the host <nuxt/> content surface.`);
  }
}

const composition = validateComposition(readJson(compositionPath));
const mobileFrontendContract = readJson(mobileFrontendContractPath);
if (mobileFrontendContract.schema !== 1) throw new Error(`Unsupported MobileFrontend contract ${mobileFrontendContract.schema}.`);
const resolution = makeCompositionResolution(composition, resolveHead);

const contracts = {};
for (const slot of SLOT_NAMES) {
  const source = composition.slots[slot];
  const resolved = resolution.slots[slot];
  const slotRoot = path.join(slotsRoot, slot);
  cloneExact(resolved.repository, resolved.commit, slotRoot);
  contracts[slot] = resolveSlotContract(source, slotRoot, slot);
  runSlotPrepare(slotRoot, contracts[slot]);
  const componentPath = contracts[slot].adapter
    ? resolveContainedPath(root, contracts[slot].adapter, `${slot} slot adapter`)
    : resolveContainedPath(slotRoot, contracts[slot].entry, `${slot} slot entry`);
  if (!fs.existsSync(componentPath)) throw new Error(`${slot} slot component is missing after preparation.`);
  assertHostContentSurface(componentPath, slot);
}

validateConfigBoundaries(contracts);
fs.mkdirSync(generatedOutput, { recursive: true });
fs.writeFileSync(path.join(generatedOutput, 'slot-loaders.js'), renderSlotLoaders(contracts, mobileFrontendContract));
writeDeterministicJson(path.join(generatedOutput, 'composition-resolution.json'), resolution);
writeDeterministicJson(path.join(generatedOutput, 'license-inventory.json'), makeLicenseInventory(contracts));
writeDeterministicJson(path.join(generatedOutput, 'runtime-contract.json'), makeRuntimeContract(contracts));
writeDeterministicJson(path.join(generatedOutput, 'state.json'), {
  schema: 1,
  slots: Object.fromEntries(SLOT_NAMES.map((slot) => [slot, {
    commit: resolution.slots[slot].commit,
    id: contracts[slot].id,
    component: contracts[slot].adapter || contracts[slot].entry,
    componentOwner: contracts[slot].adapter ? 'composition' : 'repository'
  }]))
});
console.log(`Composed ${contracts.desktop.id} + ${contracts.mobile.id}.`);

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SLOT_NAMES,
  makeLicenseInventory,
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
const lockPath = path.join(root, 'COMPOSITION-LOCK.json');
const refresh = process.argv.includes('--refresh');

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true, shell: false });
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
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  run('git', ['init', '--quiet'], target);
  run('git', ['remote', 'add', 'origin', repository], target);
  run('git', ['fetch', '--quiet', '--depth=1', 'origin', commit], target);
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], target);
  const observed = capture('git', ['rev-parse', 'HEAD'], target);
  if (observed !== commit) throw new Error(`Checked out ${observed}, expected ${commit}.`);
}

function runSlotPrepare(slotRoot, contract) {
  const words = contract.prepare || [];
  if (!words.length) return;
  if (packageManagerScriptMatches(words[0], process.env.npm_execpath)) {
    run(process.execPath, [process.env.npm_execpath, ...words.slice(1)], slotRoot);
    return;
  }
  run(words[0], words.slice(1), slotRoot);
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
let lock = fs.existsSync(lockPath) ? readJson(lockPath) : null;
if (!lock || refresh) {
  lock = {
    schema: 'thetree-skin-composition-lock/v1',
    slots: Object.fromEntries(SLOT_NAMES.map((slot) => {
      const source = composition.slots[slot];
      return [slot, { ...source, commit: resolveHead(source.repository, source.ref) }];
    }))
  };
}
if (lock.schema !== 'thetree-skin-composition-lock/v1') throw new Error(`Unsupported composition lock ${lock.schema}.`);

const contracts = {};
for (const slot of SLOT_NAMES) {
  const source = composition.slots[slot];
  const locked = lock.slots?.[slot];
  if (source.repository !== locked?.repository || source.ref !== locked?.ref || !/^[0-9a-f]{40}$/.test(locked?.commit || '')) {
    throw new Error(`${slot} lock does not match COMPOSITION.json.`);
  }
  const contractPath = resolveContainedPath(root, source.contract, `${slot} contract path`);
  if (!fs.existsSync(contractPath)) throw new Error(`${slot} slot contract is missing.`);
  contracts[slot] = validateSlotContract(readJson(contractPath), slot);
  const slotRoot = path.join(slotsRoot, slot);
  cloneExact(locked.repository, locked.commit, slotRoot);
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
writeDeterministicJson(path.join(generatedOutput, 'license-inventory.json'), makeLicenseInventory(contracts));
writeDeterministicJson(path.join(generatedOutput, 'state.json'), {
  schema: 1,
  slots: Object.fromEntries(SLOT_NAMES.map((slot) => [slot, {
    commit: lock.slots[slot].commit,
    id: contracts[slot].id,
    component: contracts[slot].adapter || contracts[slot].entry,
    componentOwner: contracts[slot].adapter ? 'composition' : 'repository'
  }]))
});
writeDeterministicJson(lockPath, lock);
console.log(`Composed ${contracts.desktop.id} + ${contracts.mobile.id}.`);

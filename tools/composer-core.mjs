import fs from 'node:fs';
import path from 'node:path';

export const COMPOSITION_SCHEMA = 'thetree-skin-composition/v1';
export const COMPOSITION_RESOLUTION_SCHEMA = 'thetree-skin-composition-resolution/v1';
export const SLOT_CONTRACT_SCHEMA = 'thetree-skin-slot-contract/v1';
export const COMPOSABLE_SKIN_SCHEMA = 'thetree-composable-skin/v1';
export const RUNTIME_CONTRACT_SCHEMA = 'thetree-skin-composer-runtime/v1';
export const SLOT_NAMES = Object.freeze(['desktop', 'mobile']);

export function packageManagerScriptMatches(command, executablePath) {
  if (!command || !executablePath) return false;
  const executableName = path.basename(executablePath).toLowerCase()
    .replace(/-cli(?=\.(?:c?js|mjs)$)/, '')
    .replace(/\.(?:c?js|mjs|cmd)$/i, '');
  return executableName === String(command).toLowerCase();
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

export function validateComposition(composition) {
  if (composition?.schema !== COMPOSITION_SCHEMA) {
    throw new Error(`Unsupported composition schema ${composition?.schema || 'none'}.`);
  }
  for (const slot of SLOT_NAMES) {
    const value = composition.slots?.[slot];
    assertString(value?.repository, `slots.${slot}.repository`);
    assertString(value?.ref, `slots.${slot}.ref`);
    if (value?.contract !== undefined) assertRelativePath(value.contract, `slots.${slot}.contract`);
  }
  return composition;
}

export function makeCompositionResolution(composition, resolveCommit) {
  return {
    schema: COMPOSITION_RESOLUTION_SCHEMA,
    slots: Object.fromEntries(SLOT_NAMES.map((slot) => {
      const source = composition.slots[slot];
      const commit = resolveCommit(source.repository, source.ref);
      if (!/^[0-9a-f]{40}$/.test(commit)) {
        throw new Error(`Resolved ${slot} commit is not a full Git object id.`);
      }
      return [slot, {
        repository: source.repository,
        ref: source.ref,
        commit
      }];
    }))
  };
}

function assertRelativePath(value, label) {
  const relativePath = assertString(value, label);
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
    throw new Error(`${label} escapes its owner.`);
  }
  return relativePath;
}

export function resolveContainedPath(root, relativePath, label) {
  const safeRelativePath = assertRelativePath(relativePath, label);
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(root, safeRelativePath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} escapes its owner.`);
  }
  return resolvedPath;
}

export function validateSlotContract(contract, slot) {
  if (contract?.schema !== SLOT_CONTRACT_SCHEMA) {
    throw new Error(`${slot} slot has unsupported contract schema ${contract?.schema || 'none'}.`);
  }
  assertString(contract.id, `${slot} slot id`);
  const hasEntry = typeof contract.entry === 'string' && contract.entry.trim();
  const hasAdapter = typeof contract.adapter === 'string' && contract.adapter.trim();
  if (Boolean(hasEntry) === Boolean(hasAdapter)) {
    throw new Error(`${slot} slot must declare exactly one of entry or adapter.`);
  }
  if (hasEntry) assertRelativePath(contract.entry, `${slot} slot entry`);
  if (hasAdapter) assertRelativePath(contract.adapter, `${slot} slot adapter`);
  if (contract.contentSurface !== 'host') throw new Error(`${slot} slot must preserve the host content surface.`);
  if (!Array.isArray(contract.configNamespaces)) throw new Error(`${slot} slot must declare configNamespaces.`);
  if (!Array.isArray(contract.sharedConfigKeys)) throw new Error(`${slot} slot must declare sharedConfigKeys.`);
  contract.configNamespaces.forEach((namespace) => {
    const normalized = assertString(namespace, `${slot} config namespace`);
    if (!/^skin\.[a-z0-9](?:[a-z0-9_-]*\.?)*$/i.test(normalized)) {
      throw new Error(`${slot} config namespace must be a skin.* namespace.`);
    }
  });
  contract.sharedConfigKeys.forEach((key) => {
    const normalized = assertString(key, `${slot} shared config key`);
    if (!/^wiki\.[a-z0-9][a-z0-9_.-]*$/i.test(normalized)) {
      throw new Error(`${slot} shared config key must be an exact public wiki.* key.`);
    }
  });
  assertString(contract.license, `${slot} slot license`);
  if (contract.prepare !== undefined) {
    if (!Array.isArray(contract.prepare) || !contract.prepare.length) {
      throw new Error(`${slot} slot prepare must be a non-empty argument array when declared.`);
    }
    contract.prepare.forEach((word) => assertString(word, `${slot} prepare argument`));
  }
  return contract;
}

export function normalizeComposableSkin(manifest, slot) {
  if (manifest?.schema !== COMPOSABLE_SKIN_SCHEMA) {
    throw new Error(`${slot} self-description has unsupported schema ${manifest?.schema || 'none'}.`);
  }
  let prepare = manifest.prepare;
  if (prepare === undefined && typeof manifest.bootstrap === 'string') {
    const words = manifest.bootstrap.trim().split(/\s+/).filter(Boolean);
    if (words.length) prepare = words;
  }
  return validateSlotContract({
    schema: SLOT_CONTRACT_SCHEMA,
    id: manifest.id,
    entry: manifest.entry,
    adapter: manifest.adapter,
    contentSurface: manifest.contentSurface,
    configNamespaces: manifest.configNamespaces || [],
    sharedConfigKeys: manifest.sharedConfigKeys || [],
    license: manifest.license,
    ...(prepare ? { prepare } : {})
  }, slot);
}

export function inferNativeSlotContract(slotRoot, slot) {
  const packagePath = path.join(slotRoot, 'package.json');
  const packageData = fs.existsSync(packagePath) ? readJson(packagePath) : {};
  return validateSlotContract({
    schema: SLOT_CONTRACT_SCHEMA,
    id: packageData.name || `native-${slot}`,
    entry: 'layout.vue',
    contentSurface: 'host',
    configNamespaces: [],
    sharedConfigKeys: [],
    license: packageData.license || 'UNKNOWN'
  }, slot);
}

export function validateConfigBoundaries(manifests) {
  const owners = new Map();
  for (const slot of SLOT_NAMES) {
    for (const namespace of manifests[slot].configNamespaces) {
      assertString(namespace, `${slot} config namespace`);
      const slots = owners.get(namespace) || new Set();
      slots.add(slot);
      owners.set(namespace, slots);
    }
  }
  return Object.fromEntries([...owners].map(([namespace, slots]) => [namespace, [...slots]]));
}

export function renderSlotLoaders(contracts, mobileFrontendContract) {
  const lines = [
    '/* @generated by tools/bootstrap.mjs; do not hand-edit. */',
    "import { defineAsyncComponent } from 'vue';",
    `export const mobileFrontendContract = Object.freeze(${JSON.stringify(mobileFrontendContract)});`,
    'export const slotComponents = Object.freeze({'
  ];
  SLOT_NAMES.forEach((slot, index) => {
    const contract = contracts[slot];
    const importPath = contract.adapter
      ? `../../${contract.adapter.replaceAll('\\', '/')}`
      : `../slots/${slot}/${contract.entry.replaceAll('\\', '/')}`;
    lines.push(`  ${slot}: defineAsyncComponent(() => import('${importPath}'))${index === SLOT_NAMES.length - 1 ? '' : ','}`);
  });
  lines.push('});', '');
  return lines.join('\n');
}

export function makeLicenseInventory(contracts) {
  return {
    schema: 1,
    composerLicense: 'MIT',
    slots: Object.fromEntries(SLOT_NAMES.map((slot) => [slot, {
      id: contracts[slot].id,
      license: contracts[slot].license
    }]))
  };
}

export function makeRuntimeContract(contracts) {
  return {
    schema: RUNTIME_CONTRACT_SCHEMA,
    configNamespaces: [...new Set(SLOT_NAMES.flatMap((slot) => contracts[slot].configNamespaces))].sort(),
    sharedConfigKeys: [...new Set(SLOT_NAMES.flatMap((slot) => contracts[slot].sharedConfigKeys))].sort()
  };
}

export function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

export function writeDeterministicJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

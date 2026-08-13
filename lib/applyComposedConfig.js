const PAYLOAD_SCHEMA = 'thetree-composed-skin-config/v1';

function rememberOriginal(config, key, base) {
  if (!base.has(key) && Object.prototype.hasOwnProperty.call(config, key)) base.set(key, config[key]);
}

export function applyComposedConfig({
  config,
  payload,
  binding = {},
  hostSkinName,
  previousBase = new Map(),
  previousKeys = []
}) {
  for (const key of previousKeys) {
    if (previousBase.has(key)) config[key] = previousBase.get(key);
    else delete config[key];
  }

  const base = new Map();
  const keys = new Set();
  if (payload?.schema !== PAYLOAD_SCHEMA || !payload.values || Array.isArray(payload.values)) {
    return { base, keys: [] };
  }

  for (const [key, value] of Object.entries(payload.values)) {
    const namespaced = payload.configNamespaces?.some((namespace) => key.startsWith(`${namespace}.`));
    const shared = payload.sharedConfigKeys?.includes(key);
    if (!namespaced && !shared) continue;
    rememberOriginal(config, key, base);
    config[key] = value;
    keys.add(key);
  }

  if (typeof hostSkinName === 'string' && hostSkinName) {
    const hostPrefix = `skin.${hostSkinName}.`;
    for (const namespace of binding.hostFallbackNamespaces || []) {
      const sourcePrefix = `${namespace}.`;
      for (const [key, value] of Object.entries(config)) {
        if (!key.startsWith(sourcePrefix)) continue;
        const hostKey = `${hostPrefix}${key.slice(sourcePrefix.length)}`;
        if (Object.prototype.hasOwnProperty.call(config, hostKey)) continue;
        config[hostKey] = value;
        keys.add(hostKey);
      }
    }
  }

  return { base, keys: [...keys] };
}

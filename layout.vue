<template>
  <component :is="activeSlotComponent" :data-tt-composition-slot="activeSlot" />
</template>

<script>
import { mobileFrontendContract, slotComponents } from './.skin-composer/generated/slot-loaders.js';
import { resolveCompositionSlot } from './lib/resolveCompositionSlot.js';

export default {
  name: 'TheTreeComposedSkin',
  data() {
    return { composedConfigBase: new Map(), composedConfigKeys: [] };
  },
  computed: {
    activeSlot() {
      return resolveCompositionSlot(this.$store.state.page?.data || {}, mobileFrontendContract);
    },
    activeSlotComponent() {
      return slotComponents[this.activeSlot];
    }
  },
  watch: {
    '$store.state.page.data.thetreeComposedSkinConfig': {
      immediate: true,
      deep: true,
      handler(payload) {
        this.applyComposedConfig(payload);
      }
    }
  },
  methods: {
    applyComposedConfig(payload) {
      const state = this.$store?.state;
      if (!state?.config) return;
      state.$patch((current) => {
        for (const key of this.composedConfigKeys) {
          if (this.composedConfigBase.has(key)) current.config[key] = this.composedConfigBase.get(key);
          else delete current.config[key];
        }
        this.composedConfigBase = new Map();
        this.composedConfigKeys = [];
        if (payload?.schema !== 'thetree-composed-skin-config/v1' || !payload.values || Array.isArray(payload.values)) return;
        for (const [key, value] of Object.entries(payload.values)) {
          const namespaced = payload.configNamespaces?.some((namespace) => key.startsWith(`${namespace}.`));
          const shared = payload.sharedConfigKeys?.includes(key);
          if (!namespaced && !shared) continue;
          if (Object.prototype.hasOwnProperty.call(current.config, key)) this.composedConfigBase.set(key, current.config[key]);
          current.config[key] = value;
          this.composedConfigKeys.push(key);
        }
      });
    }
  }
};
</script>

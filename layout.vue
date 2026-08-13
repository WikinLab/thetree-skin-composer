<template>
  <component :is="activeSlotComponent" :data-tt-composition-slot="activeSlot" />
</template>

<script>
import { mobileFrontendContract, slotComponents, slotConfigBindings } from './.skin-composer/generated/slot-loaders.js';
import { resolveCompositionSlot } from './lib/resolveCompositionSlot.js';
import { applyComposedConfig } from './lib/applyComposedConfig.js';

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
    },
    activeSlot() {
      this.applyComposedConfig(this.$store.state.page?.data?.thetreeComposedSkinConfig);
    }
  },
  methods: {
    applyComposedConfig(payload) {
      const state = this.$store?.state;
      if (!state?.config) return;
      state.$patch((current) => {
        const result = applyComposedConfig({
          config: current.config,
          payload,
          binding: slotConfigBindings[this.activeSlot],
          hostSkinName: __THETREE_SKIN_NAME__,
          previousBase: this.composedConfigBase,
          previousKeys: this.composedConfigKeys
        });
        this.composedConfigBase = result.base;
        this.composedConfigKeys = result.keys;
      });
    }
  }
};
</script>

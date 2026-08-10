<template>
  <component :is="activeSlotComponent" :data-tt-composition-slot="activeSlot" />
</template>

<script>
import { mobileFrontendContract, slotComponents } from './.skin-composer/generated/slot-loaders.js';
import { resolveCompositionSlot } from './lib/resolveCompositionSlot.js';

export default {
  name: 'TheTreeComposedSkin',
  computed: {
    activeSlot() {
      return resolveCompositionSlot(this.$store.state.page?.data || {}, mobileFrontendContract);
    },
    activeSlotComponent() {
      return slotComponents[this.activeSlot];
    }
  }
};
</script>

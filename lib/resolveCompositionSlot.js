export const DESKTOP_SLOT = 'desktop';
export const MOBILE_SLOT = 'mobile';

export function resolveCompositionSlot(pageData = {}, contract = {}) {
  const signal = pageData?.[contract.publicDataKey];
  return signal?.schema === contract.dataSchema && signal?.[contract.modeField] === contract.mobileMode
    ? MOBILE_SLOT
    : DESKTOP_SLOT;
}

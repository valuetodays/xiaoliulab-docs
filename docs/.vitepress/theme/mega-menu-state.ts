import { readonly, ref } from 'vue';

const CLOSE_DELAY = 150;
const isOpen = ref(false);
const activeTrigger = ref<HTMLElement>();
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let focusFirstLink: (() => void) | undefined;

function cancelClose() {
  if (closeTimer !== undefined) {
    clearTimeout(closeTimer);
    closeTimer = undefined;
  }
}

export function openMegaMenu(trigger?: HTMLElement) {
  cancelClose();
  if (trigger) activeTrigger.value = trigger;
  isOpen.value = true;
}

export function closeMegaMenu({ restoreFocus = false } = {}) {
  cancelClose();
  isOpen.value = false;
  if (restoreFocus) activeTrigger.value?.focus();
}

export function scheduleMegaMenuClose() {
  cancelClose();
  closeTimer = setTimeout(() => {
    isOpen.value = false;
    closeTimer = undefined;
  }, CLOSE_DELAY);
}

export function registerMegaMenuFocusHandler(handler?: () => void) {
  focusFirstLink = handler;
}

export function openMegaMenuAndFocus(trigger: HTMLElement) {
  openMegaMenu(trigger);
  focusFirstLink?.();
}

export const megaMenuOpen = readonly(isOpen);

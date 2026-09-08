<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getMegaMenuGroupForTrigger,
  type MegaMenuTriggerText,
} from '../mega-menu';
import {
  closeMegaMenu,
  megaMenuOpen,
  openMegaMenu,
  openMegaMenuAndFocus,
  scheduleMegaMenuClose,
} from '../mega-menu-state';

const props = defineProps<{
  text: MegaMenuTriggerText;
  screenMenu?: boolean;
}>();

const mobileOpen = ref(false);
const mobileGroup = computed(() => getMegaMenuGroupForTrigger(props.text));
const mobileGroupId = computed(() => `mega-menu-mobile-${props.text}`);

function eventTarget(event: Event) {
  return event.currentTarget as HTMLElement;
}

function handleDesktopClick(event: MouseEvent) {
  openMegaMenu(eventTarget(event));
}

function openAndFocus(event: KeyboardEvent) {
  openMegaMenuAndFocus(eventTarget(event));
}
</script>

<template>
  <div v-if="screenMenu" class="mega-menu-mobile-group">
    <button
      class="mega-menu-mobile-button"
      type="button"
      :aria-controls="mobileGroupId"
      :aria-expanded="mobileOpen"
      @click="mobileOpen = !mobileOpen"
    >
      <span>{{ text }}</span>
      <span class="mega-menu-mobile-icon" aria-hidden="true">+</span>
    </button>
    <div v-show="mobileOpen" :id="mobileGroupId" class="mega-menu-mobile-items">
      <a
        v-for="item in mobileGroup.items"
        :key="item.link"
        class="mega-menu-mobile-link"
        :href="item.link"
      >
        {{ item.text }}
      </a>
    </div>
  </div>

  <button
    v-else
    class="mega-menu-trigger"
    type="button"
    aria-haspopup="true"
    aria-controls="site-mega-menu"
    :aria-expanded="megaMenuOpen"
    @mouseenter="openMegaMenu(eventTarget($event))"
    @mouseleave="scheduleMegaMenuClose"
    @focus="openMegaMenu(eventTarget($event))"
    @blur="scheduleMegaMenuClose"
    @click="handleDesktopClick"
    @keydown.down.prevent="openAndFocus"
    @keydown.enter.prevent="openAndFocus"
    @keydown.space.prevent="openAndFocus"
    @keydown.esc="closeMegaMenu({ restoreFocus: true })"
  >
    {{ text }}
  </button>
</template>

<style scoped>
.mega-menu-trigger {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: var(--vp-nav-height);
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 500;
  line-height: var(--vp-nav-height);
  transition: color 0.25s;
}

.mega-menu-trigger:hover,
.mega-menu-trigger:focus-visible,
.mega-menu-trigger[aria-expanded='true'] {
  color: var(--vp-c-brand-1);
}

.mega-menu-trigger:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -6px;
  border-radius: 8px;
}

.mega-menu-mobile-group {
  border-bottom: 1px solid var(--vp-c-divider);
}

.mega-menu-mobile-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 4px 11px 0;
  width: 100%;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
  transition: color 0.25s;
}

.mega-menu-mobile-button:hover,
.mega-menu-mobile-button[aria-expanded='true'] {
  color: var(--vp-c-brand-1);
}

.mega-menu-mobile-icon {
  font-size: 20px;
  font-weight: 300;
  transition: transform 0.25s;
}

.mega-menu-mobile-button[aria-expanded='true'] .mega-menu-mobile-icon {
  transform: rotate(45deg);
}

.mega-menu-mobile-items {
  padding: 0 0 10px 12px;
}

.mega-menu-mobile-link {
  display: block;
  padding: 6px 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 24px;
  transition: color 0.25s;
}

.mega-menu-mobile-link:hover {
  color: var(--vp-c-brand-1);
}
</style>

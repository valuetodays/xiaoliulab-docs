<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  ref,
  type ComponentPublicInstance,
} from 'vue';
import { megaMenuGroups } from '../mega-menu';
import {
  closeMegaMenu,
  megaMenuOpen,
  openMegaMenu,
  registerMegaMenuFocusHandler,
  scheduleMegaMenuClose,
} from '../mega-menu-state';

const firstLink = ref<HTMLAnchorElement>();

registerMegaMenuFocusHandler(() => {
  void nextTick(() => firstLink.value?.focus());
});

function setFirstLink(element: Element | ComponentPublicInstance | null) {
  firstLink.value = element instanceof HTMLAnchorElement ? element : undefined;
}

onBeforeUnmount(() => {
  registerMegaMenuFocusHandler();
  closeMegaMenu();
});

function handleFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget;
  const currentTarget = event.currentTarget as HTMLElement;

  if (!(nextTarget instanceof Node) || !currentTarget.contains(nextTarget)) {
    scheduleMegaMenuClose();
  }
}
</script>

<template>
  <Transition name="mega-menu-fade">
    <div
      v-show="megaMenuOpen"
      id="site-mega-menu"
      class="mega-menu-layer"
      @mouseenter="openMegaMenu()"
      @mouseleave="scheduleMegaMenuClose"
      @focusin="openMegaMenu()"
      @focusout="handleFocusOut"
      @keydown.esc="closeMegaMenu({ restoreFocus: true })"
    >
      <nav class="mega-menu-panel" aria-label="全部栏目">
        <section
          v-for="(group, groupIndex) in megaMenuGroups"
          :key="group.title"
          class="mega-menu-group"
        >
          <h2>{{ group.title }}</h2>
          <a
            v-for="(item, itemIndex) in group.items"
            :key="item.link"
            :ref="groupIndex === 0 && itemIndex === 0 ? setFirstLink : undefined"
            class="mega-menu-link"
            :href="item.link"
            @click="closeMegaMenu()"
          >
            <span>{{ item.text }}</span>
            <span class="mega-menu-link-arrow" aria-hidden="true">→</span>
          </a>
        </section>
      </nav>
    </div>
  </Transition>
</template>

<style scoped>
.mega-menu-layer {
  position: absolute;
  top: var(--vp-nav-height);
  right: max(
    32px,
    calc((100vw - (var(--vp-layout-max-width) - 64px)) / 2)
  );
  z-index: 1;
  padding-top: 8px;
  width: min(760px, calc(100vw - 64px));
  white-space: normal;
}

.mega-menu-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  padding: 24px 28px 26px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: var(--vp-shadow-2);
}

.mega-menu-group h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  padding-bottom: 10px;
  color: var(--vp-c-text-1);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.mega-menu-group h2::before {
  flex: 0 0 auto;
  width: 3px;
  height: 14px;
  background: var(--vp-c-brand-1);
  border-radius: 2px;
  content: '';
}

.mega-menu-link {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 -8px;
  padding: 8px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  border-radius: 8px;
  transition: color 0.2s, background-color 0.2s;
}

.mega-menu-link-arrow {
  flex: 0 0 auto;
  color: var(--vp-c-brand-1);
  transition: transform 0.2s;
}

.mega-menu-link:hover .mega-menu-link-arrow,
.mega-menu-link:focus-visible .mega-menu-link-arrow {
  transform: translateX(5px);
}

.mega-menu-link:hover,
.mega-menu-link:focus-visible {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  outline: none;
}

.mega-menu-link:focus-visible {
  box-shadow: inset 0 0 0 2px var(--vp-c-brand-1);
}

.mega-menu-fade-enter-active,
.mega-menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.mega-menu-fade-enter-from,
.mega-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 767px) {
  .mega-menu-layer {
    display: none;
  }
}

@media (min-width: 960px) {
  .mega-menu-layer {
    position: fixed;
    top: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .mega-menu-fade-enter-active,
  .mega-menu-fade-leave-active {
    transition: none;
  }
}
</style>

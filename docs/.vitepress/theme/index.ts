import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import { applyPageMode } from './utils/page-mode';

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === 'undefined') {
      return;
    }

    applyPageMode();

    const onAfterRouteChange = router.onAfterRouteChange;

    router.onAfterRouteChange = async (to) => {
      await onAfterRouteChange?.(to);
      applyPageMode();
    };
  },
} satisfies Theme;

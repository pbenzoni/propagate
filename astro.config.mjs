import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://propaganda.onl',
  integrations: [tailwind({ applyBaseStyles: false })],
  build: { format: 'directory' },
});

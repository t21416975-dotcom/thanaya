import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://thanaya.com',
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  integrations: [
    tailwind({ applyBaseStyles: true }),
    sitemap({
      changefreq: 'daily',
      priority: 0.8,
    }),
  ],
});

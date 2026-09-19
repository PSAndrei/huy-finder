import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // На GitHub Pages сайт живёт по адресу /huy-finder/.
  base: process.env.CI ? '/huy-finder/' : '/',
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

import { defineConfig } from '@vite-pwa/assets-generator/config'

// Regenerate the icons in public/ with `npm run icons` after changing public/logo.svg.
// The logo is a full-bleed square with the flame inside the maskable safe zone, so no padding is added.
export default defineConfig({
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/logo.svg'],
})

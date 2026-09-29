import { defineConfig } from 'vitest/config';

// Configuración de tests. El motor de física es TypeScript puro (sin React ni
// Three.js), así que no se necesitan plugins para probarlo.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});

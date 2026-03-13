import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  noExternal: ['@aivs/scanner-engine', '@aivs/db', '@aivs/types'],
  sourcemap: true,
  clean: true,
});

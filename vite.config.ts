import { defineConfig } from 'vite';
import ts from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default defineConfig({
  plugins: [
    ts({
      tsconfig: './tsconfig.json' // Ensure your TypeScript configuration is correct
    }),
    nodeResolve({
      preferBuiltins: true, // Important for Node.js environments
      browser: false, // Ensure the environment is set to Node, not browser
    }),
    commonjs(),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/app.ts', // Entry file for your application
      formats: ['cjs'] // Compile as CommonJS, suitable for Node.js
    },
    rollupOptions: {
      external: ['os', 'express', 'fs', 'path'], // Mark Node.js-specific modules as external
    }
  },
  resolve: {
    conditions: ["node"], // Resolve imports based on 'node' conditions
  }
});

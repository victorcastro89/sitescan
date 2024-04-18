import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/app.ts',
  output: {
    dir: 'dist',  // Output directory for chunks
    format: 'cjs',  // Output format as ES module
    sourcemap: true
  },
  plugins: [
    json(), 
    nodeResolve({
      extensions: ['.js', '.ts'],
      preferBuiltins: true // Use Node.js built-in modules if available


    }),
    commonjs({
        include: [
          'node_modules/**', // This includes all CommonJS modules in node_modules
          '/home/victor/sitescan/wappalyzer/src/drivers/npm/**' // Add your specific directory
        ]
      }),
    typescript()
  ]
};

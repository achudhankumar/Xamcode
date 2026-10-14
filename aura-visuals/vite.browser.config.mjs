import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/* Browser IIFE build of the text→diagram engine, consumed by the XamCode
   app (js/aura-diagram.js lazy-loads it into the AURA chat). React is
   inlined so the file is fully self-contained:
     window.AuraDiagram.renderDiagram(text, { theme }) → { svg, width, height, kind, title }
   Run with: npm run build:browser   →   browser/aura-diagram.js            */
export default defineConfig({
  configFile: false,
  logLevel: 'error',
  root,
  esbuild: { jsx: 'automatic' },
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    lib: {
      entry: path.join(root, 'diagram-entry.jsx'),
      name: 'AuraDiagram',
      formats: ['iife'],
      fileName: () => 'aura-diagram.js',
    },
    outDir: path.join(root, 'browser'),
    emptyOutDir: true,
  },
});
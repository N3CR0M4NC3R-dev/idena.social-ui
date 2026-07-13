import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            stream: fileURLToPath(new URL('./src/shims/stream.ts', import.meta.url)),
        },
    },
    build: {
        chunkSizeWarningLimit: 1000,
    },
});

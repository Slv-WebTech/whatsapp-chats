import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/whatsapp-chats/',
    plugins: [react({ include: /\.[jt]sx?$/ })],
    server: {
        port: 1432,
        strictPort: true
    },
    esbuild: {
        loader: 'jsx',
        include: /src\/.*\.js$/,
        exclude: []
    },
    optimizeDeps: {
        esbuildOptions: {
            loader: {
                '.js': 'jsx'
            }
        }
    }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const base = '/';
    const appVersion = process.env.npm_package_version || '0.0.0';

    return {
        base,
        define: {
            __APP_VERSION__: JSON.stringify(appVersion)
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules/firebase')) {
                            return 'vendor-firebase';
                        }

                        if (id.includes('node_modules/recharts')) {
                            return 'vendor-recharts';
                        }

                        return undefined;
                    }
                }
            }
        },
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
    };
});

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

                        if (id.includes('node_modules/framer-motion')) {
                            return 'vendor-motion';
                        }

                        if (id.includes('node_modules/lucide-react')) {
                            return 'vendor-icons';
                        }

                        if (id.includes('node_modules/react-virtuoso')) {
                            return 'vendor-chat-virtualization';
                        }

                        return undefined;
                    }
                }
            }
        },
        plugins: [react()],
        server: {
            port: 5173,
            strictPort: false
        },
        esbuild: {
            loader: 'jsx',
            include: /src[/\\].*\.jsx?$/,
            exclude: []
        },
        optimizeDeps: {
            esbuildOptions: {
                loader: {
                    '.js': 'jsx',
                    '.jsx': 'jsx'
                }
            }
        }
    };
});

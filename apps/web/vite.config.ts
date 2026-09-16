import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so assets load correctly from file:// in the desktop app
  base: './',
  // apps/web n'a pas son propre .env — les VITE_* (Supabase, API URL) vivent
  // dans le .env à la racine du monorepo, seule source de vérité partagée
  // avec apps/api. Sans ça, Vite ne charge rien et supabase.ts retombe sur
  // son URL factice (placeholder.supabase.co) : toute connexion échoue,
  // quels que soient les identifiants.
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Résolution explicite des packages workspace depuis le contexte apps/web
      // Cela permet à Vite de trouver clsx, framer-motion etc. via apps/web/node_modules
      '@maideres/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@maideres/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@maideres/ai': path.resolve(__dirname, '../../packages/ai/src/index.ts'),
      '@maideres/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@maideres/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
  optimizeDeps: {
    include: [
      'clsx',
      'tailwind-merge',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-toast',
      '@radix-ui/react-popover',
    ],
  },
  server: {
    port: 5173,
    fs: {
      // Autorise Vite à servir des fichiers depuis la racine du monorepo
      allow: ['../..'],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'sonner'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
})

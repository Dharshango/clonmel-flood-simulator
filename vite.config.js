import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api/opw': {
        target: 'https://waterlevel.ie',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opw/, ''),
        headers: {
          'User-Agent': 'ClonmelFloodForecasting/1.0'
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0
  }
});

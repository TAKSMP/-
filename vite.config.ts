import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Mac の名前（〜.local）でも つなげるように する。
    // IPは Wi-Fi が かわると 変わってしまうので、名前で つないだ ほうが
    // ブラウザの ほぞんデータ（ずかん）も そのまま のこる。
    allowedHosts: ['.local'],
  },
})

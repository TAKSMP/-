import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// ビルドごとの ばんごう（つうしんバトルで あいての アプリと ばんが ちがう ときに けいこくする ため）
const buildId = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', '-').replace(':', '')

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// スマホ配布用: すべてを1つのHTMLファイルにまとめてビルドする設定。
// npm run build:single でつかいます。
// ビルドごとの ばんごう（つうしんバトルで あいての アプリと ばんが ちがう ときに けいこくする ため）
const buildId = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', '-').replace(':', '')

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
})

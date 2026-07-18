// 写真を保存・送信まえに、ほどよいサイズに小さくする。
// もとの写真はスマホだと数MBになり、そのまま localStorage に入れると
// すぐ容量オーバーになる。長辺を maxDim までちぢめ、JPEGで軽くする。
// 虫の判定には1024pxもあれば十分。
export async function compressImage(
  dataUrl: string,
  maxDim = 1024,
  quality = 0.72,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (!width || !height) {
        resolve(dataUrl)
        return
      }
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        const out = canvas.toDataURL('image/jpeg', quality)
        // まれに圧縮後のほうが大きいことがある。その時はもとを使う。
        resolve(out.length < dataUrl.length ? out : dataUrl)
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

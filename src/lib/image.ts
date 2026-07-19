// dataURL を PNG の Blob にする（クリップボード用）
function dataUrlToPngBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      if (!ctx) {
        reject(new Error('no ctx'))
        return
      }
      ctx.drawImage(img, 0, 0)
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('no blob'))),
        'image/png',
      )
    }
    img.onerror = () => reject(new Error('img load failed'))
    img.src = dataUrl
  })
}

// 写真をクリップボードにコピーする（ChatGPTなどに ペーストできる）。
// できなければ false。
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const clip = navigator.clipboard
    const CI = window.ClipboardItem
    if (!clip || !CI || !clip.write) return false
    // Safari 対策で Blob の Promise をそのまま わたす（ユーザー操作の間に生成）
    await clip.write([new CI({ 'image/png': dataUrlToPngBlob(dataUrl) })])
    return true
  } catch (e) {
    console.warn('写真のコピーにしっぱい', e)
    return false
  }
}

// dataURL のおおよそのバイト数
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  if (i < 0) return dataUrl.length
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4)
}

// 写真を保存まえに、しっかり小さくする。
// localStorage は約5MBしかないので、たくさん（200件以上）ためられるよう、
// 目標サイズ（既定22KB）いかになるまで、サイズと画質を だんだん下げていく。
// 図鑑の表示は最大でも300pxくらいなので、512px・低画質でも見た目は十分。
export async function compressImage(
  dataUrl: string,
  maxDim = 512,
  targetBytes = 22000,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ow = img.naturalWidth
      const oh = img.naturalHeight
      if (!ow || !oh) {
        resolve(dataUrl)
        return
      }
      let best = dataUrl
      let bestLen = dataUrlBytes(dataUrl)
      const dims = [maxDim, Math.round(maxDim * 0.75), Math.round(maxDim * 0.55)]
      const quals = [0.55, 0.42, 0.32]
      for (const dim of dims) {
        let w = ow
        let h = oh
        if (w > dim || h > dim) {
          const s = dim / Math.max(w, h)
          w = Math.round(w * s)
          h = Math.round(h * s)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.drawImage(img, 0, 0, w, h)
        for (const q of quals) {
          let out: string
          try {
            out = canvas.toDataURL('image/jpeg', q)
          } catch {
            continue
          }
          const len = dataUrlBytes(out)
          if (len < bestLen) {
            best = out
            bestLen = len
          }
          if (len <= targetBytes) {
            resolve(out)
            return
          }
        }
      }
      resolve(best) // 目標いかにできなければ、いちばん小さいもの
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

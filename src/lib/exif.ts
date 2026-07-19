// 写真ファイル（JPEG）にうめこまれた撮影日時（EXIF）を読み取る。
// 「みつけた日」の初期値につかう。外部ライブラリはつかわない、小さなパーサー。
// 読めなければ null をかえす（PNGや、撮影日のない写真など）。

function readAsciiTag(
  view: DataView,
  tiff: number,
  ifdStart: number,
  tag: number,
  le: boolean,
): string | null {
  const count = view.getUint16(ifdStart, le)
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12
    if (view.getUint16(entry, le) !== tag) continue
    const type = view.getUint16(entry + 2, le)
    const num = view.getUint32(entry + 4, le)
    if (type !== 2 || num === 0) return null // ASCII 以外はスキップ
    const valOffset = num <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, le)
    let s = ''
    for (let j = 0; j < num - 1; j++) {
      s += String.fromCharCode(view.getUint8(valOffset + j))
    }
    return s
  }
  return null
}

function readPointerTag(
  view: DataView,
  tiff: number,
  ifdStart: number,
  tag: number,
  le: boolean,
): number | null {
  const count = view.getUint16(ifdStart, le)
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12
    if (view.getUint16(entry, le) === tag) {
      return tiff + view.getUint32(entry + 8, le)
    }
  }
  return null
}

// "YYYY:MM:DD HH:MM:SS" → ミリ秒
function exifDateToMs(s: string): number | null {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const ms = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  ).getTime()
  return Number.isFinite(ms) ? ms : null
}

function parseExif(view: DataView, start: number): number | null {
  // "Exif" ではじまるか
  if (view.getUint32(start) !== 0x45786966) return null
  const tiff = start + 6
  const byteOrder = view.getUint16(tiff)
  const le = byteOrder === 0x4949 // II=リトルエンディアン
  if (!le && byteOrder !== 0x4d4d) return null // MM=ビッグエンディアン
  const ifd0 = tiff + view.getUint32(tiff + 4, le)

  let dateStr: string | null = null
  const exifIfd = readPointerTag(view, tiff, ifd0, 0x8769, le) // Exif IFD へのポインタ
  if (exifIfd !== null) {
    dateStr =
      readAsciiTag(view, tiff, exifIfd, 0x9003, le) || // DateTimeOriginal
      readAsciiTag(view, tiff, exifIfd, 0x9004, le) // DateTimeDigitized
  }
  if (!dateStr) dateStr = readAsciiTag(view, tiff, ifd0, 0x0132, le) // DateTime
  if (!dateStr) return null
  return exifDateToMs(dateStr)
}

// 写真ファイルから撮影日時（ミリ秒）を読む。読めなければ null。
export async function readPhotoDate(file: File): Promise<number | null> {
  try {
    const buf = await file.arrayBuffer()
    const view = new DataView(buf)
    const len = view.byteLength
    if (len < 4 || view.getUint16(0) !== 0xffd8) return null // JPEGではない

    let offset = 2
    while (offset + 4 <= len) {
      if (view.getUint8(offset) !== 0xff) break
      const marker = view.getUint8(offset + 1)
      if (marker === 0xda) break // 画像データのはじまり
      const size = view.getUint16(offset + 2)
      if (marker === 0xe1) {
        // APP1（EXIF）
        return parseExif(view, offset + 4)
      }
      offset += 2 + size
    }
    return null
  } catch {
    return null
  }
}

// Shrink and compress an image before upload so Drive space lasts.
export async function compressImage(source, { maxSide = 1280, quality = 0.75, targetBytes = 500 * 1024 } = {}) {
  const img = source instanceof Blob ? await blobToImage(source) : source
  const w0 = img.videoWidth || img.naturalWidth || img.width
  const h0 = img.videoHeight || img.naturalHeight || img.height
  const scale = Math.min(1, maxSide / Math.max(w0, h0))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w0 * scale); canvas.height = Math.round(h0 * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  let blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
  if (blob.size > targetBytes) blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.55))
  return blob
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { resolve(img); URL.revokeObjectURL(img.src) }
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

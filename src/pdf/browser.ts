let fontPromise: Promise<Uint8Array> | undefined;
export function loadFont() {
  fontPromise ??= fetch(`${import.meta.env.BASE_URL}fonts/NotoSansCJKtc-Regular.otf`).then(async r => {
    if (!r.ok) throw new Error('中文字型載入失敗，請檢查連線後重試。');
    return new Uint8Array(await r.arrayBuffer());
  }).catch(error => { fontPromise = undefined; throw error; });
  return fontPromise;
}
export function download(bytes: Uint8Array | string, name: string, type: string) {
  const blob = new Blob([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

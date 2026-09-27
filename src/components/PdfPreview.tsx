import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText } from 'lucide-react';
// Legacy build bundles polyfills (e.g. Map#getOrInsertComputed) that the modern build
// assumes; without them older Chrome/Edge and in-app browsers never finish rendering.
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export function PdfPreview({ bytes }: { bytes: Uint8Array | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState('');
  useEffect(() => {
    setDoc(null);
    setPage(1);
    setError('');
    if (!bytes) return;
    const task = getDocument({ data: bytes.slice() });
    let active = true;
    task.promise
      .then((value) => {
        if (active) setDoc(value);
      })
      .catch((e) => {
        if (active) setError(`預覽失敗：${e.message}`);
      });
    return () => {
      active = false;
      void task.destroy();
    };
  }, [bytes]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let cancelled = false;
    let render: { cancel: () => void } | undefined;
    const fail = (e: unknown) => {
      if (!cancelled)
        setError(
          `預覽失敗：${e instanceof Error ? e.message : String(e)}。可改用最新版 Chrome／Edge，或直接下載 PDF 檢查。`,
        );
    };
    doc
      .getPage(page)
      .then(async (p) => {
        if (cancelled || !canvas.current) return;
        const el = canvas.current,
          viewport = p.getViewport({ scale: 1.35 * zoom });
        el.width = viewport.width;
        el.height = viewport.height;
        delete el.dataset.rendered;
        const context = el.getContext('2d');
        if (!context) return;
        const task = p.render({ canvasContext: context, canvas: el, viewport });
        render = task;
        try {
          await task.promise;
          if (!cancelled) el.dataset.rendered = `${page}:${zoom}`;
        } catch (e) {
          fail(e);
        }
      })
      .catch(fail);
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [doc, page, zoom]);
  if (!bytes)
    return (
      <div className="empty-preview">
        <FileText size={36} />
        <strong>讓標籤，準備好上架。</strong>
        <p>
          填寫左側資料，按「更新預覽」
          <br />
          即可檢查實際輸出的 A4 PDF。
        </p>
      </div>
    );
  return (
    <>
      <div className="pdf-toolbar">
        <div>
          <button
            aria-label="上一頁"
            disabled={!doc || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page} / {doc?.numPages ?? '…'}
          </span>
          <button
            aria-label="下一頁"
            disabled={!doc || page >= doc.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div>
          <button aria-label="縮小" disabled={zoom <= 1} onClick={() => setZoom((z) => z - 0.25)}>
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="放大" disabled={zoom >= 2} onClick={() => setZoom((z) => z + 0.25)}>
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      <div className="pdf-scroll">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <canvas ref={canvas} aria-label="A4 PDF 預覽" style={{ width: `${100 * zoom}%` }} />
        )}
      </div>
    </>
  );
}

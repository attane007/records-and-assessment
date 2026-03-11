"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type {
  CreateSignSessionResponse,
  SignSessionStatusResponse,
  UpdateSignatureRequestBody,
} from "@/lib/types/api";

type Method = "draw" | "upload" | "qr";

type SignatureCapturePanelProps = {
  title: string;
  description?: string;
  allowQr?: boolean;
  submitLabel?: string;
  submitSignature: (payload: UpdateSignatureRequestBody) => Promise<void>;
  requestQrSession?: () => Promise<CreateSignSessionResponse>;
  onComplete: () => void;
};

const DRAW_HEIGHT = 220;

export default function SignatureCapturePanel({
  title,
  description,
  allowQr = false,
  submitLabel = "ลงนาม",
  submitSignature,
  requestQrSession,
  onComplete,
}: SignatureCapturePanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [method, setMethod] = useState<Method>("draw");
  const [drawData, setDrawData] = useState<string>("");
  const [uploadData, setUploadData] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [uploadName, setUploadName] = useState("");

  const [qrSession, setQrSession] = useState<CreateSignSessionResponse | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrMessage, setQrMessage] = useState("");
  const [consent, setConsent] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isMobile && method === "qr") {
      setMethod("draw");
    }
  }, [isMobile, method]);

  const methods = useMemo(() => {
    const list: Array<{ id: Method; label: string; hint: string }> = [
      { id: "draw", label: "วาดลายเซ็นต์", hint: "ใช้เมาส์หรือปากกา" },
      { id: "upload", label: "แนบภาพลายเซ็นต์", hint: "รองรับ PNG/JPG" },
    ];
    if (allowQr && !isMobile) {
      list.push({ id: "qr", label: "สแกน QR ไปมือถือ", hint: "วาดบนมือถือแล้วซิงก์กลับ" });
    }
    return list;
  }, [allowQr, isMobile]);

  const getDevicePixelRatio = useCallback(() => Math.max(window.devicePixelRatio || 1, 1), []);

  const applyStrokeStyle = useCallback((ctx: CanvasRenderingContext2D, ratio: number) => {
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2 * ratio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const fillCanvasBackground = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const syncCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    canvas.style.width = "100%";
    canvas.style.height = `${DRAW_HEIGHT}px`;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const styles = window.getComputedStyle(container);
    const paddingX =
      (Number.parseFloat(styles.paddingLeft) || 0) +
      (Number.parseFloat(styles.paddingRight) || 0);

    let cssWidth = Math.floor(canvasRect.width);
    if (cssWidth <= 0) {
      cssWidth = Math.floor(containerRect.width - paddingX);
    }
    if (cssWidth <= 0) {
      cssWidth = 320;
    }

    const ratio = getDevicePixelRatio();
    const targetWidth = Math.max(1, Math.floor(cssWidth * ratio));
    const targetHeight = Math.max(1, Math.floor(DRAW_HEIGHT * ratio));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    fillCanvasBackground(ctx, canvas);
    applyStrokeStyle(ctx, ratio);

    drawingRef.current = false;
    hasStrokeRef.current = false;
    activePointerIdRef.current = null;
    setDrawData("");
  }, [applyStrokeStyle, fillCanvasBackground, getDevicePixelRatio]);

  useEffect(() => {
    if (method !== "draw") return;

    let frameId = 0;
    const scheduleSync = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncCanvas();
      });
    };

    scheduleSync();

    const container = containerRef.current;
    const onResize = () => scheduleSync();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => scheduleSync());
      observer.observe(container);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [method, syncCanvas]);

  useEffect(() => {
    if (!qrSession?.session_id) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/sign-sessions/${qrSession.session_id}/status`, {
          method: "GET",
          cache: "no-store",
        });
        const data: SignSessionStatusResponse | { error?: string } = await res.json().catch(() => ({}));
        if (!active || !res.ok) return;

        if (data && "status" in data) {
          if (data.status === "completed") {
            setQrMessage("ได้รับลายเซ็นต์จากมือถือแล้ว");
            onComplete();
            return;
          }
          if (data.status === "expired") {
            setQrMessage("QR หมดอายุ กรุณากดแท็บสแกน QR อีกครั้ง");
            setQrSession(null);
            setQrImage("");
          }
        }
      } catch {
        // ignore transient polling errors
      }
    };

    const timer = window.setInterval(poll, 2000);
    void poll();

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [onComplete, qrSession]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    return {
      x: Math.min(Math.max(x, 0), canvas.width),
      y: Math.min(Math.max(y, 0), canvas.height),
    };
  };

  const exportDrawData = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) {
      setDrawData("");
      return;
    }
    setDrawData(canvas.toDataURL("image/png"));
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    drawingRef.current = true;
    activePointerIdRef.current = event.pointerId;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers may reject pointer capture for specific pointer states.
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      drawingRef.current = false;
      activePointerIdRef.current = null;
      return;
    }
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const drawMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    hasStrokeRef.current = true;
  };

  const endDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    const pointerId = activePointerIdRef.current ?? event.pointerId;

    if (drawingRef.current) {
      drawingRef.current = false;
      const ctx = canvas.getContext("2d");
      ctx?.closePath();
      exportDrawData();
    }

    activePointerIdRef.current = null;
    try {
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore release errors when capture was already dropped by the browser.
    }
  };

  const clearDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activePointerIdRef.current !== null) {
      try {
        if (canvas.hasPointerCapture(activePointerIdRef.current)) {
          canvas.releasePointerCapture(activePointerIdRef.current);
        }
      } catch {
        // Ignore release errors when capture is no longer valid.
      }
    }

    fillCanvasBackground(ctx, canvas);
    applyStrokeStyle(ctx, getDevicePixelRatio());

    drawingRef.current = false;
    activePointerIdRef.current = null;
    hasStrokeRef.current = false;
    setDrawData("");
  };

  const onUploadFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("ไฟล์ต้องเป็นรูปภาพเท่านั้น");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!data) {
      setError("ไม่สามารถอ่านไฟล์ภาพได้");
      return;
    }

    setUploadName(file.name);
    setUploadData(data);
    setError("");
  };

  const startQrSession = async () => {
    if (!requestQrSession) return;
    setQrLoading(true);
    setQrMessage("");
    setError("");
    try {
      const session = await requestQrSession();
      const img = await QRCode.toDataURL(session.mobile_url, { width: 240, margin: 1 });
      setQrSession(session);
      setQrImage(img);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถสร้าง QR ได้";
      setError(msg);
    } finally {
      setQrLoading(false);
    }
  };

  const submitCurrent = async () => {
    setError("");
    const payload: UpdateSignatureRequestBody | null =
      method === "draw"
        ? drawData
          ? { data_base64: drawData, method: "draw", signed_via: isMobile ? "mobile" : "web" }
          : null
        : method === "upload"
          ? uploadData
            ? { data_base64: uploadData, method: "upload", signed_via: isMobile ? "mobile" : "web" }
            : null
          : null;

    if (!payload) {
      setError("กรุณาเตรียมลายเซ็นต์ก่อนกดยืนยัน");
      return;
    }

    if (!consent) {
      setError("กรุณากดยืนยันยินยอมการลงนามอิเล็กทรอนิกส์");
      return;
    }

    setSaving(true);
    try {
      await submitSignature(payload);
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "บันทึกลายเซ็นต์ไม่สำเร็จ";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {methods.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMethod(item.id);
              setError("");
              if (item.id === "qr" && !qrSession && !qrLoading) {
                void startQrSession();
              }
            }}
            className={`rounded-xl border px-3 py-2 text-left transition ${method === item.id
                ? "border-cyan-500 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-200"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="text-xs opacity-80">{item.hint}</div>
          </button>
        ))}
      </div>

      {method === "draw" ? (
        <div className="space-y-3">
          <div
            ref={containerRef}
            className="rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <canvas
              ref={canvasRef}
              className="w-full touch-none rounded-lg bg-white"
              onPointerDown={startDraw}
              onPointerMove={drawMove}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
              onPointerLeave={endDraw}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">ลากเมาส์หรือใช้นิ้ววาดลายเซ็นต์ในกรอบ</div>
            <button
              type="button"
              onClick={clearDraw}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ล้างลายเซ็นต์
            </button>
          </div>
        </div>
      ) : null}

      {method === "upload" ? (
        <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture={isMobile ? "environment" : undefined}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0] ?? null;
              void onUploadFile(file);
            }}
            className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:text-white hover:file:bg-cyan-700 dark:text-slate-200"
          />
          {uploadName ? <div className="text-xs text-slate-500 dark:text-slate-400">ไฟล์ที่เลือก: {uploadName}</div> : null}
          {uploadData ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadData} alt="Signature preview" className="max-h-40 w-full object-contain" />
            </div>
          ) : null}
        </div>
      ) : null}

      {method === "qr" ? (
        <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          {!qrSession && qrLoading ? (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-200">
              กำลังสร้าง QR สำหรับมือถือ...
            </div>
          ) : null}

          {qrImage ? (
            <div className="space-y-3 text-center">
              <div className="mx-auto w-fit rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImage} alt="QR code for mobile signing" className="h-56 w-56" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">สแกน QR ด้วยมือถือเพื่อวาดลายเซ็นต์ แล้วหน้านี้จะอัปเดตอัตโนมัติ</div>
              {qrSession?.mobile_url ? (
                <a
                  href={qrSession?.mobile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-700 underline dark:text-cyan-300"
                >
                  เปิดลิงก์บนมือถือโดยตรง
                </a>
              ) : null}
            </div>
          ) : null}

          {qrMessage ? <div className="text-sm text-emerald-700 dark:text-emerald-300">{qrMessage}</div> : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {method !== "qr" ? (
        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                ข้าพเจ้ายืนยันการลงชื่อในเอกสารฉบับนี้ด้วยความสมัครใจ และยอมรับว่าลายมือชื่ออิเล็กทรอนิกส์นี้
                <strong> มีผลผูกพันทางกฎหมาย</strong> ตาม พ.ร.บ. ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void submitCurrent()}
            disabled={saving || !consent}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-blue-700 hover:to-cyan-700 disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none sm:w-auto"
          >
            {saving ? "กำลังบันทึกลายเซ็นต์..." : (consent ? submitLabel : "กรุณากดยืนยันยินยอมก่อน")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

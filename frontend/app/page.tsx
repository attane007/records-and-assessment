"use client";

import Image from "next/image";
import { useState, useRef, useEffect, type ReactNode } from "react";

// validate Thai national ID (13 digits with checksum)
function isValidThaiID(s: string) {
  if (!/^[0-9]{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(s.charAt(i)) * (13 - i);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === Number(s.charAt(12));
}

type FormState = {
  name: string;
  prefix?: string;
  id_card: string;
  date_of_birth: string;
  purpose: string;
  class?: string;
  room?: string;
  academic_year?: string;
  father_name?: string;
  mother_name?: string;
};

export default function Home() {
  const [form, setForm] = useState<FormState>({
  name: "",
  prefix: "",
    id_card: "",
    date_of_birth: "",
    purpose: "",
    class: "",
    room: "",
    academic_year: "",
    father_name: "",
    mother_name: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
  // keep id_card numeric-only
  const nextVal = name === "id_card" ? value.replace(/\D/g, "") : value;
  setForm((s) => ({ ...s, [name]: nextVal }));
    setErrors((e) => ({ ...e, [name]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setErrors({});

    // basic client-side required check
    const required = ["name", "id_card", "date_of_birth", "purpose"];
    const missing: Record<string, string> = {};
    for (const k of required) {
      // @ts-ignore
      if (!form[k] || form[k].toString().trim() === "") missing[k] = "field is required";
    }
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }

    // validate Thai ID checksum on the client
    if (!isValidThaiID(form.id_card)) {
      setErrors((prev) => ({ ...prev, id_card: "เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก พร้อม checksum)" }));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        // backend returns { errors: { field: message } } for validation
        if (data && data.errors) {
          setErrors(data.errors);
          setStatus("validation error");
        } else if (data && data.error) {
          setStatus(data.error);
        } else {
          setStatus("unexpected error");
        }
      } else {
        setStatus("Data saved successfully");
        setForm({
          name: "",
          id_card: "",
          date_of_birth: "",
          purpose: "",
          class: "",
          room: "",
          academic_year: "",
          father_name: "",
          mother_name: "",
        });
      }
    } catch (err) {
      setStatus("network error: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="font-sans min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-black text-foreground">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image className="dark:invert" src="/next.svg" alt="Next.js" width={110} height={24} />
          <span className="text-zinc-400">|</span>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight">บันทึกและแบบประเมิน - Student Records</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
        <Card>
          <CardHeader
            title="ส่งข้อมูลนักเรียน"
            description="กรอกข้อมูลแล้วกดบันทึก ระบบจะส่งไปยัง backend และบันทึกในฐานข้อมูล"
            iconSrc="/file.svg"
          />
          <CardContent>
            <form className="w-full grid gap-5" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="คำนำหน้า">
                  <select name="prefix" value={form.prefix} onChange={handleChange} className={inputCls}>
                    <option value="">เลือก</option>
                    <option value="นาย">นาย</option>
                    <option value="นาง">นาง</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="ด.ช.">ด.ช.</option>
                    <option value="ด.ญ.">ด.ญ.</option>
                  </select>
                </Field>

                <Field label="ชื่อ - สกุล *" error={errors.name}>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="เช่น กานต์ชัย ใจดี"
                    className={inputCls}
                  />
                </Field>

                <Field label="เลขบัตรประชาชน (13 หลัก) *" help="ต้องเป็นตัวเลข 13 หลัก" error={errors.id_card}>
                  <input
                    name="id_card"
                    value={form.id_card}
                    onChange={handleChange}
                    maxLength={13}
                    placeholder="1234567890123"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="วันเกิด (ปฏิทินไทย) *" error={errors.date_of_birth}>
                  <ThaiDatePicker
                    value={form.date_of_birth}
                    onChange={(v) => setForm((s) => ({ ...s, date_of_birth: v }))}
                  />
                </Field>
                <Field label="วัตถุประสงค์ *" error={errors.purpose}>
                  <input
                    name="purpose"
                    value={form.purpose}
                    onChange={handleChange}
                    placeholder="เช่น ขอ ปพ.1"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="ชั้นเรียน">
                  <input name="class" value={form.class} onChange={handleChange} className={inputCls} />
                </Field>
                <Field label="ห้อง">
                  <input name="room" value={form.room} onChange={handleChange} className={inputCls} />
                </Field>
                <Field label="ปีการศึกษา">
                  <input name="academic_year" value={form.academic_year} onChange={handleChange} className={inputCls} />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="ชื่อบิดา">
                  <input name="father_name" value={form.father_name} onChange={handleChange} className={inputCls} />
                </Field>
                <Field label="ชื่อมารดา">
                  <input name="mother_name" value={form.mother_name} onChange={handleChange} className={inputCls} />
                </Field>
              </div>

              {status && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm">
                  {status}
                </div>
              )}

              <div className="flex gap-3 items-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      name: "",
                      id_card: "",
                      date_of_birth: "",
                      purpose: "",
                      class: "",
                      room: "",
                      academic_year: "",
                      father_name: "",
                      mother_name: "",
                    });
                    setErrors({});
                    setStatus(null);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  ล้างฟอร์ม
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="sticky top-6">
          <CardHeader title="ตัวอย่างข้อมูล (Preview)" description="แสดงผลข้อมูลที่กรอกแบบย่อ" iconSrc="/window.svg" />
          <CardContent>
            <div className="grid gap-3 text-sm">
              <KV k="ชื่อ - สกุล" v={form.name || "-"} />
              <KV k="เลขบัตรประชาชน" v={form.id_card || "-"} />
              <KV k="วันเกิด" v={form.date_of_birth || "-"} />
              <KV k="วัตถุประสงค์" v={form.purpose || "-"} />
              <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />
              <KV k="ชั้น/ห้อง" v={`${form.class || "-"}/${form.room || "-"}`} />
              <KV k="ปีการศึกษา" v={form.academic_year || "-"} />
              <KV k="บิดา" v={form.father_name || "-"} />
              <KV k="มารดา" v={form.mother_name || "-"} />
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-zinc-500">
          © {new Date().getFullYear()} Records & Assessment
        </div>
      </footer>
    </div>
  );
}

// UI primitives
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ title, description, iconSrc }: { title: string; description?: string; iconSrc?: string }) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        {iconSrc ? <Image aria-hidden src={iconSrc} alt="" width={20} height={20} className="dark:invert" /> : null}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
    </div>
  );
}

function CardContent({ children }: { children: ReactNode }) {
  return <div className="p-5">{children}</div>;
}

function Field({ label, children, help, error }: { label: string; children: ReactNode; help?: string; error?: string }) {
  return (
    <label className="flex flex-col">
      <span className="text-sm text-zinc-700 dark:text-zinc-200">{label}</span>
      <div className="mt-1">{children}</div>
      {help && !error ? <span className="mt-1 text-xs text-zinc-500">{help}</span> : null}
      {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-zinc-500">{k}</div>
      <div className="font-medium text-zinc-900 dark:text-zinc-200 truncate max-w-[60%] text-right">{v}</div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-4 ring-blue-100 dark:ring-blue-900/40 focus:border-blue-600 transition";

const headerChipCls =
  "inline-flex items-center gap-1 rounded-md border border-zinc-300/70 dark:border-zinc-600/70 px-2 py-1 text-zinc-800 dark:text-zinc-200 bg-white/70 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition";

// Thai calendar date picker (B.E. display, stores ISO yyyy-mm-dd)
function ThaiDatePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  type ViewMode = "date" | "month" | "year";
  const [mode, setMode] = useState<ViewMode>("date");
  const monthsTH = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const daysShortTH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  const today = new Date();
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState<number>(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsed ? parsed.getMonth() : today.getMonth());

  function toISO(y: number, m: number, d: number) {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  function formatDisplay(val: string) {
    if (!val) return "";
    const d = new Date(val + "T00:00:00");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const be = d.getFullYear() + 543;
    return `${dd}/${mm}/${be}`;
  }

  function buildDays(year: number, month: number) {
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0-6 Sun-Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function prevMonth() {
    const m = viewMonth - 1;
    if (m < 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth(m);
  }
  function nextMonth() {
    const m = viewMonth + 1;
    if (m > 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth(m);
  }

  function handlePrev() {
    if (mode === "date") return prevMonth();
    if (mode === "month") return setViewYear((y) => y - 1);
    // year mode: page up by 12 years
    return setViewYear((y) => y - 12);
  }
  function handleNext() {
    if (mode === "date") return nextMonth();
    if (mode === "month") return setViewYear((y) => y + 1);
    // year mode: page down by 12 years
    return setViewYear((y) => y + 12);
  }

  // close on outside click
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const cells = buildDays(viewYear, viewMonth);
  const selected = parsed;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} text-left flex items-center justify-between`}
      >
        <span>{value ? formatDisplay(value) : "เลือกวันเกิด (พ.ศ.)"}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-70">
          <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute z-50 mt-2 w-[320px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
            <button type="button" onClick={handlePrev} className="px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">‹</button>
            <div className="flex items-center gap-2 text-sm font-medium">
              <button
                type="button"
                className={headerChipCls}
                onClick={() => setMode("month")}
                title="เลือกเดือน"
              >
                <span>{monthsTH[viewMonth]}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
                  <path fill="currentColor" d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              <button
                type="button"
                className={headerChipCls}
                onClick={() => setMode("year")}
                title="เลือกปี (พ.ศ.)"
              >
                <span>{viewYear + 543}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
                  <path fill="currentColor" d="M7 10l5 5 5-5z" />
                </svg>
              </button>
            </div>
            <button type="button" onClick={handleNext} className="px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">›</button>
          </div>

          {mode === "date" && (
            <div className="grid grid-cols-7 gap-1 p-3 text-center text-xs text-zinc-500">
              {daysShortTH.map((d) => (
                <div key={d} className="py-1 font-medium">
                  {d}
                </div>
              ))}
              {cells.map((d, idx) => {
                const isToday = d
                  ? today.getFullYear() === viewYear &&
                    today.getMonth() === viewMonth &&
                    today.getDate() === d
                  : false;
                const isSelected = d && selected &&
                  selected.getFullYear() === viewYear &&
                  selected.getMonth() === viewMonth &&
                  selected.getDate() === d;
                if (d === null)
                  return <div key={idx} className="py-2" />;
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      const iso = toISO(viewYear, viewMonth, d);
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={
                      "py-2 rounded text-sm " +
                      (isSelected
                        ? "bg-blue-600 text-white"
                        : isToday
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "month" && (
            <div className="grid grid-cols-3 gap-2 p-3">
              {monthsTH.map((m, i) => {
                const isSel = i === viewMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setViewMonth(i);
                      setMode("date");
                      setOpen(true);
                    }}
                    className={
                      "py-2 px-2 rounded text-sm text-center " +
                      (isSel ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
                    }
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "year" && (() => {
            const start = Math.floor(viewYear / 12) * 12;
            const years = Array.from({ length: 12 }, (_, i) => start + i);
            return (
              <div className="grid grid-cols-3 gap-2 p-3">
                {years.map((y) => {
                  const isSel = y === viewYear;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setViewYear(y);
                        setMode("month");
                        setOpen(true);
                      }}
                      className={
                        "py-2 px-2 rounded text-sm text-center " +
                        (isSel ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
                      }
                    >
                      {y + 543}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          <div className="flex justify-between items-center px-3 pb-3">
            <button
              type="button"
              className="text-xs text-zinc-500 hover:underline"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
            >
              วันนี้
            </button>
            {value && (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => onChange("")}
              >
                ล้างวันที่
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

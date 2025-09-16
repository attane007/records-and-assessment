"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  lastname?: string;
  prefix?: string;
  id_card: string;
  student_id?: string;
  date_of_birth: string;
  purpose: string;
  document_type?: string;
  class?: string;
  room?: string;
  academic_year?: string;
  father_name?: string;
  mother_name?: string;
};

export default function Home() {
  const [form, setForm] = useState<FormState>({
    name: "",
    lastname: "",
    prefix: "",
    id_card: "",
    student_id: "",
    date_of_birth: "",
    purpose: "",
  document_type: "",
    class: "",
    room: "",
    academic_year: "",
    father_name: "",
    mother_name: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    const nextVal = name === "id_card" ? value.replace(/\D/g, "") : value;
    setForm((s) => ({ ...s, [name]: nextVal }));
    setErrors((er) => ({ ...er, [name]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setErrors({});

  // basic client-side required check
  const required = ["name", "lastname", "id_card", "date_of_birth", "purpose", "prefix", "document_type"];
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
  setStatus("เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)");
  setStatusType('error');
      return;
    }

    setLoading(true);
    try {
  // combine prefix + name + lastname into the single `name` field expected by the backend
  // NOTE: per request, do NOT include a space between prefix and name when sending to backend
  const payload: any = { ...form };
  payload.name = `${form.prefix ? form.prefix : ""}${form.name}${form.lastname ? " " + form.lastname : ""}`.trim();
      // remove the temporary lastname property so payload shape matches previous API
      delete payload.lastname;

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        // backend returns { errors: { field: message } } for validation
        if (data && data.errors) {
          setErrors(data.errors);
          setStatus("กรุณาตรวจสอบข้อมูลที่กรอก");
          setStatusType('error');
        } else if (data && data.error) {
          setStatus(data.error);
          setStatusType('error');
        } else {
          setStatus("unexpected error");
          setStatusType('error');
        }
      } else {
        setStatus("บันทึกข้อมูลเรียบร้อย");
        setStatusType('success');
        setForm({
          name: "",
          id_card: "",
          date_of_birth: "",
          purpose: "",
          document_type: "",
          class: "",
          room: "",
          academic_year: "",
          father_name: "",
          mother_name: "",
        });
  setSubmitted(true);
      }
    } catch (err) {
      setStatus("network error: " + (err as Error).message);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  // auto-dismiss status toast after a short delay
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => {
      setStatus(null);
      setStatusType(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                <Image src="/logo-ppk-512x512-1.ico" alt="PPK logo" width={24} height={24} />
              </div>
              <div className="hidden sm:block">
                <div className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  ระบบ ปพ.1/ปพ.7
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1">คำร้องขอเอกสารนักเรียน</div>
              </div>
            </div>

            {/* Right: Action Button */}
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                title="เข้าสู่ระบบผู้ดูแล"
              >
                <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden md:inline">ผู้ดูแลระบบ</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              ระบบคำร้องขอเอกสาร ปพ.1/ปพ.7
            </h1>
            <p className="text-md text-slate-600 dark:text-slate-400">
              กรอกข้อมูลเพื่อขอเอกสารประวัตินักเรียน ปพ.1 หรือ ปพ.7
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
            {!submitted ? (
              <Card>
                <CardHeader
                  title="ส่งข้อมูลนักเรียน"
                  description="กรอกข้อมูลแล้วกดบันทึก ระบบจะส่งไปยัง backend และบันทึกในฐานข้อมูล"
                  iconSrc="/file.svg"
                />
                <CardContent>
                  <form className="w-full grid gap-5" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1">
                      <Field label="ประเภทเอกสาร *">
                        <select name="document_type" value={form.document_type} onChange={handleChange} className={inputCls}>
                          <option value="">เลือกประเภท</option>
                          <option value="ปพ.1">ปพ.1</option>
                          <option value="ปพ.7">ปพ.7</option>
                        </select>
                      </Field>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Field label="คำนำหน้า *" error={errors.prefix}>
                        <select name="prefix" value={form.prefix} onChange={handleChange} className={inputCls}>
                          <option value="">เลือก</option>
                          <option value="นาย">นาย</option>
                          <option value="นาง">นาง</option>
                          <option value="นางสาว">นางสาว</option>
                          <option value="ด.ช.">ด.ช.</option>
                          <option value="ด.ญ.">ด.ญ.</option>
                        </select>
                      </Field>

                      <Field label="ชื่อ *" error={errors.name}>
                        <input
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="เช่น กานต์ชัย"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="นามสกุล *" error={errors.lastname}>
                        <input
                          name="lastname"
                          value={form.lastname}
                          onChange={handleChange}
                          placeholder="เช่น ใจดี"
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

                      <Field label="รหัสนักเรียน" help="ไม่บังคับกรอก">
                        <input
                          name="student_id"
                          value={form.student_id}
                          onChange={handleChange}
                          placeholder="เช่น 01234"
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
                          placeholder="เช่น สมัครงาน"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Field label="ชั้นเรียน">
                        <select name="class" value={form.class} onChange={handleChange} className={inputCls}>
                          <option value="">เลือกชั้น</option>
                          <option value="ม.1">ม.1</option>
                          <option value="ม.2">ม.2</option>
                          <option value="ม.3">ม.3</option>
                          <option value="ม.4">ม.4</option>
                          <option value="ม.5">ม.5</option>
                          <option value="ม.6">ม.6</option>
                        </select>
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
                      <div
                        className={`rounded-lg px-4 py-3 text-sm ${statusClasses(status)}`}
                      >
                        {status}
                      </div>
                    )}

                    <div className="flex gap-3 items-center">
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 text-white px-4 py-2 text-sm font-medium shadow-md hover:from-cyan-700 hover:to-indigo-700 focus:ring-2 ring-cyan-300 disabled:opacity-60 cursor-pointer"
                      >
                        {loading ? "กำลังบันทึก..." : statusType === 'success' ? 'เรียบร้อย' : 'บันทึกข้อมูล'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            name: "",
                            lastname: "",
                            prefix: "",
                            id_card: "",
                            student_id: "",
                            date_of_birth: "",
                            purpose: "",
                            document_type: "",
                            class: "",
                            room: "",
                            academic_year: "",
                            father_name: "",
                            mother_name: "",
                          });
                          setErrors({});
                          setStatus(null);
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200 px-3 py-2 text-sm hover:bg-slate-100/80 dark:hover:bg-slate-800/60 cursor-pointer"
                      >
                        ล้างฟอร์ม
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader title="ส่งข้อมูลเรียบร้อย" description="ระบบได้รับคำร้องของคุณแล้ว" iconSrc="/file.svg" />
                <CardContent>
                  <div className="py-6 text-center">
                    <div className="text-lg font-semibold text-emerald-700">ขอบคุณ — ข้อมูลถูกส่งเรียบร้อยแล้ว</div>
                    <div className="mt-3 text-sm text-slate-600">ระบบจะทำการประมวลผลและแจ้งผลตามขั้นตอนต่อไป</div>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(false);
                          setStatus(null);
                          setStatusType(null);
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      >
                        กรอกข้อมูลอีกครั้ง
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="sticky top-24">
              <CardHeader title="ตัวอย่างข้อมูล (Preview)" description="แสดงผลข้อมูลที่กรอกแบบย่อ" iconSrc="/window.svg" />
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <KV k="ประเภทเอกสาร" v={form.document_type || "-"} />
                  <KV k="ชื่อ - สกุล" v={(form.prefix || form.name || form.lastname) ? `${form.prefix ? form.prefix + ' ' : ''}${form.name}${form.lastname ? ' ' + form.lastname : ''}` : "-"} />    
                  <KV k="เลขบัตรประชาชน" v={form.id_card || "-"} />
                  <KV k="รหัสนักเรียน" v={form.student_id || "-"} />
                  <KV k="วันเกิด" v={form.date_of_birth || "-"} />
                  <KV k="วัตถุประสงค์" v={form.purpose || "-"} />
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  <KV k="ชั้น/ห้อง" v={`${form.class || "-"}/${form.room || "-"}`} />
                  <KV k="ปีการศึกษา" v={form.academic_year || "-"} />
                  <KV k="บิดา" v={form.father_name || "-"} />
                  <KV k="มารดา" v={form.mother_name || "-"} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Toast container */}
      {status && (
        <div className={`fixed top-20 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${statusType === 'success' ? 'bg-emerald-100 border border-emerald-300 text-emerald-800' : 'bg-red-100 border border-red-300 text-red-800'}`}>
          {status}
        </div>
      )}

      <footer className="border-t border-slate-200/50 dark:border-slate-700/50 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-6 text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Records & Assessment System
        </div>
      </footer>
    </div>
  );
}

// UI primitives
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`group relative rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg transition-all duration-300 ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ title, description, iconSrc }: { title: string; description?: string; iconSrc?: string }) {
  return (
  <div className="border-b border-slate-200/50 dark:border-slate-700/50 p-6 bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-slate-900 dark:to-slate-900/40">
      <div className="flex items-center gap-3">
        {iconSrc ? (
          <div className="w-8 h-8 flex items-center justify-center">
            <Image aria-hidden src={iconSrc} alt="" width={20} height={20} className="filter brightness-0 invert" />
          </div>
        ) : null}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {description ? <p className="mt-1 text-sm text-white/90">{description}</p> : null}
    </div>
  );
}

function CardContent({ children }: { children: ReactNode }) {
  return <div className="p-6">{children}</div>;
}

function Field({ label, children, help, error }: { label: string; children: ReactNode; help?: string; error?: string }) {
  return (
    <label className="flex flex-col">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <div className="mt-1">{children}</div>
      {help && !error ? <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{help}</span> : null}
      {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-slate-500 dark:text-slate-400">{k}</div>
      <div className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[60%] text-right">{v}</div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-300 dark:ring-blue-800/50 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200";

const headerChipCls =
  "inline-flex items-center gap-1 rounded-md border border-slate-300/70 dark:border-slate-600/70 px-2 py-1 text-slate-700 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/30 hover:bg-slate-200/80 dark:hover:bg-slate-700/50 transition";

function statusClasses(msg: string) {
  const lower = msg.toLowerCase();
  const isError = lower.includes("error") || lower.includes("ผิดพลาด") || lower.includes("unexpected");
  return isError
    ? "border border-red-300 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
    : "border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
}

// Thai calendar date picker (B.E. display, stores ISO yyyy-mm-dd)
function ThaiDatePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties | null>(null);
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

  // close on outside click
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Calculate dropdown position when opening
  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < 420 && spaceAbove > 420;
      setDropdownPosition(placeAbove ? 'top' : 'bottom');

      const width = Math.min(320, Math.max(280, rect.width));
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, 8),
        window.innerWidth - width - 8
      );
      if (placeAbove) {
        setPopupStyle({ position: 'fixed', left, bottom: Math.max(8, window.innerHeight - rect.top + 8), width, maxHeight: 420, overflowY: 'auto', zIndex: 9999 });
      } else {
        setPopupStyle({ position: 'fixed', left, top: Math.max(8, rect.bottom + 8), width, maxHeight: 420, overflowY: 'auto', zIndex: 9999 });
      }
    }
    setOpen((o) => !o);
  };

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
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  // Recompute popup position on resize/scroll while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < 420 && spaceAbove > 420;
      const width = Math.min(320, Math.max(280, rect.width));
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, 8),
        window.innerWidth - width - 8
      );
      if (placeAbove) {
        setDropdownPosition('top');
        setPopupStyle({ position: 'fixed', left, bottom: Math.max(8, window.innerHeight - rect.top + 8), width, maxHeight: 420, overflowY: 'auto', zIndex: 9999 });
      } else {
        setDropdownPosition('bottom');
        setPopupStyle({ position: 'fixed', left, top: Math.max(8, rect.bottom + 8), width, maxHeight: 420, overflowY: 'auto', zIndex: 9999 });
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const cells = buildDays(viewYear, viewMonth);
  const selected = parsed;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={handleToggle}
        className={`${inputCls} text-left flex items-center justify-between`}
      >
        <span>{value ? formatDisplay(value) : "เลือกวันเกิด (พ.ศ.)"}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-70">
          <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && popupStyle && typeof document !== 'undefined' && createPortal(
        <div
          className="w-[320px] max-h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-600">
            <button type="button" onClick={handlePrev} className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">‹</button>
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
            <button type="button" onClick={handleNext} className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">›</button>
          </div>

          {mode === "date" && (
            <div className="grid grid-cols-7 gap-1 p-3 text-center text-xs text-slate-500">
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
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700")
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
                      (isSel ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700")
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
                        (isSel ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700")
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
              className="text-xs text-slate-500 hover:underline"
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
        </div>,
        document.body
      )}
    </div>
  );
}

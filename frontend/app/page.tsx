"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

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
                <Field label="วันเกิด (YYYY-MM-DD) *" error={errors.date_of_birth}>
                  <input
                    name="date_of_birth"
                    value={form.date_of_birth}
                    onChange={handleChange}
                    placeholder="2008-05-21"
                    className={inputCls}
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

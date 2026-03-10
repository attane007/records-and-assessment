"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ApiErrorResponse, SubmitRequestBody, ValidationErrorResponse } from "@/lib/types/api";

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

function formatThaiDateDisplay(value: string) {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

type FormState = {
  name: string;
  lastname: string;
  prefix: string;
  id_card: string;
  student_id: string;
  date_of_birth: string;
  purpose: string;
  document_type: string;
  class: string;
  room: string;
  academic_year: string;
  father_name: string;
  mother_name: string;
};

type FormField = keyof FormState;
type FormErrors = Partial<Record<FormField, string>>;

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type HelpTone = "muted" | "warning" | "success";

const EMPTY_FORM: FormState = {
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
};

const REQUIRED_FIELDS = [
  "name",
  "lastname",
  "id_card",
  "date_of_birth",
  "purpose",
  "prefix",
  "document_type",
] as const satisfies ReadonlyArray<FormField>;

const FORM_FIELD_SET = new Set<FormField>(Object.keys(EMPTY_FORM) as FormField[]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFormField(value: string): value is FormField {
  return FORM_FIELD_SET.has(value as FormField);
}

function toFormErrors(rawErrors: Partial<Record<string, string>>): FormErrors {
  const next: FormErrors = {};
  for (const [key, value] of Object.entries(rawErrors)) {
    if (isFormField(key) && typeof value === "string" && value.trim() !== "") {
      next[key] = value;
    }
  }
  return next;
}

function isValidationErrorResponse(data: unknown): data is ValidationErrorResponse {
  return isRecord(data) && "errors" in data && isRecord(data.errors);
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return isRecord(data) && typeof data.error === "string";
}

function getThaiIdHint(idCard: string): { text: string; tone: HelpTone } {
  if (!idCard) {
    return { text: "ต้องเป็นตัวเลข 13 หลัก", tone: "muted" };
  }

  if (idCard.length < 13) {
    return { text: `${idCard.length}/13 หลัก`, tone: "muted" };
  }

  if (!isValidThaiID(idCard)) {
    return { text: "ครบ 13 หลักแล้ว แต่ checksum ยังไม่ถูกต้อง", tone: "warning" };
  }

  return { text: "เลขบัตรประชาชนถูกต้อง", tone: "success" };
}

export default function Home() {
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY_FORM }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<SubmitStatus>({ kind: "idle" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);

  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => form[field].trim() === "");
  const missingRequiredSet = new Set<FormField>(missingRequiredFields);
  const requiredCompletion = REQUIRED_FIELDS.length - missingRequiredFields.length;
  const requiredProgress = Math.round((requiredCompletion / REQUIRED_FIELDS.length) * 100);
  const thaiIdHint = getThaiIdHint(form.id_card);

  function clearFieldError(field: FormField) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setStatus({ kind: "idle" });
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    if (!isFormField(name)) return;

    const nextVal = name === "id_card" ? value.replace(/\D/g, "") : value;
    setForm((s) => ({ ...s, [name]: nextVal }));
    clearFieldError(name);

    if (status.kind === "error") {
      setStatus({ kind: "idle" });
    }
  }

  function handleDateChange(nextValue: string) {
    setForm((s) => ({ ...s, date_of_birth: nextValue }));
    clearFieldError("date_of_birth");

    if (status.kind === "error") {
      setStatus({ kind: "idle" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });
    setErrors({});

    const missing: FormErrors = {};
    for (const key of REQUIRED_FIELDS) {
      if (form[key].trim() === "") {
        missing[key] = "field is required";
      }
    }

    if (Object.keys(missing).length) {
      setErrors(missing);
      setStatus({ kind: "error", message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" });
      return;
    }

    if (!isValidThaiID(form.id_card)) {
      setErrors((prev) => ({ ...prev, id_card: "เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก พร้อม checksum)" }));
      setStatus({ kind: "error", message: "เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)" });
      return;
    }

    setLoading(true);
    try {
      // Keep prefix as its own field and send name without the prefix to avoid duplication.
      const payload: SubmitRequestBody = {
        name: `${form.name}${form.lastname ? ` ${form.lastname}` : ""}`.trim(),
        prefix: form.prefix,
        id_card: form.id_card,
        date_of_birth: form.date_of_birth,
        purpose: form.purpose,
        document_type: form.document_type,
      };

      if (form.student_id.trim() !== "") payload.student_id = form.student_id.trim();
      if (form.class.trim() !== "") payload.class = form.class.trim();
      if (form.room.trim() !== "") payload.room = form.room.trim();
      if (form.academic_year.trim() !== "") payload.academic_year = form.academic_year.trim();
      if (form.father_name.trim() !== "") payload.father_name = form.father_name.trim();
      if (form.mother_name.trim() !== "") payload.mother_name = form.mother_name.trim();

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        if (isValidationErrorResponse(data)) {
          setErrors(toFormErrors(data.errors));
          setStatus({ kind: "error", message: "กรุณาตรวจสอบข้อมูลที่กรอก" });
        } else if (isApiErrorResponse(data)) {
          setStatus({ kind: "error", message: data.error });
        } else {
          setStatus({ kind: "error", message: "unexpected error" });
        }
      } else {
        setStatus({ kind: "success", message: "บันทึกข้อมูลเรียบร้อย" });
        setSubmitted(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      setStatus({ kind: "error", message: `network error: ${message}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                <Image src="/logo-ppk-512x512-1.ico" alt="PPK logo" width={24} height={24} />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  ระบบ ปพ.1/ปพ.7
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">คำร้องขอเอกสารนักเรียน</div>
              </div>
            </div>

            <Link
              href="/admin"
              className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all duration-200 shadow-md hover:shadow-lg"
              title="เข้าสู่ระบบผู้ดูแล"
            >
              <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden md:inline">ผู้ดูแลระบบ</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
          <section className="relative overflow-hidden rounded-2xl border border-cyan-100/90 dark:border-cyan-900/40 bg-gradient-to-r from-white via-cyan-50/60 to-blue-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 py-5 sm:px-6 sm:py-6 shadow-[0_14px_32px_-22px_rgba(14,116,144,0.65)]">
            <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-500/10" />
            <div className="pointer-events-none absolute -left-12 -bottom-20 h-36 w-36 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/10" />

            <div className="relative">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
                ระบบคำร้องขอเอกสาร ปพ.1/ปพ.7
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                กรอกข้อมูลให้ครบถ้วน ระบบจะส่งคำร้องไปยัง backend และบันทึกลงฐานข้อมูลอัตโนมัติ
              </p>

              <div className="mt-4 max-w-md rounded-xl border border-cyan-200/70 bg-white/85 dark:border-cyan-900/40 dark:bg-slate-900/70 px-3 py-2.5">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>ความพร้อมการกรอกข้อมูล</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{requiredProgress}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all"
                    style={{ width: `${requiredProgress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  ช่องที่ต้องกรอกครบแล้ว {requiredCompletion}/{REQUIRED_FIELDS.length}
                </span>
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200">
                  Preview อัปเดตแบบเรียลไทม์
                </span>
              </div>
            </div>
          </section>

          <Panel className="lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobilePreviewOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">ตัวอย่างข้อมูล (Preview)</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  ช่องจำเป็นครบ {requiredCompletion}/{REQUIRED_FIELDS.length}
                </div>
              </div>
              <svg
                className={`h-5 w-5 text-slate-500 transition-transform ${isMobilePreviewOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isMobilePreviewOpen ? (
              <PanelContent className="pt-0">
                <PreviewSummary
                  form={form}
                  missingRequiredSet={missingRequiredSet}
                  requiredCompletion={requiredCompletion}
                  requiredProgress={requiredProgress}
                />
              </PanelContent>
            ) : null}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_360px] xl:grid-cols-[minmax(0,1.5fr)_380px] items-start">
            {!submitted ? (
              <Panel>
                <PanelHeader
                  title="แบบฟอร์มคำร้องเอกสาร"
                  description="กรอกข้อมูลด้านล่างให้ครบถ้วน ช่องที่มีป้ายจำเป็นต้องกรอกก่อนบันทึก"
                  iconSrc="/file.svg"
                />
                <PanelContent>
                  <form className="space-y-6 sm:space-y-7" onSubmit={handleSubmit}>
                    <FormSection title="1) ข้อมูลเอกสาร" description="เลือกประเภทเอกสารและระบุวัตถุประสงค์การใช้งาน">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="ประเภทเอกสาร" required error={errors.document_type}>
                          <select name="document_type" value={form.document_type} onChange={handleChange} className={inputCls}>
                            <option value="">เลือกประเภท</option>
                            <option value="ปพ.1">ปพ.1</option>
                            <option value="ปพ.7">ปพ.7</option>
                          </select>
                        </Field>

                        <Field label="วัตถุประสงค์" required error={errors.purpose}>
                          <input
                            name="purpose"
                            value={form.purpose}
                            onChange={handleChange}
                            placeholder="เช่น สมัครงาน"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </FormSection>

                    <FormSection title="2) ข้อมูลส่วนตัว" description="กรอกข้อมูลตามบัตรประชาชนเพื่อความถูกต้องของเอกสาร">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Field label="คำนำหน้า" required error={errors.prefix}>
                          <select name="prefix" value={form.prefix} onChange={handleChange} className={inputCls}>
                            <option value="">เลือก</option>
                            <option value="นาย">นาย</option>
                            <option value="นาง">นาง</option>
                            <option value="นางสาว">นางสาว</option>
                            <option value="ด.ช.">ด.ช.</option>
                            <option value="ด.ญ.">ด.ญ.</option>
                          </select>
                        </Field>

                        <Field label="ชื่อ" required error={errors.name}>
                          <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="เช่น กานต์ชัย"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="นามสกุล" required error={errors.lastname}>
                          <input
                            name="lastname"
                            value={form.lastname}
                            onChange={handleChange}
                            placeholder="เช่น ใจดี"
                            className={inputCls}
                          />
                        </Field>

                        <Field
                          label="เลขบัตรประชาชน"
                          required
                          help={thaiIdHint.text}
                          helpTone={errors.id_card ? "muted" : thaiIdHint.tone}
                          error={errors.id_card}
                        >
                          <input
                            name="id_card"
                            value={form.id_card}
                            onChange={handleChange}
                            maxLength={13}
                            placeholder="1234567890123"
                            inputMode="numeric"
                            className={inputCls}
                          />
                        </Field>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="วันเกิด (ปฏิทินไทย)" required error={errors.date_of_birth}>
                          <ThaiDatePicker value={form.date_of_birth} onChange={handleDateChange} />
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
                    </FormSection>

                    <FormSection title="3) ข้อมูลการศึกษา" description="ระบุข้อมูลชั้นเรียนและปีการศึกษา (ถ้ามี)">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="ชั้นเรียน" help="ไม่บังคับกรอก">
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

                        <Field label="ห้อง" help="ไม่บังคับกรอก">
                          <input
                            name="room"
                            value={form.room}
                            onChange={handleChange}
                            placeholder="เช่น 2"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="ปีการศึกษา" help="ไม่บังคับกรอก">
                          <input
                            name="academic_year"
                            value={form.academic_year}
                            onChange={handleChange}
                            placeholder="เช่น 2568"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </FormSection>

                    <FormSection title="4) ข้อมูลผู้ปกครอง" description="ข้อมูลส่วนนี้ไม่บังคับ แต่ช่วยให้เจ้าหน้าที่ตรวจสอบได้เร็วขึ้น">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="ชื่อบิดา" help="ไม่บังคับกรอก">
                          <input
                            name="father_name"
                            value={form.father_name}
                            onChange={handleChange}
                            placeholder="เช่น สมชาย ใจดี"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="ชื่อมารดา" help="ไม่บังคับกรอก">
                          <input
                            name="mother_name"
                            value={form.mother_name}
                            onChange={handleChange}
                            placeholder="เช่น สมหญิง ใจดี"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </FormSection>

                    {status.kind === "error" ? (
                      <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                        {status.message}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/80 dark:border-slate-700/80 pt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-5 py-2.5 text-sm font-medium shadow-md hover:from-blue-700 hover:to-cyan-700 focus:ring-2 ring-cyan-300 disabled:opacity-60 cursor-pointer"
                      >
                        {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                      </button>

                      <button
                        type="button"
                        onClick={resetForm}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200 px-4 py-2.5 text-sm hover:bg-slate-100/80 dark:hover:bg-slate-800/60 cursor-pointer"
                      >
                        ล้างฟอร์ม
                      </button>
                    </div>
                  </form>
                </PanelContent>
              </Panel>
            ) : (
              <Panel>
                <PanelHeader title="ส่งข้อมูลเรียบร้อย" description="ระบบได้รับคำร้องของคุณแล้ว" iconSrc="/file.svg" />
                <PanelContent>
                  <div className="py-8 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="mt-4 text-lg font-semibold text-emerald-700 dark:text-emerald-300">ส่งคำร้องสำเร็จ</div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {status.kind === "success" ? status.message : "ระบบจะดำเนินการตามขั้นตอนต่อไป"}
                    </div>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(false);
                          resetForm();
                        }}
                        className="inline-flex items-center justify-center rounded-xl border border-blue-500 px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      >
                        กรอกข้อมูลใหม่
                      </button>
                    </div>
                  </div>
                </PanelContent>
              </Panel>
            )}

            <Panel className="hidden lg:block self-start lg:sticky lg:top-24">
              <PanelHeader title="ตัวอย่างข้อมูล (Preview)" description="สรุปข้อมูลที่กรอกและสถานะช่องจำเป็น" iconSrc="/window.svg" />
              <PanelContent>
                <PreviewSummary
                  form={form}
                  missingRequiredSet={missingRequiredSet}
                  requiredCompletion={requiredCompletion}
                  requiredProgress={requiredProgress}
                />
              </PanelContent>
            </Panel>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200/50 dark:border-slate-700/50 mt-2">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Records & Assessment System
        </div>
      </footer>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({ title, description, iconSrc }: { title: string; description?: string; iconSrc?: string }) {
  return (
    <div className="border-b border-cyan-200/70 dark:border-cyan-900/40 px-4 py-3 sm:px-5 sm:py-4 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-900/80 dark:via-blue-900/70 dark:to-indigo-900/70">
      <div className="flex items-center gap-3">
        {iconSrc ? (
          <div className="w-8 h-8 flex items-center justify-center">
            <Image aria-hidden src={iconSrc} alt="" width={20} height={20} className="filter brightness-0 invert" />
          </div>
        ) : null}
        <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
      </div>
      {description ? <p className="mt-1 text-sm text-white/90">{description}</p> : null}
    </div>
  );
}

function PanelContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-900/40 p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description ? <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function helpToneClassName(tone: HelpTone) {
  if (tone === "warning") return "text-amber-700 dark:text-amber-300";
  if (tone === "success") return "text-emerald-700 dark:text-emerald-300";
  return "text-slate-500 dark:text-slate-400";
}

function Field({
  label,
  required = false,
  children,
  help,
  helpTone = "muted",
  error,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  help?: string | undefined;
  helpTone?: HelpTone;
  error?: string | undefined;
}) {
  return (
    <label className="flex flex-col">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span>{label}</span>
        {required ? (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
            จำเป็น
          </span>
        ) : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {help && !error ? <span className={`mt-1.5 text-xs ${helpToneClassName(helpTone)}`}>{help}</span> : null}
      {error ? <span className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-300">{error}</span> : null}
    </label>
  );
}

function PreviewSummary({
  form,
  missingRequiredSet,
  requiredCompletion,
  requiredProgress,
}: {
  form: FormState;
  missingRequiredSet: Set<FormField>;
  requiredCompletion: number;
  requiredProgress: number;
}) {
  const fullName = [form.prefix, form.name, form.lastname].filter((part) => part.trim() !== "").join(" ");
  const fullNameMissing =
    missingRequiredSet.has("prefix") || missingRequiredSet.has("name") || missingRequiredSet.has("lastname");

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 p-3">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>ความครบถ้วนช่องจำเป็น</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {requiredCompletion}/{REQUIRED_FIELDS.length}
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all"
            style={{ width: `${requiredProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <PreviewSectionTitle title="ข้อมูลเอกสาร" />
        <PreviewKV
          label="ประเภทเอกสาร"
          value={form.document_type}
          required
          missing={missingRequiredSet.has("document_type")}
        />
        <PreviewKV label="วัตถุประสงค์" value={form.purpose} required missing={missingRequiredSet.has("purpose")} />
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      <div className="space-y-2">
        <PreviewSectionTitle title="ข้อมูลส่วนตัว" />
        <PreviewKV label="ชื่อ - สกุล" value={fullName} required missing={fullNameMissing} />
        <PreviewKV
          label="เลขบัตรประชาชน"
          value={form.id_card}
          required
          missing={missingRequiredSet.has("id_card")}
        />
        <PreviewKV
          label="วันเกิด"
          value={formatThaiDateDisplay(form.date_of_birth)}
          required
          missing={missingRequiredSet.has("date_of_birth")}
        />
        <PreviewKV label="รหัสนักเรียน" value={form.student_id} />
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      <div className="space-y-2">
        <PreviewSectionTitle title="ข้อมูลการศึกษา" />
        <PreviewKV label="ชั้น/ห้อง" value={form.class || form.room ? `${form.class || "-"}/${form.room || "-"}` : ""} />
        <PreviewKV label="ปีการศึกษา" value={form.academic_year} />
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      <div className="space-y-2">
        <PreviewSectionTitle title="ข้อมูลผู้ปกครอง" />
        <PreviewKV label="บิดา" value={form.father_name} />
        <PreviewKV label="มารดา" value={form.mother_name} />
      </div>
    </div>
  );
}

function PreviewSectionTitle({ title }: { title: string }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</div>;
}

function PreviewKV({
  label,
  value,
  required = false,
  missing = false,
}: {
  label: string;
  value: string;
  required?: boolean;
  missing?: boolean;
}) {
  const normalizedValue = value.trim();

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-slate-600 dark:text-slate-300">
        {label}
        {required ? (
          <span className="ml-2 inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
            จำเป็น
          </span>
        ) : null}
      </div>
      <div
        className={`max-w-[60%] text-right font-medium break-words ${
          missing
            ? "text-rose-700 dark:text-rose-300"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {missing ? "ยังไม่กรอก" : normalizedValue || "-"}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-blue-300 dark:ring-blue-800/50 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200";

const headerChipCls =
  "inline-flex items-center gap-1 rounded-md border border-slate-300/70 dark:border-slate-600/70 px-2 py-1 text-slate-700 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/30 hover:bg-slate-200/80 dark:hover:bg-slate-700/50 transition";

// Thai calendar date picker (B.E. display, stores ISO yyyy-mm-dd)
function ThaiDatePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [, setDropdownPosition] = useState<"bottom" | "top">("bottom");
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

  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < 420 && spaceAbove > 420;
      setDropdownPosition(placeAbove ? "top" : "bottom");

      const width = Math.min(320, Math.max(280, rect.width));
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 8), window.innerWidth - width - 8);
      if (placeAbove) {
        setPopupStyle({
          position: "fixed",
          left,
          bottom: Math.max(8, window.innerHeight - rect.top + 8),
          width,
          maxHeight: 420,
          overflowY: "auto",
          zIndex: 9999,
        });
      } else {
        setPopupStyle({
          position: "fixed",
          left,
          top: Math.max(8, rect.bottom + 8),
          width,
          maxHeight: 420,
          overflowY: "auto",
          zIndex: 9999,
        });
      }
    }
    setOpen((o) => !o);
  };

  function toISO(y: number, m: number, d: number) {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  function buildDays(year: number, month: number) {
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function prevMonth() {
    const m = viewMonth - 1;
    if (m < 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth(m);
    }
  }

  function nextMonth() {
    const m = viewMonth + 1;
    if (m > 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth(m);
    }
  }

  function handlePrev() {
    if (mode === "date") return prevMonth();
    if (mode === "month") return setViewYear((y) => y - 1);
    return setViewYear((y) => y - 12);
  }

  function handleNext() {
    if (mode === "date") return nextMonth();
    if (mode === "month") return setViewYear((y) => y + 1);
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
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 8), window.innerWidth - width - 8);

      if (placeAbove) {
        setDropdownPosition("top");
        setPopupStyle({
          position: "fixed",
          left,
          bottom: Math.max(8, window.innerHeight - rect.top + 8),
          width,
          maxHeight: 420,
          overflowY: "auto",
          zIndex: 9999,
        });
      } else {
        setDropdownPosition("bottom");
        setPopupStyle({
          position: "fixed",
          left,
          top: Math.max(8, rect.bottom + 8),
          width,
          maxHeight: 420,
          overflowY: "auto",
          zIndex: 9999,
        });
      }
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
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
        <span>{value ? formatThaiDateDisplay(value) : "เลือกวันเกิด (พ.ศ.)"}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" className="opacity-70">
          <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {open && popupStyle && typeof document !== "undefined" &&
        createPortal(
          <div
            className="w-[320px] max-h-[420px] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl"
            style={popupStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={handlePrev}
                className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                ‹
              </button>
              <div className="flex items-center gap-2 text-sm font-medium">
                <button type="button" className={headerChipCls} onClick={() => setMode("month")} title="เลือกเดือน">
                  <span>{monthsTH[viewMonth]}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
                    <path fill="currentColor" d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                <button type="button" className={headerChipCls} onClick={() => setMode("year")} title="เลือกปี (พ.ศ.)">
                  <span>{viewYear + 543}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
                    <path fill="currentColor" d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                ›
              </button>
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
                    ? today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
                    : false;
                  const isSelected =
                    d &&
                    selected &&
                    selected.getFullYear() === viewYear &&
                    selected.getMonth() === viewMonth &&
                    selected.getDate() === d;

                  if (d === null) return <div key={idx} className="py-2" />;

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

            {mode === "year" &&
              (() => {
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
              {value ? (
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => onChange("")}>
                  ล้างวันที่
                </button>
              ) : null}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

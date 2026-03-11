"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SettingsFormProps {
  initialData: {
    registrar_name: string;
    director_name: string;
    registrar_email: string;
    director_email: string;
  };
}

interface FormData {
  registrar_name: string;
  director_name: string;
  registrar_email: string;
  director_email: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const inputClass =
  "w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all shadow-sm";

const labelClass = "block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase";

export default function SettingsForm({ initialData }: SettingsFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialData);

  useEffect(() => {
    const shouldFetch = !initialData || (!initialData.registrar_name && !initialData.director_name);
    if (!shouldFetch) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/backend/officials", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (mounted && data) {
            setFormData({
              registrar_name: data.registrar_name || "",
              director_name: data.director_name || "",
              registrar_email: data.registrar_email || "",
              director_email: data.director_email || "",
            });
          }
        }
      } catch (e) {
        console.error("Failed to load officials on client:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initialData]);

  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/backend/officials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setMessage({ type: "success", text: "บันทึกข้อมูลเรียบร้อยแล้ว" });
        router.refresh();
      } else {
        const errorData = await response.json();
        setMessage({ type: "error", text: errorData.error || "เกิดข้อผิดพลาด" });
      }
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาดการเชื่อมต่อ" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPasswordLoading(true);
    setPasswordMessage(null);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: "error", text: "รหัสผ่านไม่ตรงกัน" });
      setIsPasswordLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        setPasswordMessage({ type: "success", text: "สำเร็จ" });
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setShowPasswordForm(false);
      } else {
        setPasswordMessage({ type: "error", text: data.error || "ไม่สำเร็จ" });
      }
    } catch {
      setPasswordMessage({ type: "error", text: "เกิดข้อผิดพลาด" });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(initialData);
    setMessage(null);
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);
  const hasPasswordChanges =
    passwordData.currentPassword !== "" || passwordData.newPassword !== "" || passwordData.confirmPassword !== "";

  const AlertMessage = ({ msg }: { msg: { type: "success" | "error"; text: string } }) => (
    <div
      className={`p-3 rounded-lg flex items-center gap-2 text-xs border ${msg.type === "success"
        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 text-emerald-700"
        : "bg-red-50 dark:bg-red-900/10 border-red-100 text-red-700"
        }`}
    >
      <span className="font-bold">{msg.text}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
      {/* ─── Officials Info ─── */}
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ข้อมูลเจ้าหน้าที่</h2>
            <p className="text-xs text-slate-500">สำหรับปรากฏในเอกสาร PDF</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className={labelClass}>ชื่อนายทะเบียน</label>
                <input type="text" name="registrar_name" value={formData.registrar_name} onChange={handleInputChange} className={inputClass} required />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>ชื่อผู้อำนวยการ</label>
                <input type="text" name="director_name" value={formData.director_name} onChange={handleInputChange} className={inputClass} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className={labelClass}>อีเมลนายทะเบียน</label>
                <input type="email" name="registrar_email" value={formData.registrar_email} onChange={handleInputChange} className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>อีเมลผู้อำนวยการ</label>
                <input type="email" name="director_email" value={formData.director_email} onChange={handleInputChange} className={inputClass} />
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 text-xs text-slate-500 font-medium">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>ใช้สำหรับหัวกระดาษและลายเซ็นของเอกสารทางการ</span>
            </div>
            {message && <AlertMessage msg={message} />}
          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-50 dark:border-slate-800">
            <button
              type="submit"
              disabled={isLoading || !hasChanges}
              className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 text-sm shadow-md"
            >
              {isLoading ? "..." : "บันทึกข้อมูล"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading || !hasChanges}
              className="px-6 py-3 text-xs text-slate-400 font-bold hover:text-slate-600"
            >
              รีเซ็ต
            </button>
          </div>
        </form>
      </div>

      {/* ─── Change Password ─── */}
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10">
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ความปลอดภัย</h2>
            <p className="text-xs text-slate-500">รหัสผ่านสำหรับเข้าสู่ระบบ</p>
          </div>
        </div>

        <div className="flex-1 p-8 flex flex-col">
          {!showPasswordForm ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-6">
              <div className="w-16 h-16 rounded-[1.5rem] bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold">เปลี่ยนรหัสผ่าน</h3>
                <p className="text-sm text-slate-400">แนะนำให้เปลี่ยนสม่ำเสมอ</p>
              </div>
              {passwordMessage && <div className="w-full text-center"><AlertMessage msg={passwordMessage} /></div>}
              <button
                onClick={() => setShowPasswordForm(true)}
                className="px-8 py-3.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors text-sm shadow-md"
              >
                เริ่มแก้ไขรหัสผ่าน
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className={labelClass}>รหัสผ่านเดิม</label>
                  <input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordInputChange} className={inputClass} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className={labelClass}>รหัสใหม่</label>
                    <input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordInputChange} className={inputClass} required minLength={6} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>ยืนยันรหัส</label>
                    <input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordInputChange} className={inputClass} required />
                  </div>
                </div>
                {passwordMessage && <AlertMessage msg={passwordMessage} />}
              </div>
              <div className="flex gap-4 pt-8 border-t border-slate-50 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isPasswordLoading || !hasPasswordChanges}
                  className="flex-1 py-3.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors text-sm"
                >
                  อัปเดตทันที
                </button>
                <button type="button" onClick={() => setShowPasswordForm(false)} className="px-6 py-3.5 text-xs text-red-600 font-bold hover:bg-red-50 rounded-xl">
                  ยกเลิก
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

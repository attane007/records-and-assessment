"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsFormProps {
  initialData: {
    registrar_name: string;
    director_name: string;
  };
}

interface FormData {
  registrar_name: string;
  director_name: string;
}

export default function SettingsForm({ initialData }: SettingsFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendURL}/api/officials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'บันทึกข้อมูลเจ้าหน้าที่เรียบร้อยแล้ว' });
        // Refresh the page to get updated data
        router.refresh();
      } else {
        const errorData = await response.json();
        setMessage({ 
          type: 'error', 
          text: errorData.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' 
        });
      }
    } catch (error) {
      console.error('Error saving officials:', error);
      setMessage({ 
        type: 'error', 
        text: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(initialData);
    setMessage(null);
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Registrar Name */}
      <div className="space-y-2">
        <label htmlFor="registrar_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          ชื่อนายทะเบียน
        </label>
        <input
          type="text"
          id="registrar_name"
          name="registrar_name"
          value={formData.registrar_name}
          onChange={handleInputChange}
          placeholder="กรุณากรอกชื่อนายทะเบียน"
          className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          required
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ชื่อนี้จะปรากฏในเอกสาร PDF ที่สร้างโดยระบบ
        </p>
      </div>

      {/* Director Name */}
      <div className="space-y-2">
        <label htmlFor="director_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          ชื่อผู้อำนวยการ
        </label>
        <input
          type="text"
          id="director_name"
          name="director_name"
          value={formData.director_name}
          onChange={handleInputChange}
          placeholder="กรุณากรอกชื่อผู้อำนวยการ"
          className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          required
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ชื่อนี้จะปรากฏในเอกสาร PDF ที่สร้างโดยระบบ
        </p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700' 
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
        }`}>
          {message.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`text-sm font-medium ${
            message.type === 'success' 
              ? 'text-emerald-800 dark:text-emerald-200' 
              : 'text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button
          type="submit"
          disabled={isLoading || !hasChanges}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-lg hover:from-violet-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังบันทึก...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              บันทึกการเปลี่ยนแปลง
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading || !hasChanges}
          className="sm:flex-initial px-6 py-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          รีเซ็ต
        </button>
      </div>

      {/* Help Text */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <p className="font-medium mb-1">หมายเหตุ:</p>
            <ul className="space-y-1 list-disc list-inside ml-2">
              <li>ข้อมูลที่บันทึกจะใช้สำหรับสร้างเอกสาร PDF</li>
              <li>กรุณาตรวจสอบความถูกต้องของชื่อก่อนบันทึก</li>
              <li>การเปลี่ยนแปลงจะมีผลทันทีหลังจากบันทึก</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  );
}

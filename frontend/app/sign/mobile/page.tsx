import { Suspense } from "react";
import MobileSignClient from "./MobileSignClient";

export default function MobileSignPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-xl px-4 py-10">
          <div className="text-center text-slate-500">กำลังโหลดหน้าลงนาม...</div>
        </main>
      }
    >
      <MobileSignClient />
    </Suspense>
  );
}

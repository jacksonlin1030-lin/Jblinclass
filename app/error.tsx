"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled client error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="text-lg font-semibold">畫面出了點問題</h1>
        <p className="text-sm text-slate-500">
          可能是網頁剛更新過、你的分頁還在跑舊版程式碼。試試重新整理，如果還是一樣再回報。
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium"
          >
            重試
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            重新整理頁面
          </button>
        </div>
      </div>
    </div>
  );
}

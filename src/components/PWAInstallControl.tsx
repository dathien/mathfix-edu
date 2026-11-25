import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallControlProps {
  externalTriggerCount?: number;
}

export const PWAInstallControl: React.FC<PWAInstallControlProps> = ({
  externalTriggerCount = 0,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    if (externalTriggerCount <= 0 || isInstalled) return;
    if (isInstallable) {
      install();
    } else {
      setShowManualGuide(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTriggerCount]);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowManualGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Cài đặt MathFix EDU để dùng ngoại tuyến như ứng dụng máy tính"
      >
        <Download className="h-4 w-4 text-[#0B4F8A]" aria-hidden="true" />
        <span>Cài ứng dụng</span>
      </button>

      {showManualGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="pwa-guide-title" className="text-lg font-semibold text-slate-900">
                Hướng dẫn cài đặt MathFix EDU ngoại tuyến
              </h2>
              <button
                type="button"
                onClick={() => setShowManualGuide(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                aria-label="Đóng hướng dẫn cài đặt"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[15px] text-slate-700">
              {isIOS ? (
                <div className="space-y-2">
                  <p className="font-medium text-slate-900">Trên iPhone / iPad (Safari):</p>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>Nhấn nút <strong>Chia sẻ (Share)</strong> ở thanh dưới trình duyệt Safari.</li>
                    <li>Cuộn xuống và chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</li>
                    <li>Nhấn <strong>Thêm</strong> để mở MathFix EDU độc lập không cần mạng.</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-slate-900">Trên Windows / macOS (Chrome, Edge, Cốc Cốc):</p>
                    <ol className="mt-1 list-decimal pl-5 space-y-1">
                      <li>Nhìn bên phải thanh địa chỉ trình duyệt, nhấn biểu tượng <strong>Cài đặt ứng dụng</strong> (hình màn hình có mũi tên xuống).</li>
                      <li>Hoặc mở menu trình duyệt (⋮) → <strong>Lưu và chia sẻ</strong> → <strong>Cài đặt MathFix EDU</strong>.</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Trên macOS (Safari):</p>
                    <p className="mt-1">Chọn menu <strong>Tệp (File)</strong> → <strong>Thêm vào Dock (Add to Dock)</strong>.</p>
                  </div>
                </div>
              )}
              <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
                Sau khi mở đầy đủ tài nguyên lần đầu, MathFix EDU tự động lưu bộ công cụ MathJax, MathLive và PDF vào bộ nhớ đệm để sử dụng hoàn toàn ngoại tuyến mà không gửi đề kiểm tra lên máy chủ.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowManualGuide(false)}
                className="rounded-lg bg-[#0B4F8A] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#093F6F] cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

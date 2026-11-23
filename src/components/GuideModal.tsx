import React from 'react';
import { X } from 'lucide-react';

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="guide-modal-title" className="text-lg font-semibold text-slate-900">
            Hướng dẫn sử dụng MathFix EDU
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Đóng hướng dẫn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mathfix-scroll flex-1 overflow-y-auto px-6 py-5 space-y-5 text-[15px] text-slate-700">
          <section>
            <h3 className="text-base font-semibold text-slate-900">1. Quy trình 3 bước cho giáo viên (Toán – Vật lí – Hóa học)</h3>
            <ol className="mt-2 list-decimal pl-5 space-y-1.5">
              <li>
                <strong>Sao chép & Dán:</strong> Copy công thức, đoạn văn hoặc cả đề kiểm tra Toán, Vật lí, Hóa học từ ChatGPT, Gemini, Word, Google Docs, PDF rồi dán (Ctrl+V / Cmd+V hoặc nút <em>Dán</em>) vào khung <strong>Văn bản gốc</strong> bên trái. Hoặc tải tệp DOCX, PDF, TXT.
              </li>
              <li>
                <strong>Tự động nhận diện theo từng công thức:</strong> Chế độ mặc định <strong>Tự động nhận diện</strong> phân tích độc lập từng công thức trong cùng một tài liệu liên môn (Toán, Vật lí, Hóa học). Thầy cô cũng có thể chọn chế độ môn học cụ thể hoặc đổi môn cho từng công thức trong <em>Chế độ đối chiếu</em>.
              </li>
              <li>
                <strong>Sửa trực quan & Xuất tài liệu:</strong> Nhấp trực tiếp vào bất kỳ công thức nào để mở bảng ký hiệu <strong>MathLive</strong> theo từng môn (Toán học, Vật lí, Hóa học). Sau đó dùng <em>Sao chép cho Word</em> hoặc <strong>Xuất Word (.docx)</strong> để nhận Word Equation OMML chỉnh sửa được ngay.
              </li>
            </ol>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-base font-semibold text-slate-900">2. Đưa công thức sang Microsoft Word đúng chuẩn</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>
                <strong>Khuyến nghị tốt nhất — Xuất Word (.docx):</strong> Tạo tệp Word thật chứa công thức <strong>Word Equation (OMML)</strong> chỉnh sửa trực tiếp cho Toán học, Vật lí và công thức/phương trình Hóa học tuyến tính, giữ nguyên dấu tiếng Việt, số thứ tự câu hỏi, đáp án và bảng biểu. Các công thức cấu tạo Hóa học 2D/vòng phức tạp sẽ được cảnh báo trung thực thay vì xuất lỗi.
              </li>
              <li>
                <strong>Sao chép nhanh cho Word:</strong> Nhấn <em>Sao chép cho Word</em> hoặc bôi đen nội dung rồi nhấn Ctrl+C (ưu tiên Office OMML + MathML). Không tự động cân bằng phương trình hóa học hay thay đổi ký hiệu gốc của giáo viên.
              </li>
            </ul>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-base font-semibold text-slate-900">3. Phím tắt hỗ trợ</h3>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span>Dán nội dung</span>
                <kbd className="font-mono text-xs font-medium text-slate-700">Ctrl + V / Cmd + V</kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span>Chuyển đổi ngay</span>
                <kbd className="font-mono text-xs font-medium text-slate-700">Ctrl + Enter</kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span>Hoàn tác</span>
                <kbd className="font-mono text-xs font-medium text-slate-700">Ctrl + Z / Cmd + Z</kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span>Làm lại</span>
                <kbd className="font-mono text-xs font-medium text-slate-700">Ctrl + Y / Cmd + Shift + Z</kbd>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-base font-semibold text-slate-900">4. Bảo mật đề kiểm tra & Chạy ngoại tuyến</h3>
            <p className="mt-1.5">
              Toàn bộ quá trình sửa lỗi LaTeX, hiển thị MathJax, chỉnh sửa MathLive và xuất tệp Word đều diễn ra <strong>100% trên trình duyệt của thầy cô</strong>. Không yêu cầu đăng nhập, không cần API key và không gửi đề kiểm tra lên bất kỳ máy chủ nào.
            </p>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0B4F8A] px-5 py-2 text-[15px] font-medium text-white hover:bg-[#093F6F] cursor-pointer"
          >
            Bắt đầu làm việc
          </button>
        </div>
      </div>
    </div>
  );
};

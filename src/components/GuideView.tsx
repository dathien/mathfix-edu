import React from 'react';
import { ArrowLeft, BookOpen, Play } from 'lucide-react';
import { PRACTICE_SAMPLES } from '../data/samples';

interface GuideViewProps {
  onBack: () => void;
  onTrySample: (sampleContent: string, title: string) => void;
  onOpenStudio: (subject: 'math' | 'physics' | 'chemistry') => void;
  onOpenLibrary: () => void;
}

interface GuideSection {
  id: string;
  num: number;
  title: string;
  steps: string[];
  note?: string;
  actionLabel?: string;
  sampleId?: string;
  studioSubject?: 'math' | 'physics' | 'chemistry';
  openLibrary?: boolean;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'paste-fix',
    num: 1,
    title: 'Dán công thức lỗi từ ChatGPT / Gemini / Word / PDF và tự động sửa',
    steps: [
      'Sao chép công thức, đoạn văn bản hoặc nguyên đề kiểm tra từ ChatGPT, Gemini, Word, Google Docs hoặc trang web.',
      'Dán trực tiếp (Ctrl+V / Cmd+V) vào khung Văn bản gốc bên trái hoặc nhấn nút "Dán từ clipboard" trên thanh Ribbon.',
      'MathFix EDU tự động nhận diện dấu phân cách ($...$, $$...$$, \\(...\\), \\[...\\]), tự xử lý ký tự thoát thừa (\\\\frac -> \\frac) mà vẫn giữ nguyên xuống dòng hợp lệ (\\\\) trong ma trận và hệ phương trình.',
    ],
    note: 'Ứng dụng không tự ý thay đổi câu chữ tiếng Việt, số liệu, đáp án hay tự giải bài tập.',
    actionLabel: 'Thử ngay với Ví dụ 10 (Văn bản lỗi dán từ AI)',
    sampleId: 'sample-vietnamese-prose',
  },
  {
    id: 'subject-modes',
    num: 2,
    title: 'Sử dụng chế độ Tự động nhận diện / Toán học / Vật lí / Hóa học',
    steps: [
      'Mặc định ứng dụng bật "Tự động" để phân tích từng công thức độc lập trong cùng một tài liệu liên môn Khoa học Tự nhiên.',
      'Khi soạn chuyên đề riêng, thầy cô có thể chọn cứng "Toán học", "Vật lí" hoặc "Hóa học" ở góc phải thanh Ribbon.',
      'Trong chế độ "Đối chiếu trước / sau", thầy cô có thể chuyển đổi môn học thủ công cho từng công thức riêng lẻ nếu cần.',
    ],
    actionLabel: 'Thử ngay Đề liên môn Toán – Lí – Hóa',
    sampleId: 'sample-multisubject',
  },
  {
    id: 'copy-word',
    num: 3,
    title: 'Sao chép công thức và tài liệu sang Microsoft Word',
    steps: [
      'Để dán 1 công thức vào Word: nhấp chọn công thức ở khung bên phải rồi nhấn "Sao chép cho Word" hoặc "Sao chép công thức".',
      'Để dán 1 đoạn văn xen kẽ công thức: bôi đen vùng muốn lấy bằng chuột rồi nhấn Ctrl+C (hoặc nút "Sao chép đoạn chọn").',
      'MathFix EDU ghi đồng thời định dạng Office HTML chứa OMML (<m:oMath>) và MathML chuẩn để Word Desktop nhận thành Word Equation chỉnh sửa được.',
    ],
    note: 'Một số phiên bản Word cũ hoặc Word Web có thể chặn OMML qua clipboard trình duyệt. Khi đó hãy dùng nút "Xuất Word (.docx)" để đảm bảo 100% Word Equation gốc.',
    actionLabel: 'Thử ngay với Ví dụ 1 (Phân số)',
    sampleId: 'sample-fractions',
  },
  {
    id: 'export-docx',
    num: 4,
    title: 'Xuất tệp Word (.docx) chứa công thức Word Equation chỉnh sửa được',
    steps: [
      'Mở thẻ "Xuất tài liệu" trên thanh Ribbon hoặc nhấn nút "Xuất Word (.docx)" trên thanh tiêu đề.',
      'Tệp .docx được tạo hoàn toàn trên trình duyệt với đầy đủ phông chữ, cỡ chữ, lề trang A4, tiêu đề đề kiểm tra (nếu có) và công thức Word Equation (OMML) nhấp đúp chỉnh sửa trực tiếp trong Microsoft Word.',
      'Nếu chỉ cần xuất riêng 1 công thức đang chọn thành tệp Word, dùng nút "Xuất công thức".',
    ],
    actionLabel: 'Thử ngay Đề kiểm tra hoàn chỉnh',
    sampleId: 'sample-full-exam',
  },
  {
    id: 'visual-editor',
    num: 5,
    title: 'Soạn thảo công thức trực quan tương tự MathType (không cần nhớ LaTeX)',
    steps: [
      'Mở thẻ "Soạn công thức" → nhấn "Tạo công thức mới" (hoặc nhấp vào bất kỳ công thức nào trong khung kết quả để chỉnh sửa).',
      'Khung soạn thảo trực quan mở ngay phía trên tài liệu (không che tối màn hình), với đầy đủ nhóm nút trực quan cho Toán học (9 nhóm), Vật lí (7 nhóm) và Hóa học (7 nhóm).',
      'Dùng phím Tab hoặc phím mũi tên để di chuyển giữa các ô vuông nhập liệu (tử số, mẫu số, cận tích phân, chỉ số trên/dưới).',
      'Sau khi soạn xong, nhấn "Chèn nội tuyến" hoặc "Chèn độc lập" để đưa thẳng vào vị trí con trỏ trong đề thi.',
    ],
    actionLabel: 'Mở khung Soạn công thức Toán học',
    studioSubject: 'math',
  },
  {
    id: 'physics-authoring',
    num: 6,
    title: 'Soạn công thức Vật lí (vectơ, chỉ số, chữ Hy Lạp, đơn vị SI)',
    steps: [
      'Mở khung "Soạn công thức Vật lí" để dùng 7 nhóm biểu mẫu: Vectơ lực/vận tốc, Chỉ số chữ (F_ms, F_ht, W_đ), Đạo hàm & vi phân, Chữ cái Hy Lạp (α, β, γ, Δ, λ, ω, Ω, μ, ε), Đơn vị SI, Số mũ khoa học và Hằng số vật lí.',
      'Khi dán văn bản thô như "F_ms = mu N", "W_d = 1/2mv^2", "v = 10 m/s", MathFix EDU tự chuẩn hóa chỉ số nhiều ký tự và giữ đơn vị SI ở kiểu chữ đứng chuẩn.',
    ],
    actionLabel: 'Thử ngay Ví dụ 11 (Vật lí)',
    sampleId: 'sample-physics',
  },
  {
    id: 'chemistry-authoring',
    num: 7,
    title: 'Soạn công thức Hóa học & Bảng tuần hoàn 118 nguyên tố',
    steps: [
      'Mở khung "Soạn công thức Hóa học" để chèn nhanh chỉ số nguyên tử, điện tích ion (Fe³⁺, SO₄²⁻), đồng vị (¹²₆C), mũi tên phản ứng kèm điều kiện nhiệt độ/xúc tác, trạng thái (s)/(l)/(g)/(aq), kết tủa ↓ và khí bay lên ↑.',
      'Chọn nhóm "Bảng tuần hoàn (118)" để tra cứu theo tên, ký hiệu hoặc số hiệu Z và nhấp chèn ngay vào công thức (có tùy chọn chèn dạng đồng vị ᴬ_Z X).',
    ],
    note: 'Ứng dụng không tự cân bằng phương trình hóa học; các công thức cấu tạo 2D phức tạp/vòng được giữ nguyên dạng chữ đều nét và gắn cảnh báo rõ ràng khi xuất Word.',
    actionLabel: 'Thử ngay Ví dụ 12 (Hóa học)',
    sampleId: 'sample-chemistry',
  },
  {
    id: 'format-converter',
    num: 8,
    title: 'Chuyển đổi qua lại giữa 7 định dạng công thức',
    steps: [
      'Mở thẻ "Chuyển đổi chuẩn hóa" trên thanh Ribbon để chuyển công thức đang chọn hoặc toàn bộ tài liệu sang: Word Equation (OMML), MathML, LaTeX nội tuyến ($...$), LaTeX độc lập ($$...$$), UnicodeMath, Vector SVG hoặc ảnh PNG độ phân giải cao (3x DPI).',
      'Mỗi định dạng đều hiển thị rõ trạng thái tương thích và có nút sao chép / tải tệp trực tiếp.',
    ],
    actionLabel: 'Thử ngay với Ví dụ 6 (Tích phân)',
    sampleId: 'sample-integral',
  },
  {
    id: 'formula-library',
    num: 9,
    title: 'Sử dụng và quản lý Thư viện công thức GDPT 2018',
    steps: [
      'Mở thẻ "Thao tác thư viện" → "Thư viện công thức" để duyệt kho công thức Toán – Vật lí – Hóa học lớp 10, 11, 12 theo chủ đề chuẩn Chương trình GDPT 2018.',
      'Lọc nhanh theo môn, khối lớp, chủ đề hoặc gõ từ khóa tìm kiếm; đánh dấu sao (Yêu thích) những công thức hay dùng.',
      'Nhấn "Thêm công thức" hoặc lưu trực tiếp từ khung Soạn công thức để xây dựng thư viện cá nhân lưu offline trên máy (IndexedDB), hỗ trợ Nhập/Xuất tệp JSON sao lưu.',
    ],
    actionLabel: 'Mở Thư viện công thức ngay',
    openLibrary: true,
  },
  {
    id: 'exam-normalize',
    num: 10,
    title: 'Chuẩn hóa toàn bộ đề kiểm tra (không làm thay đổi nội dung)',
    steps: [
      'Mở thẻ "Chuẩn hóa đề thi" → chọn các hạng mục muốn xử lý: công thức, khoảng trắng thừa, dòng trống thừa, nhãn Câu X./Bài X., nhãn phương án A–D / a)–d) và bảng biểu.',
      'Tùy chỉnh phông chữ (Times New Roman / Arial / Cambria), cỡ chữ (12–14pt), giãn dòng (1.15–1.5) và lề trang A4 theo quy định của trường.',
      'Nhấn "Áp dụng chuẩn hóa". Luôn có nút "Khôi phục trước chuẩn hóa" nếu muốn quay lại bản gốc.',
    ],
    actionLabel: 'Thử ngay Đề kiểm tra mẫu',
    sampleId: 'sample-full-exam',
  },
  {
    id: 'exam-tools',
    num: 11,
    title: 'Đánh số câu, căn chỉnh trắc nghiệm và tạo tiêu đề đề kiểm tra',
    steps: [
      'Mở thẻ "Công cụ đề thi" để đánh số lại câu từ đầu hoặc từ dòng con trỏ (tự động bảo toàn các câu chùm như Câu 1–3).',
      'Căn chỉnh phương án A, B, C, D theo 1 cột, 2 cột hoặc 4 phương án trên 1 dòng (tự động xuống dòng khi phương án dài tránh tràn lề).',
      'Chèn nhanh khung mẫu Trắc nghiệm, Đúng/Sai a)–d), Trả lời ngắn, Tự luận và tự nhập Tiêu đề đề kiểm tra (Tên trường, Tổ chuyên môn, Môn, Khối, Thời gian, Mã đề).',
    ],
  },
  {
    id: 'compare-review',
    num: 12,
    title: 'Đối chiếu trước / sau và xác nhận các công thức cần kiểm tra',
    steps: [
      'Nhấn "Đối chiếu trước / sau" trên thanh tiêu đề để xem danh sách mọi công thức đã tự động sửa hoặc đang ở trạng thái "Cần xác nhận".',
      'Các trường hợp mơ hồ không bao giờ bị tự động chấp nhận. Thầy cô có thể chọn Chấp nhận, Từ chối (về bản gốc), Đổi môn học hoặc mở khung Sửa trực quan.',
    ],
    actionLabel: 'Thử ngay Ví dụ 4 (Hệ phương trình)',
    sampleId: 'sample-system',
  },
  {
    id: 'offline-pwa',
    num: 13,
    title: 'Cài đặt ứng dụng để sử dụng hoàn toàn offline trên máy tính & điện thoại',
    steps: [
      'Trên Chrome, Edge hoặc Cốc Cốc: nhấn nút "Cài ứng dụng" trên góc phải thanh tiêu đề (hoặc trong thẻ Tiện ích) rồi xác nhận cài đặt.',
      'Trên iPhone/iPad (Safari): nhấn biểu tượng Chia sẻ → "Thêm vào Màn hình chính".',
      'Mọi bộ máy xử lý (MathJax, MathLive, phông chữ toán học, đọc/xuất DOCX, đọc PDF và Thư viện cá nhân) đều lưu trữ cục bộ ngay trên trình duyệt — đảm bảo tốc độ nhanh và bảo mật tuyệt đối cho đề thi của thầy cô.',
    ],
  },
];

export const GuideView: React.FC<GuideViewProps> = ({
  onBack,
  onTrySample,
  onOpenStudio,
  onOpenLibrary,
}) => {
  const handleRunAction = (sec: GuideSection) => {
    if (sec.sampleId) {
      const sample = PRACTICE_SAMPLES.find((s) => s.id === sec.sampleId);
      if (sample) {
        onTrySample(sample.content, sample.title);
        onBack();
        return;
      }
    }
    if (sec.studioSubject) {
      onBack();
      onOpenStudio(sec.studioSubject);
      return;
    }
    if (sec.openLibrary) {
      onBack();
      onOpenLibrary();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
      {/* Top sticky return bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B4F8A]/10 text-[#0B4F8A]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Hướng dẫn sử dụng MathFix EDU
            </h1>
            <p className="text-sm text-slate-600">
              13 hướng dẫn từng bước rõ ràng cho giáo viên Toán học – Vật lí – Hóa học
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-4 py-2 text-[15px] font-semibold text-white hover:bg-[#093F6F] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại khu vực soạn thảo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table of Contents */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Mục lục hướng dẫn
          </h2>
          <nav className="space-y-1">
            {GUIDE_SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#guide-${sec.id}`}
                className="block rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-sky-50 hover:text-[#0B4F8A] transition-colors"
              >
                <span className="font-semibold text-[#0B4F8A] mr-1.5">{sec.num}.</span>
                {sec.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Detailed 13 Guides */}
        <div className="lg:col-span-8 space-y-4">
          {GUIDE_SECTIONS.map((sec) => (
            <article
              key={sec.id}
              id={`guide-${sec.id}`}
              className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                <span className="text-[#0B4F8A] mr-2">Phần {sec.num}.</span>
                {sec.title}
              </h2>

              <ol className="list-decimal pl-5 space-y-1.5 text-[15px] leading-relaxed text-slate-700">
                {sec.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>

              {sec.note && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-3.5 py-2.5 text-sm text-slate-800">
                  <strong>Lưu ý:</strong> {sec.note}
                </div>
              )}

              {sec.actionLabel && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleRunAction(sec)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B4F8A] bg-sky-50/50 px-3.5 py-1.5 text-sm font-semibold text-[#0B4F8A] hover:bg-[#0B4F8A] hover:text-white transition-colors cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{sec.actionLabel}</span>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

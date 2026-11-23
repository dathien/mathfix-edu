import { SampleItem } from '../engine/types';

/**
 * 10 Ví dụ thực hành (Section 17).
 * Được đánh dấu rõ ràng là ví dụ thực hành và chỉ nạp khi giáo viên chủ động chọn.
 */
export const PRACTICE_SAMPLES: SampleItem[] = [
  {
    id: 'sample-fractions',
    index: 1,
    title: 'Ví dụ 1: Công thức phân số',
    category: 'Phân số',
    description: 'Phân số viết tắt, thiếu dấu gạch chéo, phân số lồng nhau',
    content: `[VÍ DỤ THỰC HÀNH – PHÂN SỐ]
Tính giá trị biểu thức sau:
A = frac{2x + 1}{x - 3} + \\frac12 - \\dfrac{x^2 + 1}{\\frac{1}{x} + 2}
Rút gọn phân số bị thiếu ngoặc đóng: $\\frac{a^2 - b^2}{a + b$`,
  },
  {
    id: 'sample-radicals',
    index: 2,
    title: 'Ví dụ 2: Công thức căn thức',
    category: 'Căn thức',
    description: 'Căn bậc hai, căn bậc ba, căn lồng nhau và ký hiệu √',
    content: `[VÍ DỤ THỰC HÀNH – CĂN THỨC]
Giải phương trình chứa căn thức:
√(2x + 3) + ∛(x - 1) = \\sqtr{\\frac{x + 5}{2}}
Tính giá trị: $P = \\sqrt{5 + 2\\sqrt{6}} - \\sqrt(5 - 2\\sqrt{6})$`,
  },
  {
    id: 'sample-quadratic',
    index: 3,
    title: 'Ví dụ 3: Phương trình bậc hai',
    category: 'Đại số',
    description: 'Ký tự số mũ Unicode x², biệt thức Δ và công thức nghiệm',
    content: `[VÍ DỤ THỰC HÀNH – PHƯƠNG TRÌNH BẬC HAI]
Cho phương trình bậc hai: x² - 5x + 6 = 0 với biệt thức Δ = b² - 4ac.
Công thức nghiệm tổng quát:
$$x_{1,2} = frac{-b +- sqrt(b^2 - 4ac)}{2a}$$`,
  },
  {
    id: 'sample-system',
    index: 4,
    title: 'Ví dụ 4: Hệ phương trình',
    category: 'Hệ phương trình',
    description: 'Hệ phương trình tuyến tính dùng môi trường cases',
    content: `[VÍ DỤ THỰC HÀNH – HỆ PHƯƠNG TRÌNH]
Giải hệ phương trình sau trên tập số thực $\\R$:
$$\\begin{casess} 2x + 3y = 7 \\\\ x - 2y = -1 \\end{casess}$$
Điều kiện xác định: $x >= 1$ và $y != 0$.`,
  },
  {
    id: 'sample-derivative',
    index: 5,
    title: 'Ví dụ 5: Đạo hàm và giới hạn',
    category: 'Giải tích',
    description: 'Đạo hàm, giới hạn lim, hàm lượng giác và logarit',
    content: `[VÍ DỤ THỰC HÀNH – ĐẠO HÀM VÀ GIỚI HẠN]
Tính giới hạn: $$L = lim_{x->0} frac{sin x}{x} = 1$$
Cho hàm số $y = \\frac{x^3}{3} - 2x^2 + 3x - 1$. Đạo hàm của hàm số là $y' = x^2 - 4x + 3$.
Đạo hàm hàm hợp: $(\\ln(x^2 + 1))' = \\frac{2x}{x^2 + 1}$ và $(\\tg x)' = \\frac{1}{\\cos^2 x}$.`,
  },
  {
    id: 'sample-integral',
    index: 6,
    title: 'Ví dụ 6: Tích phân và nguyên hàm',
    category: 'Giải tích',
    description: 'Tích phân xác định, nguyên hàm và tổng xích-ma',
    content: `[VÍ DỤ THỰC HÀNH – TÍCH PHÂN]
Tính tích phân xác định:
$$I = \\int_0^1 \\frac{2x + 1}{x^2 + x + 1} \\mathrm{d}x$$
Tìm họ nguyên hàm: $F(x) = \\int (3x^2 - 2\\cos x + e^x) dx$
Tính tổng: $$S = sum_{k=1}^{n} \\frac{1}{k(k+1)} = \\frac{n}{n+1}$$`,
  },
  {
    id: 'sample-vectors',
    index: 7,
    title: 'Ví dụ 7: Vectơ và Hình học Oxyz',
    category: 'Hình học',
    description: 'Vectơ hai điểm, góc, tam giác, vuông góc, song song',
    content: `[VÍ DỤ THỰC HÀNH – HÌNH HỌC & VECTƠ]
Trong không gian Oxyz, cho hai điểm $A(1; -2; 3)$ và $B(3; 0; -1)$.
Khi đó $\\vec{AB} = (2; 2; -4)$ và độ dài đoạn thẳng $\\overline{AB} = 2\\sqrt{6}$.
Trong △ABC vuông tại A, ta có AB ⊥ AC, ∠BAC = 90° và đường trung bình MN ∥ BC.`,
  },
  {
    id: 'sample-matrix',
    index: 8,
    title: 'Ví dụ 8: Ma trận và Định thức',
    category: 'Đại số tuyến tính',
    description: 'Ma trận pmatrix, định thức vmatrix và tổ hợp',
    content: `[VÍ DỤ THỰC HÀNH – MA TRẬN & XÁC SUẤT]
Cho ma trận vuông cấp 2:
$$A = \\begin{pmatix} 2 & -1 \\\\ 3 & 4 \\end{pmatix}, \\quad \\det(A) = \\begin{vmatrix} 2 & -1 \\\\ 3 & 4 \\end{vmatrix} = 11$$
Số cách chọn $k$ phần tử từ $n$ phần tử là $C_n^k = \\binom{n}{k} = \\frac{n!}{k!(n-k)!}$ với $0 <= k <= n$.`,
  },
  {
    id: 'sample-full-exam',
    index: 9,
    title: 'Ví dụ 9: Đề kiểm tra trắc nghiệm & tự luận',
    category: 'Đề kiểm tra',
    description: 'Cấu trúc đề thi đầy đủ: Trắc nghiệm A/B/C/D, Đúng/Sai, Trả lời ngắn, Tự luận và Bảng số liệu',
    content: `ĐỀ KIỂM TRA GIỮA HỌC KÌ II – MÔN TOÁN LỚP 12 (VÍ DỤ THỰC HÀNH)

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.
Câu 1. Họ nguyên hàm của hàm số $f(x) = 3x^2 + \\frac12 x - 1$ là:
A. $x^3 + \\frac{1}{4}x^2 - x + C$
B. $x^3 + \\frac{1}{2}x^2 - x + C$
C. $6x + \\frac{1}{2} + C$
D. $x^3 - \\frac{1}{4}x^2 - x + C$

Câu 2. Trong không gian Oxyz, cho mặt phẳng $(P): 2x - y + 3z - 5 = 0$. Vectơ pháp tuyến của $(P)$ là:
A. $\\vec{n} = (2; -1; 3)$
B. $\\vec{n} = (2; 1; 3)$
C. $\\vec{n} = (-2; -1; 3)$
D. $\\vec{n} = (2; -1; -5)$

PHẦN II. Câu trắc nghiệm đúng sai.
Câu 3. Cho hàm số $y = f(x) = \\frac{x^2 + 2x - 3}{x + 1}$ có đồ thị $(C)$.
a) Tập xác định của hàm số là $D = \\R \\setminus \\{-1\\}$.
b) Giới hạn $\\lim_{x->+infty} f(x) = +\\infty$.

PHẦN III. Câu trắc nghiệm trả lời ngắn.
Câu 4. Tính tích phân $I = \\int_0^{\\pi/2} \\sin x \\, dx$ và ghi kết quả vào ô trống.

| Giá trị $x$ | $0$ | $\\frac{\\pi}{6}$ | $\\frac{\\pi}{2}$ |
| --- | --- | --- | --- |
| $\\sin x$ | $0$ | $\\frac{1}{2}$ | $1$ |

PHẦN IV. Tự luận.
Câu 5. Giải phương trình $\\sqrt{2x^2 - 3x + 1} = x - 1$ trên tập số thực.`,
  },
  {
    id: 'sample-vietnamese-prose',
    index: 10,
    title: 'Ví dụ 10: Đoạn văn tiếng Việt nhiều công thức',
    category: 'Văn bản hỗn hợp',
    subject: 'math',
    description: 'Kiểm chứng giữ nguyên dấu tiếng Việt khi có nhiều công thức xen kẽ và lỗi dán từ AI',
    content: `[VÍ DỤ THỰC HÀNH – VĂN BẢN TIẾNG VIỆT]
Cho hàm số bậc ba $y = ax^3 + bx^2 + cx + d$ (với $a != 0$) liên tục trên đoạn $[1; 5]$. Khi sao chép từ ChatGPT hoặc Gemini, công thức thường bị dính ký tự toán học Unicode như 𝑥² + 2𝑥 − 3 = 0, thiếu dấu ngoặc như \\frac{x+1}{x-2 hoặc sai chính tả \\sqtr{x^2 + 1}.
Ngoài ra, học sinh cần lưu ý điều kiện tồn tại của biểu thức logarit: với cơ số $a > 0, a \\ne 1$, biểu thức $\\log_a(x - 1)$ xác định khi và chỉ khi $x > 1$. Tập nghiệm bất phương trình $x^2 - 4 <= 0$ là đoạn $[-2; 2] \\subset \\mathbb{R}$.`,
  },
  {
    id: 'sample-physics',
    index: 11,
    title: 'Ví dụ 11: Công thức Vật lí (Cơ – Điện – Từ)',
    category: 'Vật lí',
    subject: 'physics',
    description: 'Vectơ lực, động năng, chỉ số nhiều ký tự, chữ Hy Lạp và đơn vị SI',
    content: `[VÍ DỤ THỰC HÀNH – VẬT LÍ]
Câu 1. Theo định luật II Newton, ta có $\\vec{F} = m\\vec{a}$. Lực ma sát trượt có độ lớn $F_ms = \\mu N$ và lực hướng tâm $F_ht = m\\frac{v^2}{r}$.
Câu 2. Động năng của vật chuyển động với vận tốc $v = 10 m/s$ là W_d = \\frac12mv^2. Gia tốc trọng trường tại mặt đất lấy $g = 9.8 m/s^2$.
Câu 3. Mạch điện tuân theo định luật Ôm U = IR với điện trở $R = 20 Ω$ và dòng điện $I = 2 A$. Lực Lo-ren-xơ tác dụng lên hạt mang điện là F = qvB\\sin\\alpha.`,
  },
  {
    id: 'sample-chemistry',
    index: 12,
    title: 'Ví dụ 12: Công thức & Phương trình Hóa học',
    category: 'Hóa học',
    subject: 'chemistry',
    description: 'Phân tử, ion, điện tích, mũi tên phản ứng, điều kiện nhiệt độ, trạng thái và kết tủa/khí',
    content: `[VÍ DỤ THỰC HÀNH – HÓA HỌC]
Câu 1. Axit sunfuric có công thức phân tử H2SO4, bazơ canxi hiđroxit là Ca(OH)2, ion sắt(III) là Fe3+ và ion sunfat là SO4^2-.
Câu 2. Phản ứng đốt cháy khí hiđro: 2H2 + O2 ->[t°] 2H2O
Câu 3. Phản ứng nhiệt phân đá vôi: CaCO3 ->[t°] CaO + CO2 ↑
Câu 4. Phản ứng tổng hợp amoniac thuận nghịch: N2(g) + 3H2(g) <=>[xt, t°] 2NH3(g)
Câu 5. Phản ứng trao đổi ion tạo kết tủa: AgNO3(aq) + NaCl(aq) -> AgCl ↓ + NaNO3(aq)
Câu 6. Công thức thu gọn của etanol là CH3-CH2-OH và dung dịch chuẩn \\ce{Fe2(SO4)3}.`,
  },
  {
    id: 'sample-multisubject',
    index: 13,
    title: 'Ví dụ 13: Tài liệu liên môn Toán – Vật lí – Hóa học',
    category: 'Liên môn KHTN',
    subject: 'auto',
    description: 'Một đề Khoa học Tự nhiên chứa đồng thời công thức Toán, Vật lí và Hóa học (tự động nhận diện từng công thức)',
    content: `ĐỀ KIỂM TRA KHOA HỌC TỰ NHIÊN – TÍCH HỢP TOÁN, VẬT LÍ, HÓA HỌC (VÍ DỤ THỰC HÀNH)

PHẦN I. Toán học ứng dụng
Câu 1. Giải phương trình $\\frac{x^2 + 1}{2} = 5$ và tính tích phân $I = \\int_0^1 x^2\\,dx$.

PHẦN II. Vật lí
Câu 2. Một vật có khối lượng $m = 2 kg$ chịu tác dụng của hợp lực $\\vec{F} = m\\vec{a}$, có động năng $W_d = \\frac12mv^2$ và công suất dòng điện $P = UI$ ở nhiệt độ $25 °C$.

PHẦN III. Hóa học
Câu 3. Cho dung dịch H2SO4 tác dụng với muối BaCl2 theo phương trình:
BaCl2 + H2SO4 -> BaSO4 ↓ + 2HCl
Phản ứng thuận nghịch tạo lưu huỳnh trioxit: 2SO2 + O2 <=>[V2O5, t°] 2SO3.`,
  },
];

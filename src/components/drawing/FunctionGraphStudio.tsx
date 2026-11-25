import React, { useMemo, useState } from 'react';
import { Check, Download, Eye, EyeOff, Image as ImageIcon, Plus, Save, Trash2, X } from 'lucide-react';
import { GraphExpressionItem, GraphPlotState, GraphViewMode, StrokeStyle } from '../../engine/figureTypes';
import {
  createDefaultGraphState,
  renderGraphPlotToSvg,
  validateMathExpression,
} from '../../engine/graphEngine';
import { svgMarkupToPngDataUrl } from '../../engine/svgSanitizer';

interface FunctionGraphStudioProps {
  initialState?: GraphPlotState;
  initialTitle?: string;
  initialCaption?: string;
  isEditingExisting?: boolean;
  onCommit: (payload: {
    state: GraphPlotState;
    svgMarkup: string;
    pngDataUrl: string;
    title: string;
    caption: string;
  }) => void;
  onSaveToLibrary: (payload: { name: string; state: GraphPlotState }) => void;
  onCancel: () => void;
}

const PRESET_EXPRESSIONS = [
  { label: 'Bậc nhất', expr: '2*x - 1', title: 'y = 2x - 1' },
  { label: 'Parabol', expr: 'x^2 - 2*x - 1', title: 'y = x² - 2x - 1' },
  { label: 'Bậc ba', expr: 'x^3 - 3*x', title: 'y = x³ - 3x' },
  { label: 'Trùng phương', expr: 'x^4 - 2*x^2', title: 'y = x⁴ - 2x²' },
  { label: 'Phân thức (TCĐ)', expr: '(2*x - 1)/(x - 1)', title: 'y = (2x-1)/(x-1)' },
  { label: 'Hàm mũ 2^x', expr: '2^x', title: 'y = 2^x' },
  { label: 'Logarit ln(x)', expr: 'ln(x)', title: 'y = ln(x)' },
  { label: 'Lượng giác sin(x)', expr: 'sin(x)', title: 'y = sin(x)' },
  { label: 'Trị tuyệt đối', expr: 'abs(x^2 - 2)', title: 'y = |x² - 2|' },
  { label: 'Từng khoảng', expr: 'x < 0 ? -x : x^2', title: 'Hàm từng khoảng' },
];

const CURVE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c', '#0f766e'];

export const FunctionGraphStudio: React.FC<FunctionGraphStudioProps> = ({
  initialState,
  initialTitle = 'Đồ thị hàm số',
  initialCaption = '',
  isEditingExisting = false,
  onCommit,
  onSaveToLibrary,
  onCancel,
}) => {
  const [state, setState] = useState<GraphPlotState>(() =>
    initialState ? structuredClone(initialState) : createDefaultGraphState()
  );
  const [title, setTitle] = useState(initialTitle);
  const [caption, setCaption] = useState(initialCaption);
  const [statusMsg, setStatusMsg] = useState('');

  const svgMarkup = useMemo(() => renderGraphPlotToSvg(state), [state]);

  const addCurve = (expr = 'x^2 - 1', label = 'y = x^2 - 1') => {
    const nextColor = CURVE_COLORS[state.expressions.length % CURVE_COLORS.length];
    const item: GraphExpressionItem = {
      id: `expr_${Date.now().toString(36)}`,
      label,
      expression: expr,
      color: nextColor,
      strokeWidth: 2.5,
      strokeStyle: 'solid',
      visible: true,
    };
    setState((p) => ({ ...p, expressions: [...p.expressions, item] }));
  };

  const updateCurve = (id: string, patch: Partial<GraphExpressionItem>) => {
    setState((p) => ({
      ...p,
      expressions: p.expressions.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  };

  const removeCurve = (id: string) => {
    setState((p) => ({ ...p, expressions: p.expressions.filter((e) => e.id !== id) }));
  };

  const handleExportSvg = () => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'do-thi').replace(/\s+/g, '-')}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMsg('Đã xuất đồ thị/bảng sang SVG.');
  };

  const handleExportPng = async () => {
    const png = await svgMarkupToPngDataUrl(svgMarkup, 2);
    if (!png) return;
    const a = document.createElement('a');
    a.href = png;
    a.download = `${(title || 'do-thi').replace(/\s+/g, '-')}.png`;
    a.click();
    setStatusMsg('Đã xuất PNG độ phân giải cao.');
  };

  const handleCommit = async () => {
    const pngDataUrl = (await svgMarkupToPngDataUrl(svgMarkup, 2)) || '';
    onCommit({
      state,
      svgMarkup,
      pngDataUrl,
      title: title.trim() || 'Đồ thị hàm số',
      caption: caption.trim(),
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-[15px]">
      {/* Mode bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-slate-200">
        {([
          { id: 'graph', label: 'Đồ thị hàm số' },
          { id: 'variation_table', label: 'Bảng biến thiên' },
          { id: 'sign_table', label: 'Bảng xét dấu' },
          { id: 'value_table', label: 'Bảng giá trị' },
        ] as Array<{ id: GraphViewMode; label: string }>).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setState((p) => ({ ...p, viewMode: m.id }))}
            className={`px-3.5 py-1.5 rounded-lg text-[14.5px] font-semibold border transition-colors ${
              state.viewMode === m.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr] overflow-hidden">
        {/* LEFT CONTROLS */}
        <aside className="bg-white border-r border-slate-200 overflow-y-auto p-3.5 space-y-4">
          <div className="space-y-2">
            <label className="block text-[13.5px] font-semibold text-slate-700">Tên hình</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[14.5px]"
            />
            <label className="block text-[13.5px] font-semibold text-slate-700">Chú thích dưới hình</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="VD: Đồ thị hàm số y = x³ - 3x"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[14.5px]"
            />
          </div>

          {(state.viewMode === 'graph' || state.viewMode === 'value_table') && (
            <>
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-slate-800">Danh sách hàm số (hỗ trợ LaTeX & biểu thức)</span>
                  <button
                    type="button"
                    onClick={() => addCurve()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm hàm</span>
                  </button>
                </div>

                {state.expressions.map((item) => {
                  const check = validateMathExpression(item.expression);
                  return (
                    <div key={item.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={item.color}
                          onChange={(e) => updateCurve(item.id, { color: e.target.value })}
                          className="w-7 h-7 rounded cursor-pointer border border-slate-300"
                        />
                        <input
                          type="text"
                          value={item.expression}
                          onChange={(e) => updateCurve(item.id, { expression: e.target.value, label: `y = ${e.target.value}` })}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded bg-white font-mono text-[14px]"
                          placeholder="VD: x^3 - 3*x hoặc \frac{2x-1}{x-1}"
                        />
                        <button
                          type="button"
                          onClick={() => updateCurve(item.id, { visible: !item.visible })}
                          title="Ẩn/hiện đồ thị"
                          className="p-1 text-slate-600 hover:text-blue-600"
                        >
                          {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCurve(item.id)}
                          title="Xóa hàm"
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateCurve(item.id, { label: e.target.value })}
                          placeholder="Nhãn chú giải"
                          className="px-2 py-1 border border-slate-200 rounded bg-white text-[13.5px]"
                        />
                        <select
                          value={item.strokeStyle}
                          onChange={(e) => updateCurve(item.id, { strokeStyle: e.target.value as StrokeStyle })}
                          className="px-2 py-1 border border-slate-200 rounded bg-white text-[13.5px]"
                        >
                          <option value="solid">Nét liền</option>
                          <option value="dashed">Nét đứt</option>
                          <option value="dotted">Nét chấm</option>
                        </select>
                      </div>
                      {!check.ok && (
                        <div className="text-[13px] text-red-600 font-medium">{check.error}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick presets */}
              <div className="pt-2 border-t border-slate-200">
                <div className="text-[13.5px] font-semibold text-slate-700 mb-1.5">Mẫu hàm phổ biến</div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_EXPRESSIONS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          expressions: [
                            {
                              id: `expr_${Date.now().toString(36)}`,
                              label: p.title,
                              expression: p.expr,
                              color: '#2563eb',
                              strokeWidth: 2.5,
                              strokeStyle: 'solid',
                              visible: true,
                            },
                          ],
                        }))
                      }
                      className="px-2 py-1 text-[13px] rounded-md border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {state.viewMode === 'graph' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="text-[13.5px] font-bold text-slate-800">Miền hiển thị & Trục tọa độ</div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['xMin', 'x tối thiểu'],
                    ['xMax', 'x tối đa'],
                    ['yMin', 'y tối thiểu'],
                    ['yMax', 'y tối đa'],
                  ] as const
                ).map(([key, lbl]) => (
                  <div key={key}>
                    <label className="block text-[13px] text-slate-600">{lbl}</label>
                    <input
                      type="number"
                      value={state[key]}
                      onChange={(e) => setState((p) => ({ ...p, [key]: Number(e.target.value) }))}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-[14px]"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[14px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={state.showGrid} onChange={(e) => setState((p) => ({ ...p, showGrid: e.target.checked }))} />
                  <span>Lưới tọa độ</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={state.showAxes} onChange={(e) => setState((p) => ({ ...p, showAxes: e.target.checked }))} />
                  <span>Trục Ox, Oy</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={state.showAsymptotes} onChange={(e) => setState((p) => ({ ...p, showAsymptotes: e.target.checked }))} />
                  <span>Tiệm cận đứng</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={state.showTicks} onChange={(e) => setState((p) => ({ ...p, showTicks: e.target.checked }))} />
                  <span>Vạch chia số</span>
                </label>
              </div>
            </div>
          )}

          {state.viewMode === 'value_table' && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <label className="block text-[13.5px] font-semibold text-slate-700">
                Các giá trị x (ngăn cách bởi dấu phẩy)
              </label>
              <input
                type="text"
                value={state.valueTableXs}
                onChange={(e) => setState((p) => ({ ...p, valueTableXs: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-[14px]"
              />
            </div>
          )}

          {(state.viewMode === 'variation_table' || state.viewMode === 'sign_table') && (
            <div className="pt-2 border-t border-slate-200 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[13px] text-slate-600">Tên hàng 2</label>
                  <input
                    type="text"
                    value={state.tableDerivLabel}
                    onChange={(e) => setState((p) => ({ ...p, tableDerivLabel: e.target.value }))}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-[14px]"
                  />
                </div>
                {state.viewMode === 'variation_table' && (
                  <div>
                    <label className="block text-[13px] text-slate-600">Tên hàng 3</label>
                    <input
                      type="text"
                      value={state.tableFuncLabel}
                      onChange={(e) => setState((p) => ({ ...p, tableFuncLabel: e.target.value }))}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-[14px]"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-slate-800">Các mốc giá trị (cột)</span>
                <button
                  type="button"
                  onClick={() =>
                    setState((p) => ({
                      ...p,
                      tableColumns: [...p.tableColumns, { xLabel: '2', signOrZero: '0', yValue: '0', trend: 'up' }],
                    }))
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 text-[13px] bg-blue-50 text-blue-700 border border-blue-200 rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm mốc</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {state.tableColumns.map((col, idx) => (
                  <div key={idx} className="grid grid-cols-[62px_60px_64px_1fr_28px] gap-1 items-center">
                    <input
                      type="text"
                      value={col.xLabel}
                      onChange={(e) =>
                        setState((p) => ({
                          ...p,
                          tableColumns: p.tableColumns.map((c, i) => (i === idx ? { ...c, xLabel: e.target.value } : c)),
                        }))
                      }
                      title="Giá trị x"
                      className="px-1.5 py-1 border border-slate-300 rounded text-[13.5px]"
                    />
                    <select
                      value={col.signOrZero}
                      onChange={(e) =>
                        setState((p) => ({
                          ...p,
                          tableColumns: p.tableColumns.map((c, i) => (i === idx ? { ...c, signOrZero: e.target.value } : c)),
                        }))
                      }
                      title="Tại mốc: 0, || (không xác định)"
                      className="px-1 py-1 border border-slate-300 rounded text-[13.5px] bg-white"
                    >
                      <option value="">—</option>
                      <option value="0">0</option>
                      <option value="||">||</option>
                      <option value="+">+</option>
                      <option value="-">−</option>
                    </select>
                    <input
                      type="text"
                      value={col.yValue}
                      onChange={(e) =>
                        setState((p) => ({
                          ...p,
                          tableColumns: p.tableColumns.map((c, i) => (i === idx ? { ...c, yValue: e.target.value } : c)),
                        }))
                      }
                      title="Giá trị y"
                      className="px-1.5 py-1 border border-slate-300 rounded text-[13.5px]"
                    />
                    <select
                      value={col.trend || 'none'}
                      onChange={(e) =>
                        setState((p) => ({
                          ...p,
                          tableColumns: p.tableColumns.map((c, i) =>
                            i === idx ? { ...c, trend: e.target.value as 'up' | 'down' | 'none' } : c
                          ),
                        }))
                      }
                      title="Chiều biến thiên sang mốc kế tiếp"
                      className="px-1 py-1 border border-slate-300 rounded text-[13px] bg-white"
                    >
                      <option value="up">Tăng (+)</option>
                      <option value="down">Giảm (−)</option>
                      <option value="none">Dừng</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setState((p) => ({
                          ...p,
                          tableColumns: p.tableColumns.filter((_, i) => i !== idx),
                        }))
                      }
                      disabled={state.tableColumns.length <= 2}
                      className="p-1 text-red-500 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* CENTER LIVE PREVIEW */}
        <div className="bg-slate-100/70 p-6 flex items-center justify-center overflow-auto">
          <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-4 max-w-full">
            <div
              className="[&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExportSvg} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4" />
            <span>Xuất SVG</span>
          </button>
          <button type="button" onClick={handleExportPng} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
            <ImageIcon className="w-4 h-4" />
            <span>Xuất PNG</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveToLibrary({ name: title.trim() || 'Đồ thị hàm số', state });
              setStatusMsg('Đã lưu vào Thư viện cá nhân.');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          >
            <Save className="w-4 h-4" />
            <span>Lưu vào thư viện</span>
          </button>
          {statusMsg && <span className="text-[14px] text-emerald-700 font-medium">{statusMsg}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[15px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
            <span>Hủy</span>
          </button>
          <button type="button" onClick={handleCommit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm">
            <Check className="w-4 h-4" />
            <span>{isEditingExisting ? 'Cập nhật đồ thị' : 'Chèn vào câu hỏi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Image as ImageIcon, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { ChemAtomNode, ChemBondOrder, ChemDisplayMode, ChemStructureState } from '../../engine/figureTypes';
import {
  checkValenceWarnings,
  createAceticAcidStructure,
  createBenzeneStructure,
  createDefaultChemStructure,
  createEthanolStructure,
  renderChemStructureToSvg,
} from '../../engine/chemStructureEngine';
import { svgMarkupToPngDataUrl } from '../../engine/svgSanitizer';

interface ChemStructureStudioProps {
  initialState?: ChemStructureState;
  initialTitle?: string;
  initialCaption?: string;
  isEditingExisting?: boolean;
  onCommit: (payload: {
    state: ChemStructureState;
    svgMarkup: string;
    pngDataUrl: string;
    title: string;
    caption: string;
  }) => void;
  onSaveToLibrary: (payload: { name: string; state: ChemStructureState }) => void;
  onCancel: () => void;
}

const QUICK_ELEMENTS = ['C', 'H', 'O', 'N', 'Cl', 'Br', 'S', 'P', 'F', 'Na', 'K', 'Fe', 'Cu'];

export const ChemStructureStudio: React.FC<ChemStructureStudioProps> = ({
  initialState,
  initialTitle = 'Công thức cấu tạo Hóa học',
  initialCaption = '',
  isEditingExisting = false,
  onCommit,
  onSaveToLibrary,
  onCancel,
}) => {
  const [state, setState] = useState<ChemStructureState>(() =>
    initialState ? structuredClone(initialState) : createDefaultChemStructure()
  );
  const [activeElement, setActiveElement] = useState('C');
  const [bondOrder, setBondOrder] = useState<ChemBondOrder>(1);
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [caption, setCaption] = useState(initialCaption);
  const [statusMsg, setStatusMsg] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  const svgMarkup = useMemo(() => renderChemStructureToSvg(state), [state]);
  const valenceWarnings = useMemo(() => checkValenceWarnings(state), [state]);
  const selectedAtom = state.atoms.find((a) => a.id === selectedAtomId) ?? null;

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const svgEl = canvasRef.current?.querySelector('svg');
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * state.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * state.height);

    // Check if clicking near an existing atom
    const nearAtom = state.atoms.find((a) => Math.hypot(a.x - x, a.y - y) <= 22);
    if (nearAtom) {
      if (selectedAtomId && selectedAtomId !== nearAtom.id) {
        // Connect or cycle bond order between selectedAtomId and nearAtom
        const existingBond = state.bonds.find(
          (b) =>
            (b.from === selectedAtomId && b.to === nearAtom.id) ||
            (b.from === nearAtom.id && b.to === selectedAtomId)
        );
        if (existingBond) {
          setState((p) => ({
            ...p,
            bonds: p.bonds.map((b) =>
              b.id === existingBond.id
                ? { ...b, order: (b.order === 3 ? 1 : ((b.order + 1) as ChemBondOrder)) }
                : b
            ),
          }));
        } else {
          setState((p) => ({
            ...p,
            bonds: [
              ...p.bonds,
              { id: `b_${Date.now().toString(36)}`, from: selectedAtomId, to: nearAtom.id, order: bondOrder },
            ],
          }));
        }
        setSelectedAtomId(nearAtom.id);
      } else {
        setSelectedAtomId(nearAtom.id);
      }
      return;
    }

    // Add new atom (and auto-bond to currently selected atom if any!)
    const newAtom: ChemAtomNode = {
      id: `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      element: activeElement,
      x,
      y,
      lonePairs: activeElement === 'O' ? 2 : activeElement === 'N' ? 1 : 0,
    };
    setState((p) => ({
      ...p,
      atoms: [...p.atoms, newAtom],
      bonds: selectedAtomId
        ? [
            ...p.bonds,
            { id: `b_${Date.now().toString(36)}`, from: selectedAtomId, to: newAtom.id, order: bondOrder },
          ]
        : p.bonds,
    }));
    setSelectedAtomId(newAtom.id);
  };

  const updateSelectedAtom = (patch: Partial<ChemAtomNode>) => {
    if (!selectedAtomId) return;
    setState((p) => ({
      ...p,
      atoms: p.atoms.map((a) => (a.id === selectedAtomId ? { ...a, ...patch } : a)),
    }));
  };

  const deleteSelectedAtom = () => {
    if (!selectedAtomId) return;
    setState((p) => ({
      ...p,
      atoms: p.atoms.filter((a) => a.id !== selectedAtomId),
      bonds: p.bonds.filter((b) => b.from !== selectedAtomId && b.to !== selectedAtomId),
    }));
    setSelectedAtomId(null);
  };

  const handleExportSvg = () => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'cau-tao-hoa-hoc').replace(/\s+/g, '-')}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMsg('Đã xuất công thức cấu tạo sang SVG.');
  };

  const handleExportPng = async () => {
    const png = await svgMarkupToPngDataUrl(svgMarkup, 2);
    if (!png) return;
    const a = document.createElement('a');
    a.href = png;
    a.download = `${(title || 'cau-tao-hoa-hoc').replace(/\s+/g, '-')}.png`;
    a.click();
    setStatusMsg('Đã xuất PNG độ phân giải cao.');
  };

  const handleCommit = async () => {
    const pngDataUrl = (await svgMarkupToPngDataUrl(svgMarkup, 2)) || '';
    onCommit({
      state,
      svgMarkup,
      pngDataUrl,
      title: title.trim() || 'Công thức cấu tạo Hóa học',
      caption: caption.trim(),
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-[15px]">
      {/* TOP BAR: ELEMENTS, BOND ORDER, DISPLAY MODE */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1">
          <span className="text-[13.5px] font-semibold text-slate-600 mr-1">Nguyên tố:</span>
          {QUICK_ELEMENTS.map((el) => (
            <button
              key={el}
              type="button"
              onClick={() => setActiveElement(el)}
              className={`px-2 py-1 rounded text-[14px] font-bold border ${
                activeElement === el
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-emerald-50'
              }`}
            >
              {el}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-1">
          <span className="text-[13.5px] font-semibold text-slate-600 mr-1">Liên kết:</span>
          {([
            { order: 1, label: 'Đơn (—)' },
            { order: 2, label: 'Đôi (=)' },
            { order: 3, label: 'Ba (≡)' },
          ] as Array<{ order: ChemBondOrder; label: string }>).map((b) => (
            <button
              key={b.order}
              type="button"
              onClick={() => setBondOrder(b.order)}
              className={`px-2.5 py-1 rounded-lg text-[14px] font-medium border ${
                bondOrder === b.order
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-1">
          <span className="text-[13.5px] font-semibold text-slate-600 mr-1">Hiển thị:</span>
          {([
            { id: 'condensed', label: 'Thu gọn' },
            { id: 'skeletal', label: 'Khung (Skeletal)' },
            { id: 'lewis', label: 'Lewis (e⁻)' },
          ] as Array<{ id: ChemDisplayMode; label: string }>).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setState((p) => ({ ...p, displayMode: m.id }))}
              className={`px-2.5 py-1 rounded-lg text-[14px] font-medium border ${
                state.displayMode === m.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* NON-AUTO-MODIFYING VALENCE WARNING BANNER */}
      {valenceWarnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 flex items-center gap-2 text-[14px]">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Cảnh báo hóa trị (không tự sửa dữ liệu):</strong> {valenceWarnings.map((w) => w.message).join(' ')}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr_270px] overflow-hidden">
        {/* LEFT PRESETS */}
        <aside className="bg-white border-r border-slate-200 overflow-y-auto p-3 space-y-2">
          <div className="text-[14px] font-bold text-slate-800">Mẫu cấu tạo nhanh</div>
          {[
            { label: 'Vòng Benzen (C₆H₆)', fn: createBenzeneStructure },
            { label: 'Etanol (C₂H₅OH)', fn: createEthanolStructure },
            { label: 'Axit axetic (CH₃COOH)', fn: createAceticAcidStructure },
            {
              label: 'Etilen (CH₂=CH₂)',
              fn: (): ChemStructureState => ({
                width: 480,
                height: 280,
                displayMode: 'condensed',
                atoms: [{ id: 'c1', element: 'C', x: 170, y: 140 }, { id: 'c2', element: 'C', x: 310, y: 140 }],
                bonds: [{ id: 'b1', from: 'c1', to: 'c2', order: 2 }],
              }),
            },
            {
              label: 'Axetilen (CH≡CH)',
              fn: (): ChemStructureState => ({
                width: 480,
                height: 280,
                displayMode: 'condensed',
                atoms: [{ id: 'c1', element: 'C', x: 170, y: 140 }, { id: 'c2', element: 'C', x: 310, y: 140 }],
                bonds: [{ id: 'b1', from: 'c1', to: 'c2', order: 3 }],
              }),
            },
            {
              label: 'Mạch nhánh Isobutan',
              fn: (): ChemStructureState => ({
                width: 480,
                height: 280,
                displayMode: 'condensed',
                atoms: [
                  { id: 'c1', element: 'C', x: 140, y: 170 },
                  { id: 'c2', element: 'C', x: 240, y: 170 },
                  { id: 'c3', element: 'C', x: 340, y: 170 },
                  { id: 'c4', element: 'C', x: 240, y: 80 },
                ],
                bonds: [
                  { id: 'b1', from: 'c1', to: 'c2', order: 1 },
                  { id: 'b2', from: 'c2', to: 'c3', order: 1 },
                  { id: 'b3', from: 'c2', to: 'c4', order: 1 },
                ],
              }),
            },
            {
              label: 'Ion Amoni (NH₄⁺ Lewis)',
              fn: (): ChemStructureState => ({
                width: 480,
                height: 280,
                displayMode: 'lewis',
                atoms: [
                  { id: 'n1', element: 'N', x: 240, y: 140, charge: 1, lonePairs: 0 },
                  { id: 'h1', element: 'H', x: 240, y: 65 },
                  { id: 'h2', element: 'H', x: 240, y: 215 },
                  { id: 'h3', element: 'H', x: 165, y: 140 },
                  { id: 'h4', element: 'H', x: 315, y: 140 },
                ],
                bonds: [
                  { id: 'b1', from: 'n1', to: 'h1', order: 1 },
                  { id: 'b2', from: 'n1', to: 'h2', order: 1 },
                  { id: 'b3', from: 'n1', to: 'h3', order: 1 },
                  { id: 'b4', from: 'n1', to: 'h4', order: 1 },
                ],
              }),
            },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setState(preset.fn());
                setSelectedAtomId(null);
                setTitle(preset.label);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-[14px] font-medium border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {preset.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setState({ width: 480, height: 300, displayMode: 'condensed', atoms: [], bonds: [] });
              setSelectedAtomId(null);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[14px] font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 mt-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Xóa trống khung vẽ</span>
          </button>
        </aside>

        {/* CENTER INTERACTIVE CANVAS */}
        <div className="bg-slate-100/80 p-5 flex flex-col items-center justify-center overflow-auto gap-2">
          <div className="text-[13.5px] text-slate-600">
            Nhấp vào khoảng trống để đặt nguyên tử (tự nối với nguyên tử đang chọn). Nhấp giữa 2 nguyên tử để tạo/đổi bậc liên kết.
          </div>
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="relative bg-white rounded-xl border border-slate-300 shadow-sm cursor-crosshair select-none"
            style={{ width: state.width, height: state.height }}
          >
            <div dangerouslySetInnerHTML={{ __html: svgMarkup }} />
            <svg viewBox={`0 0 ${state.width} ${state.height}`} className="absolute inset-0 w-full h-full pointer-events-none">
              {selectedAtom && (
                <circle
                  cx={selectedAtom.x}
                  cy={selectedAtom.y}
                  r="18"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}
            </svg>
          </div>
        </div>

        {/* RIGHT INSPECTOR */}
        <aside className="bg-white border-l border-slate-200 overflow-y-auto p-3.5 space-y-3">
          <div className="space-y-2 pb-3 border-b border-slate-200">
            <label className="block text-[13.5px] font-semibold text-slate-700">Tên công thức</label>
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
              placeholder="VD: Công thức cấu tạo phân tử benzen"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[14.5px]"
            />
          </div>

          {selectedAtom ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-slate-800">Nguyên tử đang chọn ({selectedAtom.element})</span>
                <button
                  type="button"
                  onClick={deleteSelectedAtom}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[13px] rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">Ký hiệu nguyên tố</label>
                <input
                  type="text"
                  value={selectedAtom.element}
                  onChange={(e) => updateSelectedAtom({ element: e.target.value.trim() || 'C' })}
                  className="w-full px-2.5 py-1 border border-slate-300 rounded-lg text-[14.5px] font-bold"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">Nhóm chức tùy chỉnh (tùy chọn)</label>
                <input
                  type="text"
                  value={selectedAtom.labelOverride || ''}
                  onChange={(e) => updateSelectedAtom({ labelOverride: e.target.value || undefined })}
                  placeholder="VD: COOH, CHO, NO2, NH2"
                  className="w-full px-2.5 py-1 border border-slate-300 rounded-lg text-[14px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1">Điện tích ion</label>
                  <select
                    value={selectedAtom.charge ?? 0}
                    onChange={(e) => updateSelectedAtom({ charge: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px] bg-white"
                  >
                    <option value={0}>Trung hòa (0)</option>
                    <option value={1}>+1 (+)</option>
                    <option value={2}>+2 (2+)</option>
                    <option value={3}>+3 (3+)</option>
                    <option value={-1}>−1 (−)</option>
                    <option value={-2}>−2 (2−)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1">Cặp e⁻ tự do</label>
                  <select
                    value={selectedAtom.lonePairs ?? 0}
                    onChange={(e) => updateSelectedAtom({ lonePairs: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px] bg-white"
                  >
                    <option value={0}>0 cặp</option>
                    <option value={1}>1 cặp</option>
                    <option value={2}>2 cặp</option>
                    <option value={3}>3 cặp</option>
                    <option value={4}>4 cặp</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAtomId(null)}
                className="w-full py-1.5 text-[13.5px] rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Bỏ chọn (đặt cụm nguyên tử tách rời)
              </button>
            </div>
          ) : (
            <div className="text-[14px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Nhấp vào một nguyên tử trên hình để sửa ký hiệu, điện tích ion, nhóm chức hoặc cặp electron tự do (Lewis).
            </div>
          )}
        </aside>
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
              onSaveToLibrary({ name: title.trim() || 'Cấu tạo Hóa học', state });
              setStatusMsg('Đã lưu công thức cấu tạo vào Thư viện cá nhân.');
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
          <button type="button" onClick={handleCommit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
            <Check className="w-4 h-4" />
            <span>{isEditingExisting ? 'Cập nhật cấu tạo' : 'Chèn vào câu hỏi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check, Info, RotateCw, Upload, X } from 'lucide-react';
import { DEFAULT_FIGURE_CROP, FigureAlignment, FigureAsset, FigureCrop } from '../../engine/figureTypes';
import {
  isSupportedImageFile,
  readRasterImageFile,
  renderCroppedRasterPng,
} from '../../engine/svgSanitizer';

interface RasterImageEditorProps {
  figure: FigureAsset;
  onCommit: (updated: FigureAsset) => void;
  onCancel: () => void;
}

export const RasterImageEditor: React.FC<RasterImageEditorProps> = ({
  figure,
  onCommit,
  onCancel,
}) => {
  const [sourcePng, setSourcePng] = useState<string>(figure.pngDataUrl || '');
  const [title, setTitle] = useState(figure.title);
  const [caption, setCaption] = useState(figure.caption || '');
  const [showNumber, setShowNumber] = useState(figure.showNumber !== false);
  const [align, setAlign] = useState<FigureAlignment>(figure.align || 'center');
  const [widthPx, setWidthPx] = useState<number>(figure.widthPx || 380);
  const [rotationDeg, setRotationDeg] = useState<number>(figure.rotationDeg || 0);
  const [crop, setCrop] = useState<FigureCrop>(figure.crop || DEFAULT_FIGURE_CROP);
  const [previewUrl, setPreviewUrl] = useState<string>(figure.pngDataUrl || '');
  const [aspectRatio, setAspectRatio] = useState<number>(figure.aspectRatio || 0.7);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (!sourcePng) return;
    renderCroppedRasterPng(sourcePng, crop, rotationDeg)
      .then((res) => {
        if (!active) return;
        setPreviewUrl(res.dataUrl);
        if (res.width > 0 && res.height > 0) {
          setAspectRatio(res.height / res.width);
        }
      })
      .catch(() => {
        if (active) setPreviewUrl(sourcePng);
      });
    return () => {
      active = false;
    };
  }, [sourcePng, crop, rotationDeg]);

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = isSupportedImageFile(file);
    if (!check.ok || check.kind !== 'raster') {
      setErrorMsg('Vui lòng chọn tệp ảnh PNG, JPG hoặc WebP (tối đa 10 MB).');
      return;
    }
    try {
      const read = await readRasterImageFile(file);
      setSourcePng(read.dataUrl);
      setCrop(DEFAULT_FIGURE_CROP);
      setRotationDeg(0);
      setAspectRatio(read.height / Math.max(1, read.width));
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không đọc được tệp ảnh.');
    }
  };

  const handleApply = () => {
    onCommit({
      ...figure,
      title: title.trim() || 'Hình ảnh tải lên',
      caption: caption.trim(),
      showNumber,
      align,
      widthPx,
      aspectRatio,
      rotationDeg,
      crop,
      pngDataUrl: previewUrl || sourcePng,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-[15px]">
      <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 text-blue-900 flex items-center gap-2 text-[14.5px]">
        <Info className="w-4 h-4 text-blue-600 shrink-0" />
        <span>
          Ảnh tải lên ở định dạng <strong>Raster (PNG/JPG/WebP)</strong> — hỗ trợ thu phóng, cắt viền (crop), xoay, căn lề, chú thích và thay ảnh mới. Để chỉnh sửa từng đối tượng vector, hãy dùng trình Vẽ hình 2D/3D/Đồ thị/Hóa học.
        </span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] overflow-hidden">
        <div className="p-6 bg-slate-100/80 flex items-center justify-center overflow-auto">
          <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-4 max-w-full flex flex-col items-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={title}
                style={{ width: `${Math.min(540, widthPx)}px` }}
                className="max-w-full h-auto rounded border border-slate-200"
              />
            ) : (
              <div className="p-10 text-slate-400">Không có dữ liệu ảnh</div>
            )}
            {(showNumber || caption) && (
              <div className="mt-2 text-[14px] italic text-slate-600">
                {showNumber ? 'Hình minh họa. ' : ''}
                {caption}
              </div>
            )}
          </div>
        </div>

        <aside className="bg-white border-l border-slate-200 overflow-y-auto p-4 space-y-3.5">
          <div>
            <label className="block text-[13.5px] font-semibold text-slate-700 mb-1">Tên hình</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[14.5px]"
            />
          </div>

          <div>
            <label className="block text-[13.5px] font-semibold text-slate-700 mb-1">Chú thích dưới hình</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="VD: Ảnh minh họa thí nghiệm"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[14.5px]"
            />
            <label className="flex items-center gap-2 mt-2 text-[14px] cursor-pointer">
              <input type="checkbox" checked={showNumber} onChange={(e) => setShowNumber(e.target.checked)} />
              <span>Đánh số tự động (Hình 1, Hình 2...)</span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-[13.5px] font-semibold text-slate-700 mb-1">
              Chiều rộng hiển thị: {widthPx} px
            </label>
            <input
              type="range"
              min={140}
              max={560}
              step={10}
              value={widthPx}
              onChange={(e) => setWidthPx(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <div className="text-[13.5px] font-semibold text-slate-700 mb-1.5">Căn lề trong câu hỏi</div>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: 'left', label: 'Trái', icon: AlignLeft },
                { id: 'center', label: 'Giữa', icon: AlignCenter },
                { id: 'right', label: 'Phải', icon: AlignRight },
              ] as const).map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAlign(a.id)}
                    className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[14px] font-medium border ${
                      align === a.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13.5px] font-semibold text-slate-700">Xoay ảnh: {rotationDeg}°</span>
              <button
                type="button"
                onClick={() => setRotationDeg((r) => (r + 90) % 360)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13.5px] border border-slate-300 bg-white hover:bg-slate-50"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Xoay 90°</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-2">
            <div className="text-[13.5px] font-semibold text-slate-700">Cắt viền ảnh (Crop %)</div>
            {(
              [
                ['top', 'Cắt trên'],
                ['bottom', 'Cắt dưới'],
                ['left', 'Cắt trái'],
                ['right', 'Cắt phải'],
              ] as const
            ).map(([side, lbl]) => (
              <div key={side} className="flex items-center gap-2">
                <span className="text-[13.5px] text-slate-600 w-20">{lbl}</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={crop[side]}
                  onChange={(e) => setCrop((p) => ({ ...p, [side]: Number(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-[13px] text-slate-600 w-9 text-right">{crop[side]}%</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleReplaceFile} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[14.5px] font-medium border border-slate-300 bg-white hover:bg-slate-50"
            >
              <Upload className="w-4 h-4" />
              <span>Thay bằng ảnh khác từ máy</span>
            </button>
            {errorMsg && <div className="mt-1.5 text-[13.5px] text-red-600">{errorMsg}</div>}
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-white border-t border-slate-200">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[15px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
          <X className="w-4 h-4" />
          <span>Hủy</span>
        </button>
        <button type="button" onClick={handleApply} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm">
          <Check className="w-4 h-4" />
          <span>Cập nhật hình ảnh</span>
        </button>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  Circle,
  Copy,
  Download,
  Grid3X3,
  Group,
  Image as ImageIcon,
  Magnet,
  Minus,
  MousePointer2,
  MoveUpRight,
  Plus,
  Redo2,
  Save,
  Sigma,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Ungroup,
  X,
} from 'lucide-react';
import {
  ChemSymbolVariant,
  DiagramElement,
  DiagramElementType,
  DiagramScene,
  PhysicsSymbolVariant,
  StrokeStyle,
} from '../../engine/figureTypes';
import { createDefaultDiagramScene, renderDiagramSceneToSvg } from '../../engine/diagramRenderer';
import { svgMarkupToPngDataUrl } from '../../engine/svgSanitizer';
import { FormulaSubject } from '../../engine/types';

type DrawTool =
  | 'select'
  | 'point'
  | 'segment'
  | 'line'
  | 'ray'
  | 'vector'
  | 'rect'
  | 'polygon'
  | 'circle'
  | 'text'
  | 'formula';

interface VectorCanvasStudioProps {
  initialScene?: DiagramScene;
  initialSubject?: FormulaSubject;
  initialTitle?: string;
  initialCaption?: string;
  isEditingExisting?: boolean;
  onCommit: (payload: {
    scene: DiagramScene;
    svgMarkup: string;
    pngDataUrl: string;
    title: string;
    caption: string;
    subject: FormulaSubject;
  }) => void;
  onSaveToLibrary: (payload: {
    name: string;
    subject: FormulaSubject;
    topic: string;
    group: string;
    scene: DiagramScene;
  }) => void;
  onCancel: () => void;
}

const PHYSICS_PALETTE: Array<{ variant: PhysicsSymbolVariant; label: string; group: string }> = [
  { variant: 'resistor', label: 'Điện trở R', group: 'Điện học' },
  { variant: 'variable_resistor', label: 'Biến trở', group: 'Điện học' },
  { variant: 'battery', label: 'Nguồn điện', group: 'Điện học' },
  { variant: 'lamp', label: 'Bóng đèn', group: 'Điện học' },
  { variant: 'switch_open', label: 'Khóa K mở', group: 'Điện học' },
  { variant: 'switch_closed', label: 'Khóa K đóng', group: 'Điện học' },
  { variant: 'ammeter', label: 'Ampe kế (A)', group: 'Điện học' },
  { variant: 'voltmeter', label: 'Vôn kế (V)', group: 'Điện học' },
  { variant: 'capacitor', label: 'Tụ điện (C)', group: 'Điện học' },
  { variant: 'inductor', label: 'Cuộn cảm (L)', group: 'Điện học' },
  { variant: 'junction', label: 'Nút mạch', group: 'Điện học' },
  { variant: 'block', label: 'Vật nặng m', group: 'Cơ học' },
  { variant: 'inclined_plane', label: 'Mặt phẳng nghiêng', group: 'Cơ học' },
  { variant: 'spring', label: 'Lò xo', group: 'Cơ học' },
  { variant: 'pulley', label: 'Ròng rọc', group: 'Cơ học' },
  { variant: 'pendulum_bob', label: 'Con lắc đơn', group: 'Cơ học' },
  { variant: 'lever', label: 'Đòn bẩy', group: 'Cơ học' },
  { variant: 'convex_lens', label: 'Thấu kính hội tụ', group: 'Quang học' },
  { variant: 'concave_lens', label: 'Thấu kính phân kì', group: 'Quang học' },
  { variant: 'flat_mirror', label: 'Gương phẳng', group: 'Quang học' },
  { variant: 'magnet', label: 'Nam châm N–S', group: 'Từ & Nhiệt' },
  { variant: 'piston_cylinder', label: 'Xilanh – Pít-tông', group: 'Từ & Nhiệt' },
];

const CHEM_PALETTE: Array<{ variant: ChemSymbolVariant; label: string }> = [
  { variant: 'test_tube', label: 'Ống nghiệm' },
  { variant: 'test_tube_rack', label: 'Giá ống nghiệm' },
  { variant: 'test_tube_clamp', label: 'Kẹp ống nghiệm' },
  { variant: 'beaker', label: 'Cốc thủy tinh' },
  { variant: 'erlenmeyer', label: 'Bình tam giác' },
  { variant: 'round_flask', label: 'Bình cầu' },
  { variant: 'volumetric_flask', label: 'Bình định mức' },
  { variant: 'graduated_cylinder', label: 'Ống đong' },
  { variant: 'pipette', label: 'Pipet' },
  { variant: 'burette', label: 'Buret' },
  { variant: 'funnel', label: 'Phễu lọc' },
  { variant: 'separatory_funnel', label: 'Phễu chiết' },
  { variant: 'alcohol_lamp', label: 'Đèn cồn' },
  { variant: 'retort_stand', label: 'Giá đỡ thí nghiệm' },
  { variant: 'delivery_tube', label: 'Ống dẫn khí' },
  { variant: 'water_trough', label: 'Chậu nước' },
  { variant: 'thermometer', label: 'Nhiệt kế' },
  { variant: 'condenser', label: 'Ống sinh hàn' },
];

const STROKE_COLORS = ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c', '#0f766e', '#64748b'];
const FILL_COLORS = ['none', '#ffffff', '#f8fafc', '#dbeafe', '#fee2e2', '#dcfce7', '#fef3c7', '#e2e8f0'];

function nextElId(): string {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function getElementBounds(el: DiagramElement): { minX: number; minY: number; maxX: number; maxY: number } {
  if (el.type === 'segment' || el.type === 'line' || el.type === 'ray' || el.type === 'vector') {
    const x2 = el.x2 ?? el.x + 100;
    const y2 = el.y2 ?? el.y;
    return { minX: Math.min(el.x, x2), minY: Math.min(el.y, y2), maxX: Math.max(el.x, x2), maxY: Math.max(el.y, y2) };
  }
  if (el.type === 'rect') {
    const w = el.width ?? 120;
    const h = el.height ?? 76;
    return { minX: el.x, minY: el.y, maxX: el.x + w, maxY: el.y + h };
  }
  if (el.type === 'circle' || el.type === 'arc' || el.type === 'angle_mark') {
    const r = el.radius ?? 50;
    return { minX: el.x - r, minY: el.y - r, maxX: el.x + r, maxY: el.y + r };
  }
  if (el.type === 'polygon' && el.points?.length) {
    const xs = el.points.map((p) => el.x + p.x);
    const ys = el.points.map((p) => el.y + p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }
  const hw = (el.width ?? 70) / 2;
  const hh = (el.height ?? 50) / 2;
  return { minX: el.x - hw, minY: el.y - hh, maxX: el.x + hw, maxY: el.y + hh };
}

export const VectorCanvasStudio: React.FC<VectorCanvasStudioProps> = ({
  initialScene,
  initialSubject = 'math',
  initialTitle = 'Hình vẽ 2D',
  initialCaption = '',
  isEditingExisting = false,
  onCommit,
  onSaveToLibrary,
  onCancel,
}) => {
  const [scene, setScene] = useState<DiagramScene>(() =>
    initialScene ? structuredClone(initialScene) : createDefaultDiagramScene()
  );
  const [history, setHistory] = useState<DiagramScene[]>([]);
  const [redoStack, setRedoStack] = useState<DiagramScene[]>([]);
  const [tool, setTool] = useState<DrawTool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paletteTab, setPaletteTab] = useState<FormulaSubject>(initialSubject);
  const [zoom, setZoom] = useState<number>(1);
  const [title, setTitle] = useState(initialTitle);
  const [caption, setCaption] = useState(initialCaption);
  const [subject, setSubject] = useState<FormulaSubject>(initialSubject);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const svgHostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: 'move' | 'draw' | 'endpoint2';
    startX: number;
    startY: number;
    targetId?: string;
    snapshot: DiagramScene;
  } | null>(null);

  const pushHistory = useCallback((prev: DiagramScene) => {
    setHistory((h) => [...h.slice(-39), structuredClone(prev)]);
    setRedoStack([]);
  }, []);

  const updateScene = useCallback(
    (updater: (prev: DiagramScene) => DiagramScene, recordHistory = true) => {
      setScene((prev) => {
        if (recordHistory) pushHistory(prev);
        return updater(prev);
      });
    },
    [pushHistory]
  );

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setRedoStack((r) => [...r, structuredClone(scene)]);
      setScene(previous);
      return h.slice(0, -1);
    });
  }, [scene]);

  const handleRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setHistory((h) => [...h, structuredClone(scene)]);
      setScene(next);
      return r.slice(0, -1);
    });
  }, [scene]);

  const snapCoord = useCallback(
    (x: number, y: number, excludeIds: string[] = []): { x: number; y: number } => {
      let rx = x;
      let ry = y;

      // 1. Snap to nearby existing points/endpoints first
      if (scene.snapToPoint) {
        const threshold = 11;
        for (const el of scene.elements) {
          if (excludeIds.includes(el.id)) continue;
          const candidates = [{ x: el.x, y: el.y }];
          if (el.x2 !== undefined && el.y2 !== undefined) {
            candidates.push({ x: el.x2, y: el.y2 });
          }
          for (const c of candidates) {
            if (Math.hypot(rx - c.x, ry - c.y) <= threshold) {
              return { x: c.x, y: c.y };
            }
          }
        }
      }

      // 2. Snap to horizontal/vertical alignment lines of existing elements
      if (scene.snapToLine) {
        const lineTol = 6;
        for (const el of scene.elements) {
          if (excludeIds.includes(el.id)) continue;
          if (Math.abs(rx - el.x) <= lineTol) rx = el.x;
          if (Math.abs(ry - el.y) <= lineTol) ry = el.y;
        }
      }

      // 3. Snap to grid
      if (scene.snapToGrid) {
        const g = Math.max(8, scene.gridSize || 20);
        rx = Math.round(rx / g) * g;
        ry = Math.round(ry / g) * g;
      }

      return { x: Math.round(rx), y: Math.round(ry) };
    },
    [scene]
  );

  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svgEl = svgHostRef.current?.querySelector('svg');
      if (!svgEl) return { x: 0, y: 0 };
      const rect = svgEl.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * scene.width;
      const y = ((clientY - rect.top) / rect.height) * scene.height;
      return { x, y };
    },
    [scene.width, scene.height]
  );

  const addElementAtCenter = useCallback(
    (partial: Partial<DiagramElement> & { type: DiagramElementType }) => {
      const id = nextElId();
      const offset = (scene.elements.length % 5) * 18 - 36;
      const cx = Math.round(scene.width / 2 + offset);
      const cy = Math.round(scene.height / 2 + offset);
      const maxZ = scene.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0);
      const created: DiagramElement = {
        id,
        type: partial.type,
        x: partial.x ?? cx,
        y: partial.y ?? cy,
        x2: partial.x2,
        y2: partial.y2,
        width: partial.width,
        height: partial.height,
        radius: partial.radius,
        points: partial.points,
        rotation: partial.rotation ?? 0,
        stroke: partial.stroke ?? '#0f172a',
        fill: partial.fill ?? 'none',
        strokeWidth: partial.strokeWidth ?? 2,
        strokeStyle: partial.strokeStyle ?? 'solid',
        label: partial.label,
        labelOffsetX: partial.labelOffsetX,
        labelOffsetY: partial.labelOffsetY,
        fontSize: partial.fontSize,
        formulaLatex: partial.formulaLatex,
        tickCount: partial.tickCount,
        symbolVariant: partial.symbolVariant,
        zIndex: maxZ + 1,
      };
      updateScene((prev) => ({ ...prev, elements: [...prev.elements, created] }));
      setSelectedIds([id]);
      setTool('select');
    },
    [scene.elements, scene.width, scene.height, updateScene]
  );

  const selectedElements = useMemo(
    () => scene.elements.filter((e) => selectedIds.includes(e.id)),
    [scene.elements, selectedIds]
  );
  const primarySelected = selectedElements.length === 1 ? selectedElements[0] : null;

  const updateSelectedElements = useCallback(
    (patch: Partial<DiagramElement>) => {
      if (selectedIds.length === 0) return;
      updateScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => (selectedIds.includes(el.id) ? { ...el, ...patch } : el)),
      }));
    },
    [selectedIds, updateScene]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    updateScene((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => !selectedIds.includes(el.id)),
    }));
    setSelectedIds([]);
  }, [selectedIds, updateScene]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const newIds: string[] = [];
    updateScene((prev) => {
      const maxZ = prev.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0);
      const clones = prev.elements
        .filter((el) => selectedIds.includes(el.id))
        .map((el, i) => {
          const cid = nextElId();
          newIds.push(cid);
          return {
            ...structuredClone(el),
            id: cid,
            x: el.x + 24,
            y: el.y + 24,
            x2: el.x2 !== undefined ? el.x2 + 24 : undefined,
            y2: el.y2 !== undefined ? el.y2 + 24 : undefined,
            zIndex: maxZ + i + 1,
          };
        });
      return { ...prev, elements: [...prev.elements, ...clones] };
    });
    setSelectedIds(newIds);
  }, [selectedIds, updateScene]);

  const handleGroupToggle = (group: boolean) => {
    if (selectedIds.length < 2 && group) return;
    const gid = group ? `grp_${Date.now().toString(36)}` : undefined;
    updateSelectedElements({ groupId: gid });
  };

  const handleReorderZ = (direction: 'front' | 'back') => {
    if (selectedIds.length === 0) return;
    updateScene((prev) => {
      const maxZ = prev.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const minZ = prev.elements.reduce((m, e) => Math.min(m, e.zIndex), 0);
      return {
        ...prev,
        elements: prev.elements.map((el) =>
          selectedIds.includes(el.id) ? { ...el, zIndex: direction === 'front' ? maxZ + 1 : minZ - 1 } : el
        ),
      };
    });
  };

  const handleAlign = (mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
    if (selectedIds.length < 2) return;
    const boundsList = selectedElements.map((el) => ({ el, b: getElementBounds(el) }));
    const minX = Math.min(...boundsList.map((x) => x.b.minX));
    const maxX = Math.max(...boundsList.map((x) => x.b.maxX));
    const minY = Math.min(...boundsList.map((x) => x.b.minY));
    const maxY = Math.max(...boundsList.map((x) => x.b.maxY));
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    updateScene((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        const found = boundsList.find((item) => item.el.id === el.id);
        if (!found) return el;
        const b = found.b;
        let dx = 0;
        let dy = 0;
        if (mode === 'left') dx = minX - b.minX;
        else if (mode === 'right') dx = maxX - b.maxX;
        else if (mode === 'centerX') dx = midX - (b.minX + b.maxX) / 2;
        else if (mode === 'top') dy = minY - b.minY;
        else if (mode === 'bottom') dy = maxY - b.maxY;
        else if (mode === 'centerY') dy = midY - (b.minY + b.maxY) / 2;
        return {
          ...el,
          x: Math.round(el.x + dx),
          y: Math.round(el.y + dy),
          x2: el.x2 !== undefined ? Math.round(el.x2 + dx) : undefined,
          y2: el.y2 !== undefined ? Math.round(el.y2 + dy) : undefined,
        };
      }),
    }));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleDeleteSelected, handleDuplicateSelected, selectedIds]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rawPt = clientToCanvas(e.clientX, e.clientY);
    const pt = snapCoord(rawPt.x, rawPt.y);

    // Check if user grabbed endpoint2 handle of a selected line/vector
    const handleAttr = (e.target as HTMLElement | null)?.closest?.('[data-handle]')?.getAttribute('data-handle');
    if (handleAttr === 'p2' && primarySelected) {
      dragRef.current = {
        mode: 'endpoint2',
        startX: pt.x,
        startY: pt.y,
        targetId: primarySelected.id,
        snapshot: structuredClone(scene),
      };
      pushHistory(scene);
      return;
    }

    if (tool === 'select') {
      const groupEl = (e.target as HTMLElement | null)?.closest?.('[data-element-id]');
      const clickedId = groupEl?.getAttribute('data-element-id');
      if (clickedId) {
        const clickedObj = scene.elements.find((el) => el.id === clickedId);
        const groupMembers = clickedObj?.groupId
          ? scene.elements.filter((el) => el.groupId === clickedObj.groupId).map((el) => el.id)
          : [clickedId];

        let nextSelected: string[];
        if (e.shiftKey) {
          const exists = selectedIds.includes(clickedId);
          nextSelected = exists
            ? selectedIds.filter((id) => !groupMembers.includes(id))
            : Array.from(new Set([...selectedIds, ...groupMembers]));
        } else {
          nextSelected = selectedIds.includes(clickedId) ? selectedIds : groupMembers;
        }
        setSelectedIds(nextSelected);
        dragRef.current = {
          mode: 'move',
          startX: rawPt.x,
          startY: rawPt.y,
          snapshot: structuredClone(scene),
        };
        pushHistory(scene);
      } else {
        setSelectedIds([]);
      }
      return;
    }

    // Creating a new primitive
    const id = nextElId();
    const maxZ = scene.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    let created: DiagramElement;

    if (tool === 'point') {
      created = { id, type: 'point', x: pt.x, y: pt.y, radius: 4, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'A', labelOffsetY: -14, zIndex: maxZ + 1 };
    } else if (tool === 'text') {
      created = { id, type: 'text', x: pt.x, y: pt.y, stroke: '#0f172a', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', label: 'Nhãn chữ', fontSize: 16, zIndex: maxZ + 1 };
    } else if (tool === 'formula') {
      created = { id, type: 'formula', x: pt.x, y: pt.y, stroke: '#0f172a', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{F} = m\\vec{a}', fontSize: 17, zIndex: maxZ + 1 };
    } else if (tool === 'polygon') {
      created = {
        id,
        type: 'polygon',
        x: pt.x,
        y: pt.y,
        points: [{ x: 0, y: -55 }, { x: -65, y: 45 }, { x: 65, y: 45 }],
        stroke: '#0f172a',
        fill: '#f8fafc',
        strokeWidth: 2,
        strokeStyle: 'solid',
        zIndex: maxZ + 1,
      };
    } else if (tool === 'circle') {
      created = { id, type: 'circle', x: pt.x, y: pt.y, radius: 45, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: maxZ + 1 };
    } else if (tool === 'rect') {
      created = { id, type: 'rect', x: pt.x, y: pt.y, width: 100, height: 60, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', zIndex: maxZ + 1 };
    } else {
      created = {
        id,
        type: tool,
        x: pt.x,
        y: pt.y,
        x2: pt.x + 80,
        y2: pt.y,
        stroke: '#0f172a',
        fill: 'none',
        strokeWidth: 2.2,
        strokeStyle: 'solid',
        zIndex: maxZ + 1,
      };
    }

    pushHistory(scene);
    const nextScene = { ...scene, elements: [...scene.elements, created] };
    setScene(nextScene);
    setSelectedIds([id]);

    if (tool === 'segment' || tool === 'line' || tool === 'ray' || tool === 'vector' || tool === 'circle' || tool === 'rect') {
      dragRef.current = {
        mode: 'draw',
        startX: pt.x,
        startY: pt.y,
        targetId: id,
        snapshot: nextScene,
      };
    } else {
      setTool('select');
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rawPt = clientToCanvas(e.clientX, e.clientY);

    if (drag.mode === 'move') {
      const rawDx = rawPt.x - drag.startX;
      const rawDy = rawPt.y - drag.startY;
      const g = scene.snapToGrid ? Math.max(8, scene.gridSize || 20) : 1;
      const dx = Math.round(rawDx / g) * g;
      const dy = Math.round(rawDy / g) * g;
      setScene({
        ...drag.snapshot,
        elements: drag.snapshot.elements.map((el) =>
          selectedIds.includes(el.id)
            ? {
                ...el,
                x: el.x + dx,
                y: el.y + dy,
                x2: el.x2 !== undefined ? el.x2 + dx : undefined,
                y2: el.y2 !== undefined ? el.y2 + dy : undefined,
              }
            : el
        ),
      });
    } else if ((drag.mode === 'draw' || drag.mode === 'endpoint2') && drag.targetId) {
      const snapped = snapCoord(rawPt.x, rawPt.y, [drag.targetId]);
      setScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => {
          if (el.id !== drag.targetId) return el;
          if (el.type === 'circle') {
            return { ...el, radius: Math.max(12, Math.round(Math.hypot(snapped.x - el.x, snapped.y - el.y))) };
          }
          if (el.type === 'rect') {
            return {
              ...el,
              x: Math.min(drag.startX, snapped.x),
              y: Math.min(drag.startY, snapped.y),
              width: Math.max(20, Math.abs(snapped.x - drag.startX)),
              height: Math.max(20, Math.abs(snapped.y - drag.startY)),
            };
          }
          return { ...el, x2: snapped.x, y2: snapped.y };
        }),
      }));
    }
  };

  const handleCanvasPointerUp = () => {
    if (dragRef.current?.mode === 'draw') {
      setTool('select');
    }
    dragRef.current = null;
  };

  const svgMarkupWithGrid = useMemo(
    () => renderDiagramSceneToSvg(scene, { includeGrid: scene.showGrid }),
    [scene]
  );
  const cleanSvgMarkup = useMemo(
    () => renderDiagramSceneToSvg(scene, { includeGrid: false }),
    [scene]
  );

  const handleExportSvg = () => {
    const blob = new Blob([cleanSvgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'hinh-ve-2d').replace(/\s+/g, '-')}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMsg('Đã xuất tệp SVG sắc nét.');
  };

  const handleExportPng = async () => {
    setIsExporting(true);
    try {
      const png = await svgMarkupToPngDataUrl(cleanSvgMarkup, 2);
      if (!png) return;
      const a = document.createElement('a');
      a.href = png;
      a.download = `${(title || 'hinh-ve-2d').replace(/\s+/g, '-')}.png`;
      a.click();
      setStatusMsg('Đã xuất tệp PNG độ phân giải cao (2x).');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCommit = async () => {
    setIsExporting(true);
    try {
      const pngDataUrl = (await svgMarkupToPngDataUrl(cleanSvgMarkup, 2)) || '';
      onCommit({
        scene: { ...scene, showGrid: false },
        svgMarkup: cleanSvgMarkup,
        pngDataUrl,
        title: title.trim() || 'Hình vẽ minh họa',
        caption: caption.trim(),
        subject,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveTemplate = () => {
    onSaveToLibrary({
      name: title.trim() || 'Hình cá nhân',
      subject,
      topic: subject === 'physics' ? 'Vật lí' : subject === 'chemistry' ? 'Hóa học' : 'Toán học',
      group: 'Hình cá nhân',
      scene: { ...scene, showGrid: false },
    });
    setStatusMsg('Đã lưu mẫu hình vào Thư viện cá nhân (lưu offline trong trình duyệt).');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-[15px]">
      {/* 1. TOP TOOLBAR */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-200">
        {(
          [
            { id: 'select', label: 'Chọn', icon: MousePointer2, tip: 'Chọn & di chuyển (giữ Shift để chọn nhiều)' },
            { id: 'point', label: 'Điểm', icon: Circle, tip: 'Chấm điểm có nhãn' },
            { id: 'segment', label: 'Đoạn', icon: Minus, tip: 'Vẽ đoạn thẳng / dây nối' },
            { id: 'ray', label: 'Tia', icon: MoveUpRight, tip: 'Vẽ tia sáng / tia hình học' },
            { id: 'vector', label: 'Vectơ', icon: MoveUpRight, tip: 'Vẽ vectơ lực / vectơ toán học' },
            { id: 'rect', label: 'Chữ nhật', icon: Square, tip: 'Vẽ hình chữ nhật' },
            { id: 'polygon', label: 'Tam giác', icon: Triangle, tip: 'Vẽ tam giác' },
            { id: 'circle', label: 'Tròn', icon: Circle, tip: 'Vẽ đường tròn' },
            { id: 'text', label: 'Chữ', icon: Type, tip: 'Chèn nhãn văn bản' },
            { id: 'formula', label: 'Công thức', icon: Sigma, tip: 'Chèn công thức LaTeX vào hình' },
          ] as Array<{ id: DrawTool; label: string; icon: React.ComponentType<{ className?: string }>; tip: string }>
        ).map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              title={t.tip}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[14px] font-medium border transition-colors ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => updateScene((p) => ({ ...p, showGrid: !p.showGrid }), false)}
          title="Bật/tắt lưới nền"
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[14px] border ${
            scene.showGrid ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
          <span>Lưới</span>
        </button>

        <button
          type="button"
          onClick={() => updateScene((p) => ({ ...p, snapToGrid: !p.snapToGrid, snapToPoint: !p.snapToPoint }), false)}
          title="Bắt điểm lưới và đỉnh"
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[14px] border ${
            scene.snapToGrid ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Magnet className="w-4 h-4" />
          <span>Bắt điểm</span>
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button type="button" onClick={handleUndo} disabled={history.length === 0} title="Hoàn tác (Ctrl+Z)" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <Undo2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleRedo} disabled={redoStack.length === 0} title="Làm lại (Ctrl+Y)" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <Redo2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleDuplicateSelected} disabled={selectedIds.length === 0} title="Nhân bản đối tượng (Ctrl+D)" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <Copy className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleDeleteSelected} disabled={selectedIds.length === 0} title="Xóa đối tượng (Delete)" className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40">
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button type="button" onClick={() => handleGroupToggle(true)} disabled={selectedIds.length < 2} title="Nhóm các đối tượng đã chọn" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <Group className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => handleGroupToggle(false)} disabled={selectedIds.length === 0} title="Tách nhóm" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <Ungroup className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => handleReorderZ('front')} disabled={selectedIds.length === 0} title="Đưa lên lớp trên cùng" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <ArrowUpToLine className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => handleReorderZ('back')} disabled={selectedIds.length === 0} title="Đưa xuống lớp dưới cùng" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <ArrowDownToLine className="w-4 h-4" />
        </button>

        {selectedIds.length >= 2 && (
          <div className="inline-flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
            <button type="button" onClick={() => handleAlign('left')} title="Căn trái" className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"><AlignStartVertical className="w-4 h-4" /></button>
            <button type="button" onClick={() => handleAlign('centerX')} title="Căn giữa ngang" className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"><AlignCenterVertical className="w-4 h-4" /></button>
            <button type="button" onClick={() => handleAlign('right')} title="Căn phải" className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"><AlignEndVertical className="w-4 h-4" /></button>
            <button type="button" onClick={() => handleAlign('top')} title="Căn trên" className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"><AlignStartHorizontal className="w-4 h-4" /></button>
            <button type="button" onClick={() => handleAlign('centerY')} title="Căn giữa dọc" className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"><AlignCenterHorizontal className="w-4 h-4" /></button>
            <button type="button" onClick={() => handleAlign('bottom')} title="Căn dưới" className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"><AlignEndHorizontal className="w-4 h-4" /></button>
          </div>
        )}

        <div className="ml-auto inline-flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))} title="Thu nhỏ" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100">
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-[14px] font-semibold text-slate-700 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))} title="Phóng to" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2-4. MAIN 3-COLUMN WORKSPACE */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[248px_1fr_270px] overflow-hidden">
        {/* LEFT PALETTE */}
        <aside className="bg-white border-r border-slate-200 flex flex-col min-h-0 overflow-hidden">
          <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
            {([
              { id: 'math', label: 'Toán' },
              { id: 'physics', label: 'Vật lí' },
              { id: 'chemistry', label: 'Hóa học' },
            ] as Array<{ id: FormulaSubject; label: string }>).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPaletteTab(tab.id)}
                className={`py-2 text-[14px] font-semibold border-b-2 transition-colors ${
                  paletteTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {paletteTab === 'math' && (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Tam giác cân', act: () => addElementAtCenter({ type: 'polygon', points: [{ x: 0, y: -60 }, { x: -65, y: 50 }, { x: 65, y: 50 }], fill: '#f8fafc' }) },
                  { label: 'Tam giác vuông', act: () => addElementAtCenter({ type: 'polygon', points: [{ x: -65, y: -60 }, { x: -65, y: 50 }, { x: 75, y: 50 }], fill: '#f8fafc' }) },
                  { label: 'Hình bình hành', act: () => addElementAtCenter({ type: 'polygon', points: [{ x: -45, y: -40 }, { x: 75, y: -40 }, { x: 45, y: 40 }, { x: -75, y: 40 }], fill: '#f8fafc' }) },
                  { label: 'Hình thoi', act: () => addElementAtCenter({ type: 'polygon', points: [{ x: 0, y: -55 }, { x: 75, y: 0 }, { x: 0, y: 55 }, { x: -75, y: 0 }], fill: '#f8fafc' }) },
                  { label: 'Hình thang', act: () => addElementAtCenter({ type: 'polygon', points: [{ x: -42, y: -45 }, { x: 42, y: -45 }, { x: 80, y: 45 }, { x: -80, y: 45 }], fill: '#f8fafc' }) },
                  { label: 'Đường tròn', act: () => addElementAtCenter({ type: 'circle', radius: 60, fill: 'none' }) },
                  { label: 'Elip', act: () => addElementAtCenter({ type: 'ellipse', width: 140, height: 80, fill: 'none' }) },
                  { label: 'Cung tròn', act: () => addElementAtCenter({ type: 'arc', radius: 55, startAngleDeg: 0, endAngleDeg: 110 }) },
                  { label: 'Ký hiệu góc vuông', act: () => addElementAtCenter({ type: 'right_angle', radius: 15 }) },
                  { label: 'Ký hiệu góc', act: () => addElementAtCenter({ type: 'angle_mark', radius: 26, startAngleDeg: 0, endAngleDeg: 55, stroke: '#dc2626' }) },
                  { label: 'Vạch bằng nhau', act: () => addElementAtCenter({ type: 'tick_mark', tickCount: 2 }) },
                  { label: 'Vectơ', act: () => addElementAtCenter({ type: 'vector', x: 220, y: 210, x2: 360, y2: 150, stroke: '#2563eb' }) },
                  { label: 'Đoạn nét đứt', act: () => addElementAtCenter({ type: 'segment', x: 200, y: 210, x2: 380, y2: 210, strokeStyle: 'dashed' }) },
                  { label: 'Nhãn công thức', act: () => addElementAtCenter({ type: 'formula', formulaLatex: '\\widehat{ABC} = 90^\\circ' }) },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.act}
                    className="px-2 py-2 text-left text-[13.5px] font-medium text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-lg transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {paletteTab === 'physics' && (
              <div className="grid grid-cols-2 gap-1.5">
                {PHYSICS_PALETTE.map((sym) => (
                  <button
                    key={sym.variant}
                    type="button"
                    onClick={() =>
                      addElementAtCenter({
                        type: 'symbol_physics',
                        symbolVariant: sym.variant,
                        width: sym.variant === 'inclined_plane' ? 220 : sym.variant === 'convex_lens' || sym.variant === 'concave_lens' ? 30 : 90,
                        height: sym.variant === 'inclined_plane' ? 115 : sym.variant === 'convex_lens' || sym.variant === 'concave_lens' || sym.variant === 'flat_mirror' ? 140 : 48,
                        fill: '#ffffff',
                      })
                    }
                    className="px-2 py-2 text-left text-[13.5px] font-medium text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-lg transition-colors"
                  >
                    {sym.label}
                  </button>
                ))}
              </div>
            )}

            {paletteTab === 'chemistry' && (
              <div className="grid grid-cols-2 gap-1.5">
                {CHEM_PALETTE.map((sym) => (
                  <button
                    key={sym.variant}
                    type="button"
                    onClick={() =>
                      addElementAtCenter({
                        type: 'symbol_chem',
                        symbolVariant: sym.variant,
                        width: sym.variant === 'water_trough' || sym.variant === 'condenser' ? 140 : 70,
                        height: sym.variant === 'retort_stand' ? 180 : sym.variant === 'condenser' ? 48 : 96,
                        fill: '#e0f2fe',
                      })
                    }
                    className="px-2 py-2 text-left text-[13.5px] font-medium text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-lg transition-colors"
                  >
                    {sym.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER INTERACTIVE CANVAS */}
        <div className="relative overflow-auto bg-slate-100/80 flex items-center justify-center p-4">
          <div
            ref={svgHostRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            style={{
              width: `${Math.round(scene.width * zoom)}px`,
              height: `${Math.round(scene.height * zoom)}px`,
            }}
            className="relative bg-white rounded-xl shadow-md border border-slate-300 select-none touch-none cursor-crosshair shrink-0"
          >
            {/* Rendered clean SVG */}
            <div
              className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: svgMarkupWithGrid }}
            />

            {/* Interactive selection bounding box & endpoint handle overlay */}
            <svg
              viewBox={`0 0 ${scene.width} ${scene.height}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {selectedElements.map((el) => {
                const b = getElementBounds(el);
                return (
                  <g key={el.id}>
                    <rect
                      x={b.minX - 6}
                      y={b.minY - 6}
                      width={Math.max(12, b.maxX - b.minX + 12)}
                      height={Math.max(12, b.maxY - b.minY + 12)}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    {el.x2 !== undefined && el.y2 !== undefined && selectedElements.length === 1 && (
                      <circle
                        data-handle="p2"
                        cx={el.x2}
                        cy={el.y2}
                        r="7"
                        fill="#2563eb"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="pointer-events-auto cursor-move"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* RIGHT PROPERTIES PANEL */}
        <aside className="bg-white border-l border-slate-200 overflow-y-auto p-3 space-y-3">
          <div className="space-y-2 pb-3 border-b border-slate-200">
            <label className="block text-[13.5px] font-semibold text-slate-700">Tên hình minh họa</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[14.5px] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ví dụ: Mạch điện nối tiếp"
            />
            <label className="block text-[13.5px] font-semibold text-slate-700">Chú thích dưới hình</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[14.5px] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tùy chọn (VD: Sơ đồ mạch điện)"
            />
            <label className="block text-[13.5px] font-semibold text-slate-700">Môn học</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as FormulaSubject)}
              className="w-full px-2.5 py-1.5 text-[14.5px] border border-slate-300 rounded-lg bg-white"
            >
              <option value="math">Toán học</option>
              <option value="physics">Vật lí</option>
              <option value="chemistry">Hóa học</option>
            </select>
          </div>

          {selectedElements.length === 0 ? (
            <div className="text-[14px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
              Nhấn vào đối tượng trên vùng vẽ để chỉnh sửa màu sắc, nét vẽ, góc xoay, nhãn hoặc công thức LaTeX. Giữ <strong>Shift</strong> để chọn nhiều đối tượng và căn thẳng hàng.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[14px] font-bold text-slate-800">
                Thuộc tính ({selectedElements.length} đối tượng)
              </div>

              {/* Stroke color */}
              <div>
                <div className="text-[13.5px] font-medium text-slate-700 mb-1">Màu nét vẽ</div>
                <div className="flex flex-wrap gap-1.5">
                  {STROKE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSelectedElements({ stroke: c })}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border-2 ${
                        primarySelected?.stroke === c ? 'border-blue-500 scale-110' : 'border-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Fill color */}
              <div>
                <div className="text-[13.5px] font-medium text-slate-700 mb-1">Màu nền / tô</div>
                <div className="flex flex-wrap gap-1.5">
                  {FILL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSelectedElements({ fill: c })}
                      style={{ backgroundColor: c === 'none' ? '#ffffff' : c }}
                      title={c === 'none' ? 'Trong suốt' : c}
                      className={`w-6 h-6 rounded border-2 text-[10px] font-bold text-red-600 ${
                        primarySelected?.fill === c ? 'border-blue-600' : 'border-slate-300'
                      }`}
                    >
                      {c === 'none' ? '×' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stroke width & style */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1">Độ dày nét</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    step={0.5}
                    value={primarySelected?.strokeWidth ?? 2}
                    onChange={(e) => updateSelectedElements({ strokeWidth: Number(e.target.value) || 2 })}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1">Kiểu nét</label>
                  <select
                    value={primarySelected?.strokeStyle ?? 'solid'}
                    onChange={(e) => updateSelectedElements({ strokeStyle: e.target.value as StrokeStyle })}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px] bg-white"
                  >
                    <option value="solid">Nét liền</option>
                    <option value="dashed">Nét đứt</option>
                    <option value="dotted">Nét chấm</option>
                  </select>
                </div>
              </div>

              {/* Rotation & Size */}
              {primarySelected && (
                <>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 mb-1">
                      Góc xoay: {primarySelected.rotation ?? 0}°
                    </label>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={5}
                      value={primarySelected.rotation ?? 0}
                      onChange={(e) => updateSelectedElements({ rotation: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  {primarySelected.type === 'formula' ? (
                    <div>
                      <label className="block text-[13.5px] font-medium text-slate-700 mb-1">Công thức LaTeX</label>
                      <input
                        type="text"
                        value={primarySelected.formulaLatex || ''}
                        onChange={(e) => updateSelectedElements({ formulaLatex: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-[14px]"
                        placeholder="\vec{F} = m\vec{a}"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[13.5px] font-medium text-slate-700 mb-1">Nhãn đối tượng</label>
                      <input
                        type="text"
                        value={primarySelected.label || ''}
                        onChange={(e) => updateSelectedElements({ label: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[14.5px]"
                        placeholder="VD: A, R1, F, 5 cm..."
                      />
                    </div>
                  )}

                  {(primarySelected.type === 'segment' || primarySelected.type === 'angle_mark' || primarySelected.type === 'tick_mark') && (
                    <div>
                      <label className="block text-[13px] font-medium text-slate-700 mb-1">Số vạch ký hiệu bằng nhau</label>
                      <select
                        value={primarySelected.tickCount ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          updateSelectedElements({ tickCount: v ? (v as 1 | 2 | 3) : undefined });
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px] bg-white"
                      >
                        <option value={0}>Không có</option>
                        <option value={1}>1 vạch</option>
                        <option value={2}>2 vạch</option>
                        <option value={3}>3 vạch</option>
                      </select>
                    </div>
                  )}

                  {(primarySelected.width !== undefined || primarySelected.radius !== undefined) && (
                    <div className="grid grid-cols-2 gap-2">
                      {primarySelected.radius !== undefined ? (
                        <div className="col-span-2">
                          <label className="block text-[13px] font-medium text-slate-700 mb-1">Bán kính (px)</label>
                          <input
                            type="number"
                            min={6}
                            max={260}
                            value={primarySelected.radius}
                            onChange={(e) => updateSelectedElements({ radius: Number(e.target.value) || 30 })}
                            className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px]"
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[13px] font-medium text-slate-700 mb-1">Rộng (px)</label>
                            <input
                              type="number"
                              min={20}
                              max={420}
                              value={primarySelected.width ?? 80}
                              onChange={(e) => updateSelectedElements({ width: Number(e.target.value) || 80 })}
                              className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[13px] font-medium text-slate-700 mb-1">Cao (px)</label>
                            <input
                              type="number"
                              min={20}
                              max={360}
                              value={primarySelected.height ?? 50}
                              onChange={(e) => updateSelectedElements({ height: Number(e.target.value) || 50 })}
                              className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[14px]"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* 5. BOTTOM ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportSvg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            <span>Xuất SVG</span>
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Xuất PNG</span>
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          >
            <Save className="w-4 h-4" />
            <span>Lưu vào thư viện</span>
          </button>
          {statusMsg && <span className="text-[14px] text-emerald-700 font-medium">{statusMsg}</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[15px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
            <span>Hủy</span>
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            <span>{isEditingExisting ? 'Cập nhật hình trong câu' : 'Chèn vào câu hỏi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

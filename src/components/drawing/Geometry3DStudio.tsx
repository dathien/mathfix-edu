import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Check, Download, Image as ImageIcon, RotateCcw, Save, X } from 'lucide-react';
import { Geometry3DSolidType, Geometry3DState } from '../../engine/figureTypes';
import {
  createDefaultGeometry3DState,
  GEOMETRY_3D_LABELS,
  getSolidMesh,
  renderGeometry3DToSvg,
} from '../../engine/geometry3dEngine';
import { svgMarkupToPngDataUrl } from '../../engine/svgSanitizer';

interface Geometry3DStudioProps {
  initialState?: Geometry3DState;
  initialTitle?: string;
  initialCaption?: string;
  isEditingExisting?: boolean;
  onCommit: (payload: {
    state: Geometry3DState;
    svgMarkup: string;
    pngDataUrl: string;
    title: string;
    caption: string;
  }) => void;
  onSaveToLibrary: (payload: { name: string; state: Geometry3DState }) => void;
  onCancel: () => void;
}

const ALL_SOLIDS = Object.keys(GEOMETRY_3D_LABELS) as Geometry3DSolidType[];

function probeSoftwareWebGL(): { supported: boolean; isSoftwareGl: boolean } {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return { supported: false, isSoftwareGl: false };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { supported: true, isSoftwareGl };
  } catch {
    return { supported: false, isSoftwareGl: false };
  }
}

export const Geometry3DStudio: React.FC<Geometry3DStudioProps> = ({
  initialState,
  initialTitle,
  initialCaption = '',
  isEditingExisting = false,
  onCommit,
  onSaveToLibrary,
  onCancel,
}) => {
  const [state, setState] = useState<Geometry3DState>(() =>
    initialState ? structuredClone(initialState) : createDefaultGeometry3DState('square_pyramid')
  );
  const [title, setTitle] = useState(
    initialTitle || GEOMETRY_3D_LABELS[initialState?.solidType || 'square_pyramid']
  );
  const [caption, setCaption] = useState(initialCaption);
  const [statusMsg, setStatusMsg] = useState('');
  const [webglReady, setWebglReady] = useState(true);

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const syncFromOrbitRef = useRef(false);

  const meshDef = useMemo(() => getSolidMesh(state.solidType), [state.solidType]);
  const svgMarkup = useMemo(() => renderGeometry3DToSvg(state, 520, 420), [state]);

  // Real Three.js interactive 3D viewport with RoomEnvironment, software-GL guard,
  // coalesced on-demand rendering, OrbitControls sync, and full GPU disposal on unmount.
  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) return;

    const { supported, isSoftwareGl } = probeSoftwareWebGL();
    if (!supported) {
      setWebglReady(false);
      return;
    }

    const width = Math.max(280, container.clientWidth || 440);
    const height = Math.max(240, container.clientHeight || 340);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: isSoftwareGl ? 'default' : 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f8fafc');

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const dist = 5.4 / Math.max(0.6, state.zoom || 1);
    const az = (state.azimuthDeg * Math.PI) / 180;
    const el = (state.elevationDeg * Math.PI) / 180;
    camera.position.set(
      dist * Math.cos(el) * Math.sin(-az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.cos(-az)
    );
    camera.lookAt(0, 0, 0);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const disposables: Array<{ dispose: () => void }> = [];
    const group = new THREE.Group();
    scene.add(group);

    // Build translucent 3D solid faces + crisp wireframe edges matching the exact solidType
    const faceMat = new THREE.MeshStandardMaterial({
      color: '#93c5fd',
      roughness: 0.45,
      metalness: 0.05,
      transparent: true,
      opacity: state.showFacesFill ? 0.28 : 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const accentFaceMat = new THREE.MeshStandardMaterial({
      color: state.accentColor || '#2563eb',
      roughness: 0.4,
      metalness: 0.05,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposables.push(faceMat, accentFaceMat);

    if (meshDef.curved === 'cylinder') {
      const geo = new THREE.CylinderGeometry(1.0, 1.0, 2.1, 36);
      disposables.push(geo);
      group.add(new THREE.Mesh(geo, faceMat));
      const edgesGeo = new THREE.EdgesGeometry(geo, 25);
      const edgeMat = new THREE.LineBasicMaterial({ color: state.strokeColor });
      disposables.push(edgesGeo, edgeMat);
      group.add(new THREE.LineSegments(edgesGeo, edgeMat));
    } else if (meshDef.curved === 'cone') {
      const geo = new THREE.ConeGeometry(1.05, 2.3, 36);
      geo.translate(0, 0.2, 0);
      disposables.push(geo);
      group.add(new THREE.Mesh(geo, faceMat));
      const edgesGeo = new THREE.EdgesGeometry(geo, 25);
      const edgeMat = new THREE.LineBasicMaterial({ color: state.strokeColor });
      disposables.push(edgesGeo, edgeMat);
      group.add(new THREE.LineSegments(edgesGeo, edgeMat));
    } else if (meshDef.curved === 'sphere') {
      const geo = new THREE.SphereGeometry(1.15, 28, 20);
      disposables.push(geo);
      group.add(new THREE.Mesh(geo, faceMat));
      const wireMat = new THREE.MeshBasicMaterial({
        color: state.strokeColor,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      disposables.push(wireMat);
      group.add(new THREE.Mesh(geo, wireMat));
    } else {
      // Polyhedral faces
      for (const f of meshDef.faces) {
        if (f.vertices.length < 3) continue;
        const pts: number[] = [];
        const v0 = meshDef.vertices[f.vertices[0]];
        for (let k = 1; k < f.vertices.length - 1; k++) {
          const v1 = meshDef.vertices[f.vertices[k]];
          const v2 = meshDef.vertices[f.vertices[k + 1]];
          pts.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        geo.computeVertexNormals();
        disposables.push(geo);
        group.add(new THREE.Mesh(geo, f.accent ? accentFaceMat : faceMat));
      }
    }

    // Crisp edges + dashed interior lines
    const solidEdgeMat = new THREE.LineBasicMaterial({ color: state.strokeColor });
    const accentEdgeMat = new THREE.LineBasicMaterial({ color: state.accentColor || '#2563eb' });
    const dashedEdgeMat = new THREE.LineDashedMaterial({
      color: state.accentColor || '#2563eb',
      dashSize: 0.14,
      gapSize: 0.1,
    });
    disposables.push(solidEdgeMat, accentEdgeMat, dashedEdgeMat);

    for (const e of meshDef.edges) {
      const a = meshDef.vertices[e.a];
      const b = meshDef.vertices[e.b];
      if (!a || !b) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, a.y, a.z),
        new THREE.Vector3(b.x, b.y, b.z),
      ]);
      disposables.push(geo);
      const line = new THREE.Line(geo, e.forceDashed ? dashedEdgeMat : e.accent ? accentEdgeMat : solidEdgeMat);
      if (e.forceDashed) line.computeLineDistances();
      group.add(line);
    }

    if (state.showAxes) {
      const axes = new THREE.AxesHelper(1.7);
      group.add(axes);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 10;

    // Coalesced on-demand rendering (per threejs/SKILL.md)
    let rafId = 0;
    let disposed = false;
    const renderFrame = () => {
      rafId = 0;
      if (disposed) return;
      renderer.render(scene, camera);
    };
    const requestRender = () => {
      if (!rafId && !disposed) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const handleControlChange = () => {
      requestRender();
    };
    const handleControlEnd = () => {
      const pos = camera.position;
      const r = pos.length() || 5.4;
      const newEl = Math.round((Math.asin(Math.max(-0.98, Math.min(0.98, pos.y / r))) * 180) / Math.PI);
      const newAz = Math.round((-Math.atan2(pos.x, pos.z) * 180) / Math.PI);
      const newZoom = Number(Math.max(0.6, Math.min(1.8, 5.4 / r)).toFixed(2));
      syncFromOrbitRef.current = true;
      setState((prev) => ({ ...prev, azimuthDeg: newAz, elevationDeg: newEl, zoom: newZoom }));
    };

    controls.addEventListener('change', handleControlChange);
    controls.addEventListener('end', handleControlEnd);
    requestRender();

    const ro = new ResizeObserver(() => {
      if (disposed || !container) return;
      const w = Math.max(240, container.clientWidth);
      const h = Math.max(220, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    ro.observe(container);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.removeEventListener('change', handleControlChange);
      controls.removeEventListener('end', handleControlEnd);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      envTex.dispose();
      roomEnv.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [
    state.solidType,
    state.showFacesFill,
    state.showAxes,
    state.strokeColor,
    state.accentColor,
    state.azimuthDeg,
    state.elevationDeg,
    state.zoom,
    meshDef,
  ]);

  const handleSelectSolid = (solidType: Geometry3DSolidType) => {
    setState((prev) => ({
      ...prev,
      solidType,
      customLabels: {},
      showAxes: solidType === 'oxyz_axes' ? true : prev.showAxes,
    }));
    setTitle(GEOMETRY_3D_LABELS[solidType]);
  };

  const handleExportSvg = () => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.solidType}-3d.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMsg('Đã xuất hình 3D sang tệp vector SVG theo đúng góc nhìn hiện tại.');
  };

  const handleExportPng = async () => {
    const png = await svgMarkupToPngDataUrl(svgMarkup, 2);
    if (!png) return;
    const a = document.createElement('a');
    a.href = png;
    a.download = `${state.solidType}-3d.png`;
    a.click();
    setStatusMsg('Đã xuất hình 3D sang PNG độ phân giải cao.');
  };

  const handleCommit = async () => {
    const pngDataUrl = (await svgMarkupToPngDataUrl(svgMarkup, 2)) || '';
    onCommit({
      state,
      svgMarkup,
      pngDataUrl,
      title: title.trim() || GEOMETRY_3D_LABELS[state.solidType],
      caption: caption.trim(),
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-[15px]">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr_290px] overflow-hidden">
        {/* LEFT: ALL 14 3D MODELS */}
        <aside className="bg-white border-r border-slate-200 overflow-y-auto p-3 space-y-1.5">
          <div className="text-[14px] font-bold text-slate-800 mb-2">14 mô hình Không gian 3D</div>
          {ALL_SOLIDS.map((solid) => (
            <button
              key={solid}
              type="button"
              onClick={() => handleSelectSolid(solid)}
              className={`w-full text-left px-3 py-2 rounded-lg text-[14.5px] font-medium border transition-colors ${
                state.solidType === solid
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {GEOMETRY_3D_LABELS[solid]}
            </button>
          ))}
        </aside>

        {/* CENTER: INTERACTIVE 3D WEBGL + LIVE VECTOR PROJECTION PREVIEW */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-4 overflow-y-auto bg-slate-100/70 items-start">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-slate-800">
                Khung xoay 3D trực quan (kéo chuột để xoay góc nhìn)
              </span>
              <button
                type="button"
                onClick={() => setState((p) => ({ ...p, azimuthDeg: -34, elevationDeg: 22, zoom: 1 }))}
                title="Đặt lại góc nhìn mặc định"
                className="inline-flex items-center gap-1 px-2 py-1 text-[13px] rounded border border-slate-200 bg-white hover:bg-slate-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mặc định</span>
              </button>
            </div>
            {webglReady ? (
              <div ref={canvasHostRef} className="w-full h-[360px] bg-slate-50" />
            ) : (
              <div className="p-6 text-[14.5px] text-slate-600">
                Trình duyệt không bật WebGL — sử dụng thanh trượt góc xoay bên phải để điều chỉnh góc nhìn 3D chính xác.
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 text-[14px] font-semibold text-slate-800">
              Bản chiếu phẳng chuẩn đề thi (Nét liền / Nét khuất tự động)
            </div>
            <div
              className="p-3 flex items-center justify-center min-h-[360px] [&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>
        </div>

        {/* RIGHT: ANGLE, VISIBILITY & VERTEX LABEL INSPECTOR */}
        <aside className="bg-white border-l border-slate-200 overflow-y-auto p-3.5 space-y-3">
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
              placeholder="VD: Hình chóp tứ giác S.ABCD"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[14.5px]"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-[13.5px] font-medium text-slate-700">
                Góc xoay ngang: {state.azimuthDeg}°
              </label>
              <input
                type="range"
                min={-180}
                max={180}
                value={state.azimuthDeg}
                onChange={(e) => setState((p) => ({ ...p, azimuthDeg: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-[13.5px] font-medium text-slate-700">
                Góc nghiêng đứng: {state.elevationDeg}°
              </label>
              <input
                type="range"
                min={-75}
                max={75}
                value={state.elevationDeg}
                onChange={(e) => setState((p) => ({ ...p, elevationDeg: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-[13.5px] font-medium text-slate-700">
                Thu phóng: {Math.round(state.zoom * 100)}%
              </label>
              <input
                type="range"
                min={0.65}
                max={1.65}
                step={0.05}
                value={state.zoom}
                onChange={(e) => setState((p) => ({ ...p, zoom: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-200 text-[14.5px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.showHiddenEdges}
                onChange={(e) => setState((p) => ({ ...p, showHiddenEdges: e.target.checked }))}
              />
              <span>Hiển thị nét khuất (nét đứt)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.showLabels}
                onChange={(e) => setState((p) => ({ ...p, showLabels: e.target.checked }))}
              />
              <span>Hiển thị tên đỉnh / điểm</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.showFacesFill}
                onChange={(e) => setState((p) => ({ ...p, showFacesFill: e.target.checked }))}
              />
              <span>Tô mờ mặt khối</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.showAxes}
                onChange={(e) => setState((p) => ({ ...p, showAxes: e.target.checked }))}
              />
              <span>Hiển thị hệ trục Oxyz</span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <div className="text-[13.5px] font-semibold text-slate-700 mb-1.5">Đổi nhãn các đỉnh</div>
            <div className="grid grid-cols-3 gap-1.5">
              {meshDef.labelKeys.map((k) => (
                <div key={k} className="flex items-center gap-1">
                  <span className="text-[13px] text-slate-500 w-5">{k}:</span>
                  <input
                    type="text"
                    value={state.customLabels?.[k] ?? k}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        customLabels: { ...p.customLabels, [k]: e.target.value },
                      }))
                    }
                    className="w-full px-1.5 py-1 text-[13.5px] border border-slate-300 rounded"
                  />
                </div>
              ))}
            </div>
          </div>
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
              onSaveToLibrary({ name: title.trim() || GEOMETRY_3D_LABELS[state.solidType], state });
              setStatusMsg('Đã lưu mô hình 3D vào Thư viện cá nhân.');
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
            <span>{isEditingExisting ? 'Cập nhật hình 3D' : 'Chèn hình 3D vào câu hỏi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import { useCallback, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import type { GlbLayerHandle } from './glbLayer';
import { beginDrag, dragScale, dragRotate, type DragState } from './dragHandlers';

// Chế độ thao tác model: bấm nút nào thì kéo chuột làm chức năng đó
// null = chưa chọn → kéo chuột không tác động model, map pan/zoom bình thường
export type EditMode = 'rotate' | 'scale' | 'move';

// Model đã tạo xong, lưu lại để sau này click edit/xóa
export type ModelRecord = { handle: GlbLayerHandle; name: string; url: string };

type MapHandle = {
  setStyle: (s: string) => void;
  getMap: () => maplibregl.Map | null;
};

/**
 * Hook gom toàn bộ logic đặt/chỉnh sửa model GLB trên map:
 * - Đè chuột trái ~1s để mở modal đặt model
 * - Click model đã tạo để mở modal edit
 * - Kéo chuột để xoay / phóng to / di chuyển tuỳ editMode
 *
 * Phần toán kéo chuột nằm ở dragHandlers.ts; render three.js nằm ở glbLayer.ts.
 */
export function useModelEditor(mapHandleRef: React.RefObject<MapHandle | null>) {
  // ----- State cho UI (đổi là re-render modal) -----
  const [modelPoint, setModelPoint] = useState<[number, number] | null>(null); // mở modal khi != null
  const [fileName, setFileName] = useState('');
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingExisting, setEditingExisting] = useState<ModelRecord | null>(null);

  // ----- Ref cho mouse handler (đọc trong sự kiện map, không cần re-render) -----
  // Transform hiện tại của model đang chỉnh
  const transformRef = useRef({ scale: 1, rot: 0, tilt: 0 });
  // Phiên chỉnh sửa đang mở: đang chỉnh gì, model cũ nào, trạng thái trước khi chỉnh (để Hủy)
  const sessionRef = useRef<{
    editing: boolean; // true khi modal đang mở và có model
    mode: EditMode | null; // bản sao editMode cho handler đọc
    existing: ModelRecord | null; // != null khi đang edit model cũ
    snapshot: { pos: [number, number]; scale: number; rot: number } | null;
  }>({ editing: false, mode: null, existing: null, snapshot: null });
  const previewRef = useRef<GlbLayerHandle | null>(null); // model đang preview/chỉnh
  const objectUrlRef = useRef<string | null>(null); // object URL của file mới chọn
  const modelsRef = useRef<ModelRecord[]>([]); // các model đã tạo xong
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // đếm long-press
  const dragRef = useRef<DragState | null>(null); // != null khi đang kéo model

  // Chọn chế độ thao tác: có chế độ → khoá map để cử chỉ chuột tác động model,
  // null → trả map về pan/zoom bình thường
  const changeEditMode = (m: EditMode | null) => {
    setEditMode(m);
    sessionRef.current.mode = m;
    const map = mapHandleRef.current?.getMap();
    if (!map) return;
    map.getCanvas().style.cursor = m === 'move' ? 'crosshair' : '';
    // Chỉ khoá kéo map (để cử chỉ kéo tác động model); zoom bản đồ vẫn dùng bình thường
    if (m !== null) {
      map.dragPan.disable();
    } else {
      map.dragPan.enable();
    }
  };

  const clearPreview = () => {
    previewRef.current?.remove();
    previewRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  // Mở modal edit cho model đã tạo (click vào model)
  const openEdit = (rec: ModelRecord) => {
    previewRef.current = rec.handle;
    setEditingExisting(rec);
    sessionRef.current.existing = rec;
    sessionRef.current.snapshot = {
      pos: rec.handle.getPosition(),
      scale: rec.handle.getScale(),
      rot: rec.handle.getRotation(),
    };
    transformRef.current = { scale: rec.handle.getScale(), rot: rec.handle.getRotation(), tilt: 0 };
    rec.handle.setSelected(true);
    setFileName(rec.name);
    setModelPoint(rec.handle.getPosition());
    sessionRef.current.editing = true;
    changeEditMode(null);
  };

  // Gắn toàn bộ mouse handler lên map (gọi 1 lần trong onMapReady):
  // click mở edit, long-press đặt model mới, kéo để xoay/scale/move
  const attachMapHandlers = (map: maplibregl.Map) => {
    const cancelLongPress = () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
    };
    // Click vào model đã tạo → mở modal edit (model mới nhất ưu tiên)
    map.on('click', (e) => {
      if (sessionRef.current.editing) return;
      for (let i = modelsRef.current.length - 1; i >= 0; i--) {
        if (modelsRef.current[i].handle.hitTest(e.point)) {
          openEdit(modelsRef.current[i]);
          return;
        }
      }
    });
    map.on('mousedown', (e) => {
      if (e.originalEvent.button !== 0) return; // chỉ chuột trái
      const s = sessionRef.current;
      // Đang chỉnh model + đã chọn chế độ → bắt đầu một phiên kéo
      if (s.editing && s.mode !== null && previewRef.current) {
        const [lng, lat] = previewRef.current.getPosition();
        dragRef.current = beginDrag(e.point, map.project([lng, lat]), transformRef.current.scale);
        return;
      }
      cancelLongPress();
      // Đè chuột ~1s không di chuyển → mở modal đặt model mới tại điểm đè
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      pressTimerRef.current = setTimeout(() => {
        clearPreview();
        setFileName('');
        setModelPoint(lngLat);
      }, 1000);
    });
    map.on('mousemove', (e) => {
      cancelLongPress(); // kéo map trước 1s thì huỷ long-press
      if (!dragRef.current || !previewRef.current) return;
      const t = transformRef.current;
      switch (sessionRef.current.mode) {
        case 'move': {
          const p: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          previewRef.current.setPosition(p);
          setModelPoint(p);
          break;
        }
        case 'scale':
          t.scale = dragScale(dragRef.current, e.point.y);
          previewRef.current.setScale(t.scale);
          break;
        case 'rotate':
          t.rot = dragRotate(dragRef.current, e.point, t.rot);
          previewRef.current.setRotation(t.rot);
          break;
        default:
          break;
      }
    });
    map.on('mouseup', () => {
      cancelLongPress();
      dragRef.current = null;
    });
    map.on('dragstart', cancelLongPress);
  };

  // Người dùng chọn file .glb → tạo layer preview tại điểm đã đè chuột
  const onPickFile = async (file: File | null) => {
    if (!file || !modelPoint) return;
    const map = mapHandleRef.current?.getMap();
    if (!map) return;
    clearPreview();
    // Dynamic import: three.js (~600kB) chỉ tải khi người dùng thêm model lần đầu
    const { addGlbLayer } = await import('./glbLayer');
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const t = transformRef.current;
    previewRef.current = addGlbLayer(map, modelPoint, url, t.scale);
    previewRef.current.setRotation(t.rot);
    previewRef.current.setTilt(t.tilt);
    setFileName(file.name);
    sessionRef.current.editing = true;
    changeEditMode(null);
  };

  // Đóng modal + đưa mọi state/ref về mặc định
  const resetModal = () => {
    sessionRef.current = { editing: false, mode: null, existing: null, snapshot: null };
    changeEditMode(null);
    setConfirmDelete(false);
    dragRef.current = null;
    setEditingExisting(null);
    setModelPoint(null);
    setFileName('');
    transformRef.current = { scale: 1, rot: 0, tilt: 0 };
  };

  // Nút "Tạo"/"Lưu": giữ thay đổi. Model mới → thêm vào danh sách modelsRef.
  const saveModal = () => {
    const s = sessionRef.current;
    if (s.existing) {
      s.existing.handle.setSelected(false);
      previewRef.current = null;
    } else if (previewRef.current && objectUrlRef.current) {
      modelsRef.current.push({
        handle: previewRef.current,
        name: fileName,
        url: objectUrlRef.current,
      });
      previewRef.current = null;
      objectUrlRef.current = null;
    }
    resetModal();
  };

  // Nút "Hủy": model mới → xóa preview; model cũ → trả về trạng thái trước khi edit
  const cancelModal = () => {
    const s = sessionRef.current;
    if (s.existing) {
      s.existing.handle.setSelected(false);
      if (s.snapshot) {
        s.existing.handle.setPosition(s.snapshot.pos);
        s.existing.handle.setScale(s.snapshot.scale);
        s.existing.handle.setRotation(s.snapshot.rot);
      }
      previewRef.current = null;
    } else {
      clearPreview();
    }
    resetModal();
  };

  // useCallback (chỉ dùng ref + state setter) để DeleteConfirmDialog memo được
  const deleteModel = useCallback(() => {
    const rec = sessionRef.current.existing;
    if (!rec) return;
    rec.handle.remove();
    URL.revokeObjectURL(rec.url);
    modelsRef.current = modelsRef.current.filter((r) => r !== rec);
    previewRef.current = null;
    resetModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    modelPoint,
    fileName,
    editMode,
    confirmDelete,
    setConfirmDelete,
    editingExisting,
    changeEditMode,
    attachMapHandlers,
    onPickFile,
    saveModal,
    cancelModal,
    deleteModel,
  };
}

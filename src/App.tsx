import { useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { ShareMapLibre } from 'sharemap-maplib-reactjs';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import Fade from '@mui/material/Fade';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import DeleteIcon from '@mui/icons-material/Delete';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { addGlbLayer, type GlbLayerHandle } from './glbLayer';
import LayersIcon from '@mui/icons-material/Layers';
import PublicIcon from '@mui/icons-material/Public';
import ExploreIcon from '@mui/icons-material/Explore';
import MapIcon from '@mui/icons-material/Map';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import GridOnIcon from '@mui/icons-material/GridOn';
import SignpostIcon from '@mui/icons-material/Signpost';
import { getMapAuthProps } from './mapConfig';

const STYLES = [
  { id: 'sharemap', label: 'ShareMap', icon: <MapIcon />, bg: 'linear-gradient(135deg,#e8f0e0,#cfe3c2)' },
  { id: 'bright', label: 'Bright', icon: <LightModeIcon />, bg: 'linear-gradient(135deg,#fff8e1,#ffe9a8)' },
  { id: 'dark', label: 'Dark', icon: <DarkModeIcon />, bg: 'linear-gradient(135deg,#1f2937,#111827)' },
  { id: 'positron', label: 'Positron', icon: <GridOnIcon />, bg: 'linear-gradient(135deg,#eceff1,#cfd8dc)' },
  { id: 'sharemap-streets', label: 'Streets', icon: <SignpostIcon />, bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
  { id: '/voyager-style.json', label: 'Voyager', icon: <ExploreIcon />, bg: 'linear-gradient(135deg,#fde8d7,#fbcfa4)' },
  { id: '/osm-style.json', label: 'OSM', icon: <PublicIcon />, bg: 'linear-gradient(135deg,#d9f0d3,#aadba0)' },
];

export default function App() {
  const [mapStyle, setMapStyle] = useState('sharemap');
  const [open, setOpen] = useState(false);
  const [is3D, setIs3D] = useState(false);
  // Handle từ onMapReady — prop `style` chỉ có tác dụng lúc mount,
  // đổi style sau đó phải gọi handle.setStyle()
  const mapHandleRef = useRef<{
    setStyle: (s: string) => void;
    getMap: () => maplibregl.Map | null;
  } | null>(null);

  // ===== Đè chuột trái ~1s để đặt model GLB =====
  const [modelPoint, setModelPoint] = useState<[number, number] | null>(null); // mở modal khi != null
  const [fileName, setFileName] = useState('');
  // Chế độ thao tác model: bấm nút nào thì kéo chuột làm chức năng đó
  // null = chưa chọn → kéo chuột không tác động model, map pan/zoom bình thường
  type EditMode = 'rotate' | 'scale' | 'move';
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const editModeRef = useRef<EditMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const previewRef = useRef<GlbLayerHandle | null>(null); // model đang preview/chỉnh
  const objectUrlRef = useRef<string | null>(null);
  // Danh sách model đã tạo + trạng thái đang edit model cũ
  type ModelRecord = { handle: GlbLayerHandle; name: string; url: string };
  const modelsRef = useRef<ModelRecord[]>([]);
  const [editingExisting, setEditingExisting] = useState<ModelRecord | null>(null);
  const editingExistingRef = useRef<ModelRecord | null>(null);
  const snapshotRef = useRef<{ pos: [number, number]; scale: number; rot: number } | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef(false); // true khi có model preview
  const scaleRef = useRef(1);
  const rotRef = useRef(0); // xoay quanh trục đứng
  const tiltRef = useRef(0); // nghiêng quanh trục ngang
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startRot: number;
    startTilt: number;
    startScale: number;
    centerX: number; // tâm model trên màn hình (cho xoay quanh tâm)
    centerY: number;
    startAngle: number; // góc con trỏ so với tâm lúc bắt đầu kéo (radian)
    lastAngle: number;
  } | null>(null);

  // Chọn chế độ thao tác: có chế độ → khoá map để cử chỉ chuột tác động model,
  // null → trả map về pan/zoom bình thường
  const changeEditMode = (m: EditMode | null) => {
    setEditMode(m);
    editModeRef.current = m;
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

  const setEditing = (on: boolean) => {
    editingRef.current = on;
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
    editingExistingRef.current = rec;
    setEditingExisting(rec);
    snapshotRef.current = {
      pos: rec.handle.getPosition(),
      scale: rec.handle.getScale(),
      rot: rec.handle.getRotation(),
    };
    scaleRef.current = rec.handle.getScale();
    rotRef.current = rec.handle.getRotation();
    tiltRef.current = 0;
    rec.handle.setSelected(true);
    setFileName(rec.name);
    setModelPoint(rec.handle.getPosition());
    setEditing(true);
    changeEditMode(null);
  };

  const setupLongPress = (map: maplibregl.Map) => {
    const cancel = () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
    };
    // Click vào model đã tạo → mở modal edit (model mới nhất ưu tiên)
    map.on('click', (e) => {
      if (editingRef.current) return;
      for (let i = modelsRef.current.length - 1; i >= 0; i--) {
        if (modelsRef.current[i].handle.hitTest(e.point)) {
          openEdit(modelsRef.current[i]);
          return;
        }
      }
    });
    map.on('mousedown', (e) => {
      if (e.originalEvent.button !== 0) return; // chỉ chuột trái
      // Đang chỉnh model: bắt đầu kéo — xoay (hoặc dời nếu bật chế độ di chuyển)
      if (editingRef.current && editModeRef.current !== null && previewRef.current) {
        const [lng, lat] = previewRef.current.getPosition();
        const center = map.project([lng, lat]);
        const angle = Math.atan2(e.point.y - center.y, e.point.x - center.x);
        dragRef.current = {
          startX: e.point.x,
          startY: e.point.y,
          startRot: rotRef.current,
          startTilt: tiltRef.current,
          startScale: scaleRef.current,
          centerX: center.x,
          centerY: center.y,
          startAngle: angle,
          lastAngle: angle,
        };
        return;
      }
      cancel();
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      pressTimerRef.current = setTimeout(() => {
        clearPreview();
        setFileName('');
        setModelPoint(lngLat);
      }, 1000);
    });
    map.on('mousemove', (e) => {
      cancel(); // kéo map trước 1s thì huỷ long-press
      if (!dragRef.current || !previewRef.current) return;
      const d = dragRef.current;
      const dy = e.point.y - d.startY;
      switch (editModeRef.current) {
        case 'move': {
          // Kéo để dời model theo con trỏ
          const p: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          previewRef.current.setPosition(p);
          setModelPoint(p);
          break;
        }
        case 'scale': {
          // Kéo lên phóng to, kéo xuống thu nhỏ (thang log)
          const s = Math.min(1000, Math.max(0.1, d.startScale * 10 ** (-dy / 200)));
          scaleRef.current = s;
          previewRef.current.setScale(s);
          break;
        }
        case 'rotate': {
          // Xoay quanh tâm: model bám theo góc con trỏ so với tâm (kiểu Sketchfab)
          const angle = Math.atan2(e.point.y - d.centerY, e.point.x - d.centerX);
          // Chênh lệch góc so với lần trước, chuẩn hoá về (-180, 180] để không nhảy khi qua ±180°
          let step = ((angle - d.lastAngle) * 180) / Math.PI;
          if (step > 180) step -= 360;
          if (step < -180) step += 360;
          d.lastAngle = angle;
          const rot = (rotRef.current - step + 360) % 360;
          rotRef.current = rot;
          previewRef.current.setRotation(rot);
          break;
        }
        default:
          break;
      }
    });
    map.on('mouseup', () => {
      cancel();
      dragRef.current = null;
    });
    map.on('dragstart', cancel);
  };

  const onPickFile = (file: File | null) => {
    if (!file || !modelPoint) return;
    const map = mapHandleRef.current?.getMap();
    if (!map) return;
    clearPreview();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    previewRef.current = addGlbLayer(map, modelPoint, url, scaleRef.current);
    previewRef.current.setRotation(rotRef.current);
    previewRef.current.setTilt(tiltRef.current);
    setFileName(file.name);
    setEditing(true);
    changeEditMode(null);
  };

  const resetModal = () => {
    setEditing(false);
    changeEditMode(null);
    setConfirmDelete(false);
    dragRef.current = null;
    editingExistingRef.current = null;
    setEditingExisting(null);
    setModelPoint(null);
    setFileName('');
    scaleRef.current = 1;
    rotRef.current = 0;
    tiltRef.current = 0;
  };

  const closeModal = (keep: boolean) => {
    const existing = editingExistingRef.current;
    if (existing) {
      // Đang edit model cũ
      existing.handle.setSelected(false);
      if (!keep && snapshotRef.current) {
        // Hủy → trả model về trạng thái trước khi edit
        existing.handle.setPosition(snapshotRef.current.pos);
        existing.handle.setScale(snapshotRef.current.scale);
        existing.handle.setRotation(snapshotRef.current.rot);
      }
      previewRef.current = null;
    } else if (!keep) {
      clearPreview();
    } else if (previewRef.current && objectUrlRef.current) {
      // Tạo mới → lưu vào danh sách để sau này click edit/xóa
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

  const deleteModel = () => {
    const rec = editingExistingRef.current;
    if (!rec) return;
    rec.handle.remove();
    URL.revokeObjectURL(rec.url);
    modelsRef.current = modelsRef.current.filter((r) => r !== rec);
    previewRef.current = null;
    resetModal();
  };

  const changeStyle = (id: string) => {
    setMapStyle(id);
    mapHandleRef.current?.setStyle(id);
  };

  const toggle3D = () => {
    const map = mapHandleRef.current?.getMap();
    if (!map) return;
    if (is3D) {
      // Về 2D: hết nghiêng/xoay, khoá chuột phải
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      map.dragRotate.disable();
      map.touchPitch.disable();
      setIs3D(false);
    } else {
      // 3D: nghiêng tối đa, chuột phải kéo để nghiêng/xoay tự do
      map.setMaxPitch(85);
      map.dragRotate.enable();
      map.touchPitch.enable();
      map.easeTo({ pitch: 70, duration: 600 });
      setIs3D(true);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0f172a' }}>
      {/* Modal đặt model GLB — góc trên trái */}
      {modelPoint !== null && (
        <Paper
          elevation={6}
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 2,
            width: 300,
            p: 2,
            borderRadius: 3,
            bgcolor: '#1e293b',
            color: '#e2e8f0',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
              {editingExisting ? 'Chỉnh sửa mô hình' : 'Thêm mô hình 3D'}
            </Typography>
            {editingExisting && (
              <Tooltip title="Xóa mô hình" arrow>
                <IconButton
                  size="small"
                  onClick={() => setConfirmDelete(true)}
                  sx={{ color: '#f87171' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Typography sx={{ fontSize: 12, color: '#94a3b8', mb: 1.5 }}>
            {modelPoint
              ? `Vị trí: ${modelPoint[1].toFixed(5)}, ${modelPoint[0].toFixed(5)}`
              : ''}
          </Typography>

          {editingExisting ? (
            <Typography sx={{ fontSize: 12, color: '#cbd5e1', mb: 1.5, wordBreak: 'break-all' }}>
              📦 {editingExisting.name}
            </Typography>
          ) : (
          <Button
            component="label"
            variant="outlined"
            fullWidth
            startIcon={<UploadFileIcon />}
            sx={{
              mb: 1.5,
              textTransform: 'none',
              color: '#93c5fd',
              borderColor: '#3b82f6',
              '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(59,130,246,.08)' },
            }}
          >
            {fileName || 'Chọn file .glb'}
            <input
              type="file"
              accept=".glb"
              hidden
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </Button>
          )}

          {fileName && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 0.75, mb: 1 }}>
                {(
                  [
                    { m: 'rotate' as const, label: 'Xoay', icon: <ThreeSixtyIcon fontSize="small" /> },
                    { m: 'scale' as const, label: 'Phóng to/nhỏ', icon: <ZoomInIcon fontSize="small" /> },
                    { m: 'move' as const, label: 'Di chuyển', icon: <OpenWithIcon fontSize="small" /> },
                  ]
                ).map(({ m, label, icon }) => {
                  const active = editMode === m;
                  return (
                    <Tooltip key={m} title={label} arrow>
                      <IconButton
                        size="small"
                        onClick={() => changeEditMode(editMode === m ? null : m)}
                        sx={{
                          border: '1px solid #3b82f6',
                          borderRadius: 1.5,
                          ...(active
                            ? { bgcolor: '#3b82f6', color: '#fff', '&:hover': { bgcolor: '#2563eb' } }
                            : {
                                color: '#93c5fd',
                                '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(59,130,246,.08)' },
                              }),
                        }}
                      >
                        {icon}
                      </IconButton>
                    </Tooltip>
                  );
                })}
              </Box>
              <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                {editMode === null && 'Chọn một chức năng để thao tác với model'}
                {editMode === 'rotate' && 'Kéo quanh model để xoay, model bám theo con trỏ'}
                {editMode === 'scale' && 'Kéo lên phóng to, kéo xuống thu nhỏ'}
                {editMode === 'move' && 'Kéo model tới vị trí mới'}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="contained"
              disabled={!fileName}
              onClick={() => closeModal(true)}
              sx={{ textTransform: 'none', bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
            >
              {editingExisting ? 'Lưu' : 'Tạo'}
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => closeModal(false)}
              sx={{ textTransform: 'none', color: '#94a3b8' }}
            >
              Hủy
            </Button>
          </Box>
        </Paper>
      )}

      {/* Xác nhận xóa model */}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        slotProps={{ paper: { sx: { bgcolor: '#1e293b', color: '#e2e8f0', borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontSize: 15 }}>
          Bạn có chắc chắn muốn xóa model này không?
        </DialogTitle>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={deleteModel}
            sx={{ textTransform: 'none', bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' } }}
          >
            Xóa
          </Button>
          <Button
            onClick={() => setConfirmDelete(false)}
            sx={{ textTransform: 'none', color: '#94a3b8' }}
          >
            Hủy
          </Button>
        </DialogActions>
      </Dialog>

      {/* Nút Lớp + 3D — góc trên phải, panel style xổ ra bên trái */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1,
          display: 'flex',
          flexDirection: 'row-reverse',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ButtonBase
            onClick={() => setOpen((v) => !v)}
            title="Chọn kiểu bản đồ"
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              boxShadow: 3,
              color: open ? '#fff' : '#cbd5e1',
              bgcolor: open ? '#3b82f6' : '#1e293b',
              '&:hover': { bgcolor: open ? '#2563eb' : '#334155' },
            }}
          >
            <LayersIcon fontSize="small" />
          </ButtonBase>

          <ButtonBase
            onClick={toggle3D}
            title={is3D ? 'Về 2D' : 'Chế độ 3D (chuột phải kéo để nghiêng)'}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              boxShadow: 3,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'sans-serif',
              color: '#fff',
              bgcolor: is3D ? '#3b82f6' : '#1e293b',
              '&:hover': { bgcolor: is3D ? '#2563eb' : '#334155' },
            }}
          >
            {is3D ? '2D' : '3D'}
          </ButtonBase>
        </Box>

        <Fade in={open}>
          <Paper
            elevation={6}
            sx={{
              display: 'flex',
              gap: 1,
              p: 1.25,
              borderRadius: 3,
              bgcolor: '#1e293b',
            }}
          >
            {STYLES.map((s) => {
              const active = mapStyle === s.id;
              return (
                <ButtonBase
                  key={s.id}
                  onClick={() => changeStyle(s.id)}
                  sx={{ flexDirection: 'column', gap: 0.5, borderRadius: 2 }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: s.bg,
                      color: s.id === 'dark' ? '#e2e8f0' : '#334155',
                      border: active ? '3px solid #3b82f6' : '3px solid transparent',
                      transition: 'border-color .15s',
                    }}
                  >
                    {s.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: active ? '#60a5fa' : '#cbd5e1',
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {s.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Paper>
        </Fade>
      </Box>

      <ShareMapLibre
        {...getMapAuthProps()}
        style={mapStyle}
        showAttribution={false}
        onMapReady={(handle) => {
          mapHandleRef.current = handle;
          // Mặc định 2D: khoá nghiêng/xoay bằng chuột phải
          const map = handle.getMap();
          map?.dragRotate.disable();
          map?.touchPitch.disable();
          if (map) setupLongPress(map);
        }}
        center={[106.699, 10.7798]} // Nhà thờ Đức Bà, TP.HCM
        zoom={15}
        containerStyle={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

# map3d — Đặt & chỉnh sửa model GLB trên bản đồ MapLibre

Tính năng cho phép người dùng đặt model 3D (.glb) lên bản đồ và chỉnh sửa trực tiếp bằng chuột.

## Cách hoạt động (góc nhìn người dùng)

- **Đè chuột trái ~1 giây** trên bản đồ → mở modal chọn file .glb, model hiện tại điểm đè.
- Trong modal chọn 1 trong 3 chế độ rồi **kéo chuột trên bản đồ**:
  - 🔄 Xoay — model bám theo góc con trỏ quanh tâm (kiểu Sketchfab)
  - 🔍 Phóng to/nhỏ — kéo lên to, kéo xuống nhỏ (thang log)
  - ✥ Di chuyển — model bám theo con trỏ
- **Tạo/Lưu** giữ model; **Hủy** trả về trạng thái trước đó (hoặc xóa preview).
- **Click vào model đã tạo** → mở lại modal để chỉnh sửa hoặc xóa.
- Nút góc phải: chọn kiểu bản đồ (panel style) và bật/tắt chế độ 3D.

## Cấu trúc file — ai gọi ai

```
App (host)
 ├─ useModelEditor.ts   ← "bộ não": state modal + mouse handler trên map
 │   ├─ dragHandlers.ts ← toán kéo chuột thuần (scale log, xoay quanh tâm)
 │   └─ glbLayer.ts     ← render model bằng three.js (custom layer maplibre)
 │                         (dynamic import — three.js chỉ tải khi thêm model)
 ├─ ModelModal.tsx          ← modal thêm/sửa model (góc trên trái)
 ├─ DeleteConfirmDialog.tsx ← xác nhận xóa
 ├─ MapControls.tsx         ← nút Lớp + 3D (góc trên phải)
 │   └─ mapStyles.tsx       ← danh sách kiểu bản đồ
 └─ theme.ts                ← bảng màu dùng chung (đổi màu sửa 1 file)
```

## Gắn vào dự án khác

Copy nguyên folder `map3d` vào `src/components/`, cần deps: `three`, `maplibre-gl`, `@mui/material`, `@mui/icons-material`.

```tsx
import { useModelEditor, ModelModal, DeleteConfirmDialog, MapControls } from './components/map3d';

function MyMap() {
  const mapHandleRef = useRef(null); // handle có getMap(): maplibregl.Map
  const editor = useModelEditor(mapHandleRef);

  return (
    <>
      {editor.modelPoint && (
        <ModelModal
          modelPoint={editor.modelPoint}
          fileName={editor.fileName}
          editMode={editor.editMode}
          editingExisting={editor.editingExisting}
          onChangeEditMode={editor.changeEditMode}
          onPickFile={editor.onPickFile}
          onSave={editor.saveModal}
          onCancel={editor.cancelModal}
          onRequestDelete={() => editor.setConfirmDelete(true)}
        />
      )}
      <DeleteConfirmDialog
        open={editor.confirmDelete}
        onConfirm={editor.deleteModel}
        onCancel={() => editor.setConfirmDelete(false)}
      />
      {/* Khi map sẵn sàng: editor.attachMapHandlers(map) — gọi đúng 1 lần */}
    </>
  );
}
```

Xem [App.tsx](../../App.tsx) để có ví dụ chạy được đầy đủ (kèm MapControls, toggle 3D).

## Ghi chú kỹ thuật

- Hook dùng **ref** cho những gì mouse handler đọc mỗi frame (transform, phiên edit, drag state) và **state** cho những gì UI cần render — tránh re-render 60 lần/giây khi kéo.
- `glbLayer` cache ma trận local, chỉ tính lại khi transform đổi; `onRemove` dispose geometry/material/texture để không rò rỉ GPU memory.
- Khi bật chế độ thao tác, map bị khóa `dragPan` (giữ zoom) để cử chỉ kéo dồn cho model.

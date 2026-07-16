import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import DeleteIcon from '@mui/icons-material/Delete';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import type { EditMode, ModelRecord } from './useModelEditor';
import { colors } from './theme';

// Style tách khỏi JSX để cấu trúc UI dễ lướt
const sx = {
  panel: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    width: 300,
    p: 2,
    borderRadius: 3,
    bgcolor: colors.panel,
    color: colors.text,
  },
  pickFileBtn: {
    mb: 1.5,
    textTransform: 'none',
    color: colors.primaryLight,
    borderColor: colors.primary,
    '&:hover': { borderColor: colors.primaryBorderHover, bgcolor: colors.primaryBgHover },
  },
  modeBtn: (active: boolean) => ({
    border: `1px solid ${colors.primary}`,
    borderRadius: 1.5,
    ...(active
      ? { bgcolor: colors.primary, color: '#fff', '&:hover': { bgcolor: colors.primaryHover } }
      : {
          color: colors.primaryLight,
          '&:hover': { borderColor: colors.primaryBorderHover, bgcolor: colors.primaryBgHover },
        }),
  }),
  saveBtn: {
    textTransform: 'none',
    bgcolor: colors.primary,
    '&:hover': { bgcolor: colors.primaryHover },
  },
  cancelBtn: { textTransform: 'none', color: colors.textMuted },
} as const;

// Các nút chế độ thao tác + mô tả hiển thị bên dưới
const EDIT_MODES = [
  { m: 'rotate', label: 'Xoay', icon: <ThreeSixtyIcon fontSize="small" /> },
  { m: 'scale', label: 'Phóng to/nhỏ', icon: <ZoomInIcon fontSize="small" /> },
  { m: 'move', label: 'Di chuyển', icon: <OpenWithIcon fontSize="small" /> },
] as const;

const MODE_HINTS: Record<string, string> = {
  none: 'Chọn một chức năng để thao tác với model',
  rotate: 'Kéo quanh model để xoay, model bám theo con trỏ',
  scale: 'Kéo lên phóng to, kéo xuống thu nhỏ',
  move: 'Kéo model tới vị trí mới',
};

type Props = {
  modelPoint: [number, number];
  fileName: string;
  editMode: EditMode | null;
  editingExisting: ModelRecord | null;
  onChangeEditMode: (m: EditMode | null) => void;
  onPickFile: (file: File | null) => void;
  onSave: () => void; // nút Tạo/Lưu
  onCancel: () => void; // nút Hủy
  onRequestDelete: () => void; // icon thùng rác (chỉ khi edit model cũ)
};

// Modal đặt/chỉnh sửa model GLB — góc trên trái
export default function ModelModal({
  modelPoint,
  fileName,
  editMode,
  editingExisting,
  onChangeEditMode,
  onPickFile,
  onSave,
  onCancel,
  onRequestDelete,
}: Props) {
  return (
    <Paper elevation={6} sx={sx.panel}>
      {/* Tiêu đề + nút xóa (khi edit model cũ) */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
          {editingExisting ? 'Chỉnh sửa mô hình' : 'Thêm mô hình 3D'}
        </Typography>
        {editingExisting && (
          <Tooltip title="Xóa mô hình" arrow>
            <IconButton size="small" onClick={onRequestDelete} sx={{ color: colors.dangerLight }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Typography sx={{ fontSize: 12, color: colors.textMuted, mb: 1.5 }}>
        {`Vị trí: ${modelPoint[1].toFixed(5)}, ${modelPoint[0].toFixed(5)}`}
      </Typography>

      {/* Tên model cũ, hoặc nút chọn file khi tạo mới */}
      {editingExisting ? (
        <Typography sx={{ fontSize: 12, color: colors.textLight, mb: 1.5, wordBreak: 'break-all' }}>
          📦 {editingExisting.name}
        </Typography>
      ) : (
        <Button
          component="label"
          variant="outlined"
          fullWidth
          startIcon={<UploadFileIcon />}
          sx={sx.pickFileBtn}
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

      {/* Các nút chế độ thao tác — chỉ hiện khi đã có model */}
      {fileName && (
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 0.75, mb: 1 }}>
            {EDIT_MODES.map(({ m, label, icon }) => (
              <Tooltip key={m} title={label} arrow>
                <IconButton
                  size="small"
                  onClick={() => onChangeEditMode(editMode === m ? null : m)}
                  sx={sx.modeBtn(editMode === m)}
                >
                  {icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>
          <Typography sx={{ fontSize: 11, color: colors.textFaint }}>
            {MODE_HINTS[editMode ?? 'none']}
          </Typography>
        </Box>
      )}

      {/* Nút Tạo/Lưu + Hủy */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button fullWidth variant="contained" disabled={!fileName} onClick={onSave} sx={sx.saveBtn}>
          {editingExisting ? 'Lưu' : 'Tạo'}
        </Button>
        <Button fullWidth variant="text" onClick={onCancel} sx={sx.cancelBtn}>
          Hủy
        </Button>
      </Box>
    </Paper>
  );
}

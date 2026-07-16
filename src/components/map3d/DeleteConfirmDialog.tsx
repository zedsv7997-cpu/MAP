import { memo } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import { colors } from './theme';

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Hộp thoại xác nhận xóa model
// memo: không render lại khi App re-render vì kéo model
export default memo(function DeleteConfirmDialog({ open, onConfirm, onCancel }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      slotProps={{ paper: { sx: { bgcolor: colors.panel, color: colors.text, borderRadius: 3 } } }}
    >
      <DialogTitle sx={{ fontSize: 15 }}>
        Bạn có chắc chắn muốn xóa model này không?
      </DialogTitle>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{ textTransform: 'none', bgcolor: colors.danger, '&:hover': { bgcolor: colors.dangerHover } }}
        >
          Xóa
        </Button>
        <Button onClick={onCancel} sx={{ textTransform: 'none', color: colors.textMuted }}>
          Hủy
        </Button>
      </DialogActions>
    </Dialog>
  );
});

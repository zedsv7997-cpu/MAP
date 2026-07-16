import { memo, useState } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Fade from '@mui/material/Fade';
import LayersIcon from '@mui/icons-material/Layers';
import { STYLES } from './mapStyles';
import { colors } from './theme';

// Style tách khỏi JSX để cấu trúc UI dễ lướt
const sx = {
  wrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 1,
  },
  // Nút vuông 40x40 góc phải; active = đang bật (panel mở / đang 3D)
  squareBtn: (active: boolean) => ({
    width: 40,
    height: 40,
    borderRadius: 2,
    boxShadow: 3,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'sans-serif',
    color: active ? '#fff' : colors.textLight,
    bgcolor: active ? colors.primary : colors.panel,
    '&:hover': { bgcolor: active ? colors.primaryHover : colors.panelHover },
  }),
  stylePanel: { display: 'flex', gap: 1, p: 1.25, borderRadius: 3, bgcolor: colors.panel },
  styleThumb: (bg: string, dark: boolean, active: boolean) => ({
    width: 56,
    height: 56,
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: bg,
    color: dark ? colors.text : colors.panelHover,
    border: active ? `3px solid ${colors.primary}` : '3px solid transparent',
    transition: 'border-color .15s',
  }),
  styleLabel: (active: boolean) => ({
    fontSize: 11,
    color: active ? colors.primaryBorderHover : colors.textLight,
    fontWeight: active ? 700 : 400,
  }),
} as const;

type Props = {
  mapStyle: string;
  onChangeStyle: (id: string) => void;
  is3D: boolean;
  onToggle3D: () => void;
};

// Nút Lớp + 3D — góc trên phải, panel style xổ ra bên trái
// memo: không render lại khi App re-render vì kéo model (modelPoint đổi liên tục)
export default memo(function MapControls({ mapStyle, onChangeStyle, is3D, onToggle3D }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={sx.wrap}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <ButtonBase
          onClick={() => setOpen((v) => !v)}
          title="Chọn kiểu bản đồ"
          sx={sx.squareBtn(open)}
        >
          <LayersIcon fontSize="small" />
        </ButtonBase>

        <ButtonBase
          onClick={onToggle3D}
          title={is3D ? 'Về 2D' : 'Chế độ 3D (chuột phải kéo để nghiêng)'}
          sx={{ ...sx.squareBtn(is3D), color: '#fff' }}
        >
          {is3D ? '2D' : '3D'}
        </ButtonBase>
      </Box>

      <Fade in={open}>
        <Paper elevation={6} sx={sx.stylePanel}>
          {STYLES.map((s) => {
            const active = mapStyle === s.id;
            return (
              <ButtonBase
                key={s.id}
                onClick={() => onChangeStyle(s.id)}
                sx={{ flexDirection: 'column', gap: 0.5, borderRadius: 2 }}
              >
                <Box sx={sx.styleThumb(s.bg, s.id === 'dark', active)}>{s.icon}</Box>
                <Typography sx={sx.styleLabel(active)}>{s.label}</Typography>
              </ButtonBase>
            );
          })}
        </Paper>
      </Fade>
    </Box>
  );
});

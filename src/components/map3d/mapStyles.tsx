import ExploreIcon from '@mui/icons-material/Explore';
import MapIcon from '@mui/icons-material/Map';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import GridOnIcon from '@mui/icons-material/GridOn';
import SignpostIcon from '@mui/icons-material/Signpost';
import PublicIcon from '@mui/icons-material/Public';

// Danh sách kiểu bản đồ hiển thị trong panel chọn style
export const STYLES = [
  { id: 'sharemap', label: 'ShareMap', icon: <MapIcon />, bg: 'linear-gradient(135deg,#e8f0e0,#cfe3c2)' },
  { id: 'bright', label: 'Bright', icon: <LightModeIcon />, bg: 'linear-gradient(135deg,#fff8e1,#ffe9a8)' },
  { id: 'dark', label: 'Dark', icon: <DarkModeIcon />, bg: 'linear-gradient(135deg,#1f2937,#111827)' },
  { id: 'positron', label: 'Positron', icon: <GridOnIcon />, bg: 'linear-gradient(135deg,#eceff1,#cfd8dc)' },
  { id: 'sharemap-streets', label: 'Streets', icon: <SignpostIcon />, bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
  { id: '/voyager-style.json', label: 'Voyager', icon: <ExploreIcon />, bg: 'linear-gradient(135deg,#fde8d7,#fbcfa4)' },
  { id: '/osm-style.json', label: 'OSM', icon: <PublicIcon />, bg: 'linear-gradient(135deg,#d9f0d3,#aadba0)' },
];

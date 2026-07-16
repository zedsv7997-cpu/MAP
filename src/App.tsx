import { useCallback, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { ShareMapLibre } from 'sharemap-maplib-reactjs';
import { getMapAuthProps } from './mapConfig';
import { useModelEditor, ModelModal, DeleteConfirmDialog, MapControls } from './components/map3d';

export default function App() {
  const [mapStyle, setMapStyle] = useState('sharemap');
  const [is3D, setIs3D] = useState(false);
  // Handle từ onMapReady — prop `style` chỉ có tác dụng lúc mount,
  // đổi style sau đó phải gọi handle.setStyle()
  const mapHandleRef = useRef<{
    setStyle: (s: string) => void;
    getMap: () => maplibregl.Map | null;
  } | null>(null);

  const editor = useModelEditor(mapHandleRef);

  // useCallback để MapControls (memo) không render lại khi App re-render
  const changeStyle = useCallback((id: string) => {
    setMapStyle(id);
    mapHandleRef.current?.setStyle(id);
  }, []);

  const toggle3D = useCallback(() => {
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
  }, [is3D]);

  const cancelDelete = useCallback(() => editor.setConfirmDelete(false), [editor.setConfirmDelete]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0f172a' }}>
      {editor.modelPoint !== null && (
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
        onCancel={cancelDelete}
      />

      <MapControls
        mapStyle={mapStyle}
        onChangeStyle={changeStyle}
        is3D={is3D}
        onToggle3D={toggle3D}
      />

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
          if (map) editor.attachMapHandlers(map);
        }}
        center={[106.699, 10.7798]} // Nhà thờ Đức Bà, TP.HCM
        zoom={15}
        containerStyle={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

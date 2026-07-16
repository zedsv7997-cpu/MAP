// Custom layer maplibre render model GLB bằng three.js tại một điểm lng/lat.
import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface GlbLayerHandle {
  id: string;
  remove: () => void;
  setScale: (s: number) => void; // hệ số phóng to/nhỏ
  setRotation: (deg: number) => void; // xoay quanh trục đứng, độ
  setTilt: (deg: number) => void; // nghiêng quanh trục ngang, độ
  setPosition: (lngLat: [number, number]) => void; // di chuyển model
  getPosition: () => [number, number];
  getScale: () => number;
  getRotation: () => number;
  setSelected: (on: boolean) => void; // hiện/ẩn khung viền quanh model
  hitTest: (point: { x: number; y: number }) => boolean; // điểm màn hình có trúng model không
}

let layerSeq = 0;

/**
 * Thêm model GLB vào map tại [lng, lat].
 * `url` là object URL (URL.createObjectURL từ file người dùng chọn) hoặc URL thường.
 */
export function addGlbLayer(
  map: maplibregl.Map,
  lngLat: [number, number],
  url: string,
  initialScale = 1,
): GlbLayerHandle {
  const id = `glb-model-${++layerSeq}`;

  let position: [number, number] = lngLat;
  let scale = initialScale;
  let rotationDeg = 0;
  let tiltDeg = 0;

  let merc = maplibregl.MercatorCoordinate.fromLngLat(
    { lng: position[0], lat: position[1] },
    0,
  );

  // Chuẩn hoá kích thước: model nào cũng hiện ~30m ở scale 1 cho dễ thấy
  let baseScale = 1;

  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer | null = null;
  let modelScene: THREE.Group | null = null;
  let boxHelper: THREE.BoxHelper | null = null;
  // Ma trận chiếu (model space → clip) của frame gần nhất, dùng cho hit-test
  const lastProj = new THREE.Matrix4();
  const projMat = new THREE.Matrix4();
  let hasProj = false;

  // Ma trận đặt model vào mercator — chỉ tính lại khi vị trí/scale/xoay đổi,
  // render mỗi frame dùng lại bản cache thay vì cấp phát Matrix4 mới
  const localMat = new THREE.Matrix4();
  const tmpRot = new THREE.Matrix4();
  let localDirty = true;
  const localMatrix = () => {
    if (localDirty) {
      const meterScale = merc.meterInMercatorCoordinateUnits() * scale * baseScale;
      localMat
        .makeTranslation(merc.x, merc.y, merc.z)
        .scale(new THREE.Vector3(meterScale, -meterScale, meterScale))
        .multiply(tmpRot.makeRotationZ((rotationDeg * Math.PI) / 180))
        .multiply(tmpRot.makeRotationX(Math.PI / 2 + (tiltDeg * Math.PI) / 180));
      localDirty = false;
    }
    return localMat;
  };

  const layer: maplibregl.CustomLayerInterface = {
    id,
    type: 'custom',
    renderingMode: '3d',
    onAdd(mapInstance, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Ánh sáng cơ bản để model không bị đen
      scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      const dir = new THREE.DirectionalLight(0xffffff, 1.5);
      dir.position.set(100, 200, 100);
      scene.add(dir);

      new GLTFLoader().load(url, (gltf) => {
        modelScene = gltf.scene;
        const size = new THREE.Box3()
          .setFromObject(gltf.scene)
          .getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) baseScale = 30 / maxDim;
        localDirty = true;
        scene.add(gltf.scene);
        mapInstance.triggerRepaint();
      });

      renderer = new THREE.WebGLRenderer({
        canvas: mapInstance.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    render(_gl, matrix) {
      if (!renderer) return;
      // Dùng lại projMat mỗi frame thay vì cấp phát Matrix4 mới
      projMat.fromArray(
        (matrix as unknown as { defaultProjectionData?: { mainMatrix: number[] } })
          .defaultProjectionData?.mainMatrix ?? (matrix as unknown as number[]),
      );
      camera.projectionMatrix = projMat.multiply(localMatrix());
      lastProj.copy(camera.projectionMatrix);
      hasProj = true;
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      // Giải phóng GPU memory của model (geometry/material/texture)
      scene?.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (!mat) return;
          Object.values(mat).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          mat.dispose();
        });
      });
      renderer?.dispose();
      renderer = null;
      modelScene = null;
    },
  };

  map.addLayer(layer);

  return {
    id,
    remove: () => {
      if (map.getLayer(id)) map.removeLayer(id);
    },
    setScale: (s) => {
      scale = s;
      localDirty = true;
      map.triggerRepaint();
    },
    setRotation: (deg) => {
      rotationDeg = deg;
      localDirty = true;
      map.triggerRepaint();
    },
    setTilt: (deg) => {
      tiltDeg = deg;
      localDirty = true;
      map.triggerRepaint();
    },
    setPosition: (p) => {
      position = p;
      merc = maplibregl.MercatorCoordinate.fromLngLat({ lng: p[0], lat: p[1] }, 0);
      localDirty = true;
      map.triggerRepaint();
    },
    getPosition: () => position,
    getScale: () => scale,
    getRotation: () => rotationDeg,
    setSelected: (on) => {
      if (!scene) return;
      if (on && modelScene && !boxHelper) {
        boxHelper = new THREE.BoxHelper(modelScene, 0x3b82f6);
        (boxHelper.material as THREE.LineBasicMaterial).depthTest = false; // viền luôn nổi lên trên
        scene.add(boxHelper);
      } else if (!on && boxHelper) {
        scene.remove(boxHelper);
        boxHelper = null;
      }
      map.triggerRepaint();
    },
    hitTest: (point) => {
      if (!hasProj || !modelScene) return false;
      // Bắn tia từ điểm click xuyên vào cảnh (raycast) — chỉ trúng khi click đúng mesh
      const canvas = map.getCanvas();
      const ndcX = (point.x / canvas.clientWidth) * 2 - 1;
      const ndcY = 1 - (point.y / canvas.clientHeight) * 2;
      const inv = lastProj.clone().invert();
      const near = new THREE.Vector3(ndcX, ndcY, -1).applyMatrix4(inv);
      const far = new THREE.Vector3(ndcX, ndcY, 1).applyMatrix4(inv);
      const raycaster = new THREE.Raycaster(near, far.sub(near).normalize());
      return raycaster.intersectObject(modelScene, true).length > 0;
    },
  };
}

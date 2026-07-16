// Phần "toán" của thao tác kéo chuột lên model (scale/rotate).
// Tách khỏi React để đọc riêng được và dễ viết unit test.

// Trạng thái một phiên kéo, tạo lúc mousedown, dùng trong các mousemove sau đó
export type DragState = {
  startY: number; // toạ độ y lúc bắt đầu kéo (cho scale)
  startScale: number; // scale lúc bắt đầu kéo
  centerX: number; // tâm model trên màn hình (cho xoay quanh tâm)
  centerY: number;
  lastAngle: number; // góc con trỏ so với tâm ở lần move trước (radian)
};

export function beginDrag(
  point: { x: number; y: number },
  center: { x: number; y: number },
  startScale: number,
): DragState {
  return {
    startY: point.y,
    startScale,
    centerX: center.x,
    centerY: center.y,
    lastAngle: Math.atan2(point.y - center.y, point.x - center.x),
  };
}

// Kéo lên phóng to, kéo xuống thu nhỏ (thang log), kẹp trong [0.1, 1000]
export function dragScale(d: DragState, y: number): number {
  const dy = y - d.startY;
  return Math.min(1000, Math.max(0.1, d.startScale * 10 ** (-dy / 200)));
}

// Xoay quanh tâm: model bám theo góc con trỏ so với tâm (kiểu Sketchfab).
// Trả về góc mới (0–360) và cập nhật d.lastAngle cho lần move tiếp theo.
export function dragRotate(
  d: DragState,
  point: { x: number; y: number },
  currentRotDeg: number,
): number {
  const angle = Math.atan2(point.y - d.centerY, point.x - d.centerX);
  // Chênh lệch góc so với lần trước, chuẩn hoá về (-180, 180] để không nhảy khi qua ±180°
  let step = ((angle - d.lastAngle) * 180) / Math.PI;
  if (step > 180) step -= 360;
  if (step < -180) step += 360;
  d.lastAngle = angle;
  return (currentRotDeg - step + 360) % 360;
}

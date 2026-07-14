// API key đọc từ biến môi trường (file .env):
//   VITE_SHAREMAP_KEY=...      (serviceKey)
//   VITE_SHAREMAP_SECRET=...   (secretKey, nếu có)
// Package KHÔNG bắt buộc key — không có key thì map vẫn chạy bình thường.
const API_KEY: string = import.meta.env.VITE_SHAREMAP_KEY ?? '';
const API_SECRET: string = import.meta.env.VITE_SHAREMAP_SECRET ?? '';

export const hasApiKey = API_KEY.trim() !== '';

/**
 * Props xác thực cho <ShareMapLibre /> — tách 2 trường hợp rõ ràng:
 * - CÓ key  → truyền serviceKey/secretKey + modeKey (gửi key qua HTTP header).
 * - KHÔNG key → truyền chuỗi rỗng (type của package yêu cầu prop này,
 *   nhưng server không cần key nên vẫn hoạt động).
 */
export function getMapAuthProps() {
  if (hasApiKey) {
    // ===== Nhánh CÓ API key =====
    return {
      serviceKey: API_KEY,
      secretKey: API_SECRET,
      modeKey: 'header' as const, // hoặc 'query' nếu muốn gửi qua query string
    };
  }
  // ===== Nhánh KHÔNG có API key =====
  return {
    serviceKey: '',
    secretKey: '',
  };
}

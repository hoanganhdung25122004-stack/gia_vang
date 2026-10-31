# SỔ CÁI BÀI HỌC KINH NGHIỆM (LESSONS LEARNED LEDGER)

## 1. NHẬT KÝ BÀI HỌC ĐÃ ĐƯỢC ĐÚC KẾT

### [2026-10-31 16:04] Khởi tạo dự án Theo dõi & Dự báo Giá Vàng
* **Tags:** [#gold, #quant, #static-web, #lightweight-charts]
* **Quy chuẩn áp dụng:** Xuất đồng thời `data/gold_data.json` (cho HTTP server/GitHub Pages) và `data/gold_data.js` (`window.GOLD_MARKET_DATA`) để trang web có thể mở trực tiếp qua giao thức `file:///` trên máy tính cá nhân mà không bị lỗi CORS.


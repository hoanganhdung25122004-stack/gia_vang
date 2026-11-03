# SỔ CÁI BÀI HỌC KINH NGHIỆM (LESSONS LEARNED LEDGER)

## 1. NHẬT KÝ BÀI HỌC ĐÃ ĐƯỢC ĐÚC KẾT

### [2026-10-31 16:04] Khởi tạo dự án Theo dõi & Dự báo Giá Vàng
* **Tags:** [#gold, #quant, #static-web, #lightweight-charts]
* **Quy chuẩn áp dụng:** Xuất đồng thời `data/gold_data.json` (cho HTTP server/GitHub Pages) và `data/gold_data.js` (`window.GOLD_MARKET_DATA`) để trang web có thể mở trực tiếp qua giao thức `file:///` trên máy tính cá nhân mà không bị lỗi CORS.

### [2026-11-02 20:55] Kiến trúc Kiểm định Đối chiếu Dự báo Giá Vàng (Audit & Backtest)
* **Tags:** [#forecast-audit, #backtest, #quant, #accuracy, #scorecard]
* **Bối cảnh & Giải pháp:** Khi người dùng yêu cầu đối chiếu kết quả dự báo với thực tế tại mốc thời gian cụ thể:
  1. Kết hợp đồng thời 2 cơ chế: Backtest tái hiện lại dự báo tại các mốc lịch sử cụ thể (1W, 1M, 3M, 6M, 1Y) so với nến chốt thực tế hiện tại + Ghi nhận sổ cái Snapshot định kỳ (`data/forecast_history.json`).
  2. Đo lường độc lập 4 thước đo: Giá thực tế vs Giá mục tiêu (độ lệch % MAPE), Kịch bản trúng (Bullish/Base/Bearish), Đánh giá lệnh thực thi (TP/SL/DCA), và Phân tích nguyên nhân vĩ mô (Post-mortem Macro Analysis).
  3. Với vàng Việt Nam (SJC, Nhẫn 9999), ở mốc 1 năm (tích sản chu kỳ), tỷ lệ tăng trưởng thực tế (+4.7% đến +5.0%) triệt tiêu hoàn toàn chi phí Spread Mua-Bán và khớp trọn vẹn kịch bản Tích sản Cơ sở bền vững.


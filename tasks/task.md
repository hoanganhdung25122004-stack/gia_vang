# SỔ CÁI THEO DÕI CÔNG VIỆC DỰ ÁN (PROJECT TASK TRACKER)

## 1. TRẠNG THÁI HIỆN TẠI (ACTIVE WORKING MEMORY)

* **Dự án:** Hệ Thống Theo Dõi & Dự Báo Giá Vàng Thế Giới - Việt Nam (SJC, 9999)
* **Nhiệm vụ:** Bổ sung Chiến Lược & Kế Hoạch Lệnh Chuẩn Cho Dài Hạn (1 – 3 Năm / Tích Sản Chu Kỳ) hoàn thiện trọn bộ 3 chân trời đầu tư (Ngắn - Trung - Dài hạn)
* **Trạng thái:** HOÀN THÀNH TOÀN DIỆN (CLEAR)
* **Kết quả kỹ thuật & Đầu ra:**
  1. **Backend Engine ([scripts/update_gold_data.py](file:///c:/Users/ADMIN/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/vàng/scripts/update_gold_data.py)):**
     - Đã tích hợp trọn vẹn 3 phân hệ chiến lược: `short_term` (1–2 Tuần / T+), `medium_term` (1–3 Tháng / Sóng Chu Kỳ), `long_term` (1–3 Năm / Tích Sản Chu Kỳ).
     - Định lượng dữ liệu dài hạn: Đường trung bình động thế kỷ MA200, đỉnh/đáy 52 tuần (252 phiên), khoảng cách định giá so với MA200.
     - Phân loại trạng thái chu kỳ: `VALUE_BUY_DCA` (Sát MA200, gom mạnh 1.5x - 2.0x), `CYCLE_OVERHEATED` (Cách MA200 > 35%, tạm dừng gom), `STEADY_ACCUMULATION` (Tích sản đều đặn vốn nhàn rỗi).
     - Kế hoạch lệnh chuẩn Dài hạn cho Vàng Nhẫn 9999, SJC, và XAU/USD với 4 thẻ: Vùng gom tích sản (Dynamic DCA Zone), Ngưỡng rủi ro chu kỳ (Cycle SL), Mục tiêu 1 năm (TP1: vượt trội tiền gửi), Mục tiêu 2-3 năm (TP2: siêu chu kỳ vĩ mô).
  2. **Frontend UI ([index.html](file:///c:/Users/ADMIN/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/vàng/index.html) & [assets/app.js](file:///c:/Users/ADMIN/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/vàng/assets/app.js)):**
     - Thanh điều hướng chu kỳ 3 nút bấm trực quan: `⚡ Ngắn Hạn (1 – 2 Tuần / T+)`, `🎯 Trung Hạn (1 – 3 Tháng / Sóng)`, `💎 Dài Hạn (1 – 3 Năm / Tích Sản)`.
     - Tự động thay đổi tiêu đề, bối cảnh, khuyến nghị chọn tài sản (Khuyên dùng Vàng Nhẫn 9999 70% – 80% để triệt tiêu rủi ro chính sách Nghị định 24).
     - 4 thẻ lệnh hiển thị theo ngữ cảnh Dài hạn cùng 3 nguyên tắc kỷ luật tích sản sống còn (Dynamic DCA, 100% tiền nhàn rỗi không vay nợ, Tái cân bằng danh mục 15-25%).
  3. **Kiểm định Tất định:**
     - `node -c assets/app.js`: Đạt chuẩn cú pháp JS.
     - `HTMLParser feed index.html`: Đạt chuẩn HTML5.
     - Pipeline `python scripts/update_gold_data.py`: Hoạt động trơn tru, đồng bộ `data/gold_data.json` và `data/gold_data.js`.

---

## 2. LỊCH SỬ CỘT MỐC ĐÃ NÉN (COMPACTED MILESTONES)

| Cột mốc / Pha | Thời gian | Trạng thái | Tóm tắt kết quả chính & Bằng chứng |
| :--- | :--- | :---: | :--- |
| Phiên bản 1.0: Đồ thị & Dự báo Vĩ mô | 2026-10-31 | CLEAR | Hoàn thiện index.html, scripts/update_gold_data.py, data/gold_data.json |
| Phiên bản 2.0: Tin tức & Sự kiện Đa khung | 2026-11-02 | CLEAR | Đã tích hợp 142 sự kiện vĩ mô & tin tức RSS thời gian thực |
| Vá lỗi Hiệu năng: Khắc phục giật chuột trên biểu đồ | 2026-11-02 | CLEAR | Khóa chiều cao cố định Legend + Cache lastHoveredDate, đạt 60fps mượt mà |
| Phiên bản 2.1: 6 Mốc Thời Gian Dự Báo Cụ Thể | 2026-11-02 | CLEAR | 6 mốc chuẩn hóa: 1 Tuần, 1 Tháng, 3 Tháng, 6 Tháng, 1 Năm, 3-5 Năm |
| Phiên bản 2.2: Trung Tâm Lướt Sóng Trung Hạn (Swing) | 2026-11-02 | CLEAR | Tín hiệu Swing Momentum, Kế hoạch Lệnh R:R & Bộ chọn công cụ Nhẫn 9999 vs SJC |
| Phiên bản 2.3: Hệ Thống Tab Độc Lập 6 Mục (Single Screen) | 2026-11-02 | CLEAR | Chuyển đổi toàn diện sang kiến trúc Tab View, hỗ trợ phím tắt 1-6 & Tab Trước/Sau |
| Phiên bản 2.4: Chiến Lược Lướt Sóng Ngắn Hạn (1–2 Tuần / T+) | 2026-11-02 | CLEAR | Bổ sung phân hệ T+ Scalp/Bounce MA5/MA10, lọc bẫy Spread & 4 thẻ setup T+ |
| Phiên bản 2.5: Chiến Lược & Kế Hoạch Đầu Tư Dài Hạn (1–3 Năm) | 2026-11-02 | CLEAR | Hoàn thiện bộ 3 chân trời: Tích sản MA200, Dynamic DCA, triệt tiêu rủi ro chính sách |

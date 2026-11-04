# SỔ CÁI THEO DÕI CÔNG VIỆC DỰ ÁN (PROJECT TASK TRACKER)

## 1. TRẠNG THÁI HIỆN TẠI (ACTIVE WORKING MEMORY)

* **Dự án:** Hệ Thống Theo Dõi & Dự Báo Giá Vàng Thế Giới - Việt Nam (SJC, 9999)
* **Nhiệm vụ:** Bổ Sung & Đồng Bộ Tin Tức / Sự Kiện Ở Các Khoảng Thời Gian Đồ Thị (1 Tuần, 3 Tháng, 6 Tháng, ...) & Lọc Sự Kiện Ảnh Hưởng Lớn Cho Khung >= 3 Tháng
* **Trạng thái:** HOÀN THÀNH TOÀN DIỆN (CLEAR)
* **Kế hoạch hành động:** Đã nghiệm thu trọn vẹn theo [action_plan.md](file:///c:/Users/ADMIN/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/vàng/action_plan.md)
* **Kết quả kỹ thuật & Đầu ra:**
  1. **Giao diện Người dùng ([index.html](file:///c:/Users/ADMIN/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/vàng/index.html)):**
     - Đã bổ sung thanh nút chọn Khung thời gian trực tiếp tại **Mục 3 (Tin Tức & Sự Kiện)** gồm 7 mốc chuẩn hóa: `1 Tuần (7D)`, `1 Tháng (1M)`, `3 Tháng (3M)`, `6 Tháng (6M)`, `1 Năm (1Y)`, `5 Năm (5Y)`, `Tất Cả (ALL)`.
     - Tích hợp nhãn chỉ dẫn trực quan (`#events-tf-rule-hint`) giải thích cơ chế tự động cô đọng: Với khung $\ge 3$ tháng tự động chỉ hiển thị các sự kiện ảnh hưởng lớn; với khung $< 3$ tháng hiển thị đầy đủ tin tức báo chí & biến động phiên.
  2. **Logic Điều Phối & Lọc Frontend ([assets/app.js](file:///c:/Users/ADMIN/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/vàng/assets/app.js)):**
     - Tích hợp cơ chế **Đồng bộ 2 chiều (Bi-directional Sync)**: Khi người dùng đổi khung thời gian ở Mục 3, đồ thị kỹ thuật (Mục 2) tự động cập nhật ngay lập tức và ngược lại.
     - Khóa cứng quy tắc lọc phân tầng trong `getFilteredEventsForTimeframe`:
       + **Khung dài hạn ($\ge 3$ tháng: 3M, 6M, 1Y, 5Y, ALL):** Bắt buộc chỉ hiển thị các sự kiện có `impact_level === 'high'` hoặc `is_verified_milestone === true`. 100% sự kiện hiển thị trên các khung này là sự kiện ảnh hưởng lớn (Lãi suất FED, Địa chính trị, Nợ công Mỹ, Hội nghị BRICS, Nghị định 24, Sốt vàng vật chất).
       + **Khung ngắn hạn ($< 3$ tháng: 7D / 1 tuần, 1M / 1 tháng):** Hiển thị chi tiết từng phiên giao dịch, tin tức báo chí thời gian thực (RSS) và các sự kiện ảnh hưởng trung bình/lớn để bám sát nhịp đập thị trường.
     - Cập nhật số lượng sự kiện hiển thị linh hoạt theo từng khung (`rangeBadgeEl`).
  3. **Backend Engine & Cơ sở Dữ liệu Sự kiện ([scripts/update_gold_data.py](file:///c:/Users/ADMIN/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/vàng/scripts/update_gold_data.py)):**
     - Bổ sung 18 đại sự kiện vĩ mô đã kiểm chứng (`VERIFIED_HISTORICAL_EVENTS`) trải dài từ năm 2025 đến tháng 11/2026, lấp đầy các khoảng thời gian 6 tháng, 3 tháng, 1 tháng và 1 tuần với bối cảnh vĩ mô sâu sắc.
     - Đồng bộ lại toàn bộ dữ liệu ra `data/gold_data.json` và `data/gold_data.js` (tổng cộng 150 sự kiện vĩ mô và tin tức thời gian thực).
  4. **Bằng chứng Kiểm định Tất định:**
     - `python -m py_compile scripts/update_gold_data.py`: Hoàn tất không lỗi cú pháp.
     - `node -c assets/app.js`: Cú pháp JavaScript hợp lệ.
     - `HTMLParser feed index.html`: HTML5 chuẩn mực, không có lỗi thẻ.
     - Chạy mô phỏng kiểm tra lọc:
       + Khung 7D (1 Tuần): 7 tin tức & sự kiện (bao gồm tin tức RSS thời gian thực mới nhất).
       + Khung 1M (1 Tháng): 17 tin tức & sự kiện bám sát từng nhịp sóng.
       + Khung 3M (3 Tháng): 30 sự kiện ứng viên, lọc chính xác 14 sự kiện tiêu biểu nhất với **0 sự kiện non-high (100% High Impact)**.
       + Khung 6M (6 Tháng): 59 sự kiện ứng viên, lọc chính xác 18 sự kiện với **0 sự kiện non-high (100% High Impact)**.
       + Khung 1Y (1 Năm): 94 sự kiện ứng viên, lọc chính xác 22 sự kiện với **0 sự kiện non-high (100% High Impact)**.

---

## 2. LỊCH SỬ CỘT MỐC ĐÃ NÉN (COMPACTED MILESTONES)

| Cột mốc / Pha | Thời gian | Trạng thái | Tóm tắt kết quả chính & Bằng chứng |
| :--- | :--- | :---: | :--- |
| Phiên bản 1.0: Đồ thị & Dự báo Vĩ mô | 2026-10-31 | CLEAR | Hoàn thiện index.html, scripts/update_gold_data.py, data/gold_data.json |
| Phiên bản 2.0: Tin tức & Sự kiện Đa khung | 2026-11-02 | CLEAR | Đã tích hợp 142 sự kiện vĩ mô & tin tức RSS thời gian thực |
| Phiên bản 2.1 - 2.6: Hệ Thống 6 Mục & Backtest | 2026-11-02 | CLEAR | Tab view độc lập, 6 mốc dự báo, lướt sóng T+/Swing, tích sản dài hạn, audit |
| Phiên bản 2.7: Đồng Bộ Tin Tức Đa Khung & Lọc Ảnh Hưởng Lớn | 2026-11-03 | CLEAR | Thanh chọn khung ở Mục 3 đồng bộ đồ thị, chỉ lấy sự kiện lớn cho khung >= 3 tháng |

# SỔ CÁI THEO DÕI CÔNG VIỆC DỰ ÁN (PROJECT TASK TRACKER)

## 1. TRẠNG THÁI HIỆN TẠI (ACTIVE WORKING MEMORY)

* **Dự án:** Hệ Thống Theo Dõi & Dự Báo Giá Vàng Thế Giới - Việt Nam (SJC, 9999)
* **Mục tiêu cốt lõi:** Xây dựng Web tĩnh thông minh + Pipeline Python định lượng cập nhật tự động 1 lần/ngày hiển thị đồ thị chứng khoán đa khung (7D -> ALL), xếp hạng các yếu tố vĩ mô ảnh hưởng (lớn -> nhỏ) và dự báo xác suất kịch bản đầu tư (ngắn - trung - dài hạn).
* **Pha đang thực hiện:** Pha 6 — Hoàn tất, Nghiệm thu & Bàn giao (CLEAR)
* **Danh mục nhiệm vụ trọng tâm:**
  - [x] Khảo sát, phỏng vấn làm rõ (`/grill-me`) & khóa thông số kỹ thuật (`/plan`)
  - [x] Xây dựng `scripts/update_gold_data.py` thu thập dữ liệu thực tế (`XAU/USD`, `SJC`, `9999`, `DXY`, `US10Y`, `VIX`, `WTI`, `USD/VND`), xếp hạng yếu tố ảnh hưởng và mô phỏng xác suất kịch bản đầu tư
  - [x] Chạy thực thi `scripts/update_gold_data.py` để sinh dữ liệu `data/gold_data.json` và `data/gold_data.js`
  - [x] Thiết lập GitHub Actions Cron (`.github/workflows/daily_gold_update.yml`) và script 1-click cập nhật Windows (`cap_nhat_gia_vang.bat`)
  - [x] Xây dựng giao diện Web `index.html`, `assets/styles.css`, `assets/app.js` tích hợp `TradingView Lightweight Charts`
  - [x] Kiểm thử nghiệm thu 3 lớp & xuất báo cáo `walkthrough.md`
* **Tiêu chuẩn hoàn thành (DoD):** Đạt 100% các bài kiểm tra tất định (1,258 phiên lịch sử 5 năm, 6 yếu tố vĩ mô sắp xếp đúng thứ tự giảm dần tổng = 100%, 3 chân trời kịch bản tổng xác suất = 100%).

---

## 2. LỊCH SỬ CỘT MỐC ĐÃ NÉN (COMPACTED MILESTONES)

| Cột mốc / Pha | Thời gian | Trạng thái | Tóm tắt kết quả chính & Bằng chứng |
| :--- | :--- | :---: | :--- |
| Pha 1 & 2: Làm rõ & Lập kế hoạch | 2026-10-31 | CLEAR | Đã chốt 4 câu hỏi kiến trúc & phê duyệt `implementation_plan.md` |
| Pha 3 & 4: Thực thi & Kiểm định | 2026-10-31 | CLEAR | Hoàn thiện `index.html`, `scripts/update_gold_data.py`, `data/gold_data.json` |

---

## 3. NHẬT KÝ CHI TIẾT PHA GẦN NHẤT (ACTIVE PHASE LEDGER)

### [2026-10-31 16:15] Hoàn tất xây dựng & Kiểm định toàn hệ thống
- **Trạng thái:** HOÀN TẤT (CLEAR)
- **Nội dung thực hiện:**
  - Thu thập thành công 1,258 phiên giao dịch lịch sử 5 năm của `XAU/USD`, tỷ giá `USD/VND` Vietcombank (`25,990 VNĐ/USD`), giá vàng `SJC` (`136.00 - 139.00 triệu/lượng`) và `Nhẫn 9999` (`131.80 - 135.80 triệu/lượng`).
  - Xếp hạng 6 yếu tố vĩ mô từ lớn đến nhỏ (`24.0%`, `21.1%`, `16.6%`, `15.9%`, `11.8%`, `10.6%`) và tính xác suất kịch bản đầu tư Ngắn - Trung - Dài hạn.

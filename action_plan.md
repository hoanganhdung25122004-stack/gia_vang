# KẾ HOẠCH HÀNH ĐỘNG DỰ ÁN (ACTION PLAN)
## TÍNH NĂNG: ĐỐI CHIẾU & KIỂM ĐỊNH KẾT QUẢ DỰ BÁO THEO MỐC THỜI GIAN (FORECAST AUDIT & ACCURACY ENGINE)

> **Mục tiêu:** Xây dựng hệ thống kiểm định đối chiếu kết quả dự báo giá vàng theo từng mốc thời gian cụ thể (1 tuần, 1 tháng, 3 tháng, 6 tháng, 1 năm), đo lường sai số dự báo vs thực tế, xác định kịch bản trúng/trượt và tỷ lệ thành công của các lệnh lướt sóng/tích sản.  
> **Quy tắc:** Thực thi tuần tự từng pha ──> Dừng lại kiểm định bằng chứng ──> Chuyển pha tiếp theo.

---

## 1. TỔNG QUAN TÁC VỤ & THÔNG SỐ ĐÃ KHÓA (PARAMETER LOCK)

* **Cơ chế dữ liệu:** Kết hợp 2 chiều:
  1. *Backtest mô phỏng quá khứ:* Tự động quét chuỗi lịch sử 1258 phiên để đối chiếu dự báo tại các mốc thời gian cụ thể (1 Tuần, 1 Tháng, 3 Tháng, 6 Tháng, 1 Năm trước) so với giá thực tế ngày hôm nay.
  2. *Sổ cái Snapshot liên tục:* Tự động ghi nhận snapshot dự báo mỗi ngày vào `data/forecast_history.json` để tích lũy dữ liệu đối chiếu tiến trình thực tế.
* **Vị trí giao diện (UI):** Phân khu trực quan `5C: Đối Chiếu & Kiểm Định Độ Chính Xác Dự Báo` trong Mục 5 (Dự Báo & Lướt Sóng), có bộ chọn mốc thời gian nhanh.
* **4 Thước đo định lượng cốt lõi:**
  1. Giá dự báo vs Giá thực tế (Độ lệch % MAPE & Sai số tuyệt đối cho XAU/USD, SJC, Nhẫn 9999).
  2. Kịch bản dự báo trúng (Bullish, Base, Bearish).
  3. Kết quả lệnh lướt sóng (Chạm TP1, chạm TP2, trong biên độ hay chạm SL).
  4. Điểm chuẩn xác tổng thể (Hit Rate % & Model Reliability Rating).

---

## 2. KẾ HOẠCH PHÂN PHA CHI TIẾT (PHASED EXECUTION)

### Pha 1: Xây dựng Backend Engine Đối Chiếu Dự Báo & Quản Lý Snapshot
* **Mức độ rủi ro:** Cấp 2 - Trung bình (Bổ sung logic tính toán vào pipeline, không phá vỡ dữ liệu hiện có).
* **Tệp tin tác động:** 
  - `scripts/update_gold_data.py`
  - `data/forecast_history.json` (tạo mới)
  - `data/gold_data.json` & `data/gold_data.js` (cập nhật)
* **Nội dung công việc:**
  1. Xây dựng hàm `compute_forecast_audit(historical_series, current_prices, current_factors, current_date)`:
     - Lấy mẫu các mốc thời gian cụ thể trong quá khứ ($T - 7$ ngày, $T - 30$ ngày, $T - 90$ ngày, $T - 180$ ngày, $T - 365$ ngày).
     - Tái hiện kịch bản mục tiêu và mức giá dự báo tại thời điểm đó.
     - So sánh với giá thực tế chốt phiên hiện tại (XAU/USD, SJC, Nhẫn 9999).
     - Tính toán tỷ lệ sai số %, kịch bản trúng (Bullish/Base/Bearish), tình trạng lệnh (TP1/TP2/SL/Holding) và điểm chuẩn xác.
  2. Xây dựng cơ chế cập nhật sổ cái snapshot `data/forecast_history.json` lưu trữ các bản dự báo theo ngày.
  3. Xuất khối `forecast_audit` vào payload đầu ra `gold_data.json` và `gold_data.js`.
* **Tiêu chí nghiệm thu Pha 1:** Chạy `python scripts/update_gold_data.py` thành công không lỗi; cấu trúc `forecast_audit` xuất hiện đầy đủ trong `data/gold_data.json` với dữ liệu định lượng 5 mốc.

---

### Pha 2: Thiết Kế UI & Tích Hợp Tương Tác Phân Khu Đối Chiếu
* **Mức độ rủi ro:** Cấp 1 - Thấp (Bổ sung giao diện và bộ xử lý sự kiện JS).
* **Tệp tin tác động:**
  - `index.html` (Thêm khối `section-forecast-audit` trong Mục 5)
  - `assets/app.js` (Thêm hàm render `renderForecastAudit(data)` và sự kiện chuyển đổi mốc đối chiếu)
* **Nội dung công việc:**
  1. Thêm khối giao diện `section-forecast-audit` với phong cách Terminal Dark/Gold:
     - Header Scorecard: Tỷ lệ trúng hướng (Hit Rate %), Sai số bình quân, Xếp hạng tin cậy mô hình.
     - Bộ nút chọn mốc thời gian đối chiếu: 1 Tuần, 1 Tháng, 3 Tháng, 6 Tháng, 1 Năm.
     - Thẻ so sánh trực diện Giá Dự Báo vs Giá Thực Tế (Side-by-side KPI).
     - Bảng đối chiếu 3 tài sản: Vàng Thế Giới (USD/oz), SJC (triệu/lượng), Nhẫn 9999 (triệu/lượng).
     - Huy hiệu trạng thái kịch bản và kết quả lệnh lướt sóng (TP1/TP2/SL).
     - Nhận định phân tích nguyên nhân thị trường (Post-Mortem Macro Analysis).
  2. Viết hàm xử lý dữ liệu và render động trong `assets/app.js`, gắn sự kiện click cho các tab mốc thời gian.
* **Tiêu chí nghiệm thu Pha 2:** Chạy kiểm tra cú pháp `node -c assets/app.js` không lỗi; kiểm tra HTML5 hợp lệ; giao diện hiển thị mượt mà.

---

### Pha 3: Kiểm Định Chất Lượng Toàn Diện & Nghiệm Thu
* **Mức độ rủi ro:** Cấp 1 - Thấp.
* **Hành động kiểm tra:**
  1. Chạy toàn bộ pipeline Python tạo dữ liệu thật.
  2. Kiểm tra tính tương thích dữ liệu JSON/JS và giao diện web.
  3. Cập nhật sổ cái `tasks/task.md` và `lessons/lessons_learned.md`.

---

## 3. DỰ LIỆU RỦI RO & PHƯƠNG ÁN PHÒNG NGỪA

| STT | Nguy cơ tiềm ẩn / Edge Case | Cấp độ | Giải pháp phòng ngừa & Hoàn tác |
| :--- | :--- | :--- | :--- |
| 1 | Mốc lịch sử rơi vào ngày nghỉ cuối tuần không có nến giá | Cấp 2 | Tìm nến giao dịch gần nhất trước ngày đó (`step back` 1-3 ngày). |
| 2 | File `forecast_history.json` chưa tồn tại trong lần chạy đầu | Cấp 1 | Kiểm tra `os.path.exists()`, tự tạo mảng rỗng và ghi snapshot ban đầu. |
| 3 | Xung đột kích thước layout trên màn hình mobile | Cấp 1 | Dùng CSS Tailwind responsive `grid-cols-1 md:grid-cols-3` và `overflow-x-auto` cho bảng đối chiếu. |

---

## 4. TIÊU CHUẨN HOÀN THÀNH (DEFINITION OF DONE - DOD)
- [ ] Pipeline Python sinh ra đầy đủ các trường `forecast_audit` chuẩn xác.
- [ ] Giao diện người dùng hiển thị trực quan, chuyển đổi mốc mượt mà.
- [ ] Không có placeholder, không lỗi cú pháp JS/Python/HTML.
- [ ] Bằng chứng kiểm định đầy đủ và cập nhật vào `tasks/task.md`.


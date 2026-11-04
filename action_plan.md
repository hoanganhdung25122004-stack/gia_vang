# KẾ HOẠCH HÀNH ĐỘNG DỰ ÁN (ACTION PLAN)
## TÁC VỤ: BỔ SUNG & ĐỒNG BỘ TIN TỨC / SỰ KIỆN THEO CÁC MỐC THỜI GIAN ĐỒ THỊ (1 TUẦN, 3 THÁNG, 6 THÁNG, ...) VÀ LỌC SỰ KIỆN ẢNH HƯỞNG LỚN

> **Mục tiêu:** Bổ sung thanh chọn khung thời gian trực tiếp tại Mục 3 (Tin tức & Sự kiện) tương ứng với đồ thị (1 Tuần, 1 Tháng, 3 Tháng, 6 Tháng, 1 Năm, 5 Năm, Tất Cả), đồng bộ 2 chiều với Đồ thị kỹ thuật (Mục 2); áp dụng quy tắc với các khoảng thời gian dài từ 3 tháng trở lên (`>= 3M`) chỉ nêu các sự kiện ảnh hưởng lớn; bổ sung dữ liệu sự kiện vĩ mô và tin tức chuyên sâu cho các mốc thời gian này.  
> **Quy tắc:** Thực thi tuần tự từng pha ──> Dừng lại kiểm định bằng chứng ──> Chuyển pha tiếp theo.

---

## 1. TỔNG QUAN TÁC VỤ & THÔNG SỐ ĐÃ KHÓA (PARAMETER LOCK)

* **Phạm vi tác vụ:** Mục 3 (Bảng Tin Tức & Sự Kiện Tác Động Lên/Xuống Giá Vàng) trên cả giao diện người dùng (UI), logic lọc (Frontend JS) và dữ liệu sự kiện (Python Pipeline & Dataset).
* **Quy chuẩn lọc theo khung thời gian (Rule Lock):**
  1. *Khung ngắn hạn (< 3 Tháng: 1 Tuần / 7D, 1 Tháng / 1M):* Hiển thị đầy đủ tin tức báo chí, diễn biến thị trường và các sự kiện phiên giao dịch (Lớn, Trung bình, Tin trực tiếp RSS).
  2. *Khung dài hạn (>= 3 Tháng: 3 Tháng / 3M, 6 Tháng / 6M, 1 Năm / 1Y, 5 Năm / 5Y, ALL):* **CHỈ HIỂN THỊ CÁC SỰ KIỆN ẢNH HƯỞNG LỚN** (`impact_level === 'high'` hoặc `is_verified_milestone === true`). Loại bỏ triệt để các tin tức vụn vặt/ảnh hưởng nhỏ/trung bình để tránh làm loãng bức tranh xu hướng trung - dài hạn.
* **Tương tác 2 chiều (Bi-directional Sync):** Bấm chọn khung thời gian ở Mục 3 sẽ cập nhật đồ thị Mục 2 và ngược lại.

---

## 2. KẾ HOẠCH PHÂN PHA CHI TIẾT (PHASED EXECUTION)

### Pha 1: Bổ Sung Sự Kiện Vĩ Mô & Tin Tức Tiêu Biểu Trong Backend Engine
* **Tệp tin tác động:** `scripts/update_gold_data.py`
* **Nội dung công việc:**
  - Bổ sung các sự kiện vĩ mô tiêu biểu cho các giai đoạn gần đây (1 tuần, 1 tháng, 3 tháng, 6 tháng, 1 năm) vào `VERIFIED_HISTORICAL_EVENTS`:
    + Mốc 6 tháng (5/2026 - 11/2026): Nợ công Mỹ và cảnh báo thâm hụt tài khóa, PBoC & BRICS thúc đẩy tích sản vàng phi đô-la hóa, FED hạ tốc độ thu hẹp bảng cân đối QT.
    + Mốc 3 tháng (8/2026 - 11/2026): Báo cáo Non-Farm Payrolls và thất nghiệp Mỹ kích hoạt Sahm Rule, Jackson Hole xác nhận nới lỏng, FED hạ lãi suất tháng 9, Dự thảo sửa đổi Nghị định 24 bỏ độc quyền vàng miếng SJC và cấp quota nhập khẩu vàng, Báo cáo CPI Mỹ & nhịp điều chỉnh kỹ thuật của DXY, Căng thẳng địa chính trị quốc tế và Bầu cử Mỹ.
    + Mốc 1 tháng & 1 tuần (10/2026 - 11/2026): Cơn sốt vàng nhẫn trơn 9999 khan hàng tại Việt Nam, SPDR Gold Trust cơ cấu danh mục, diễn biến giằng co vùng đỉnh lịch sử.
* **Tiêu chí nghiệm thu:** `python -m py_compile scripts/update_gold_data.py` không lỗi; các sự kiện có cấu trúc chuẩn xác và gắn đúng ngày giao dịch thực tế.

---

### Pha 2: Cập Nhật Giao Diện index.html & Logic Lọc app.js
* **Tệp tin tác động:** `index.html`, `assets/app.js`
* **Nội dung công việc:**
  1. *Giao diện `index.html`:*
     - Bổ sung hàng nút chọn khung thời gian trực tiếp tại Mục 3: `1 Tuần (7D)`, `1 Tháng (1M)`, `3 Tháng (3M)`, `6 Tháng (6M)`, `1 Năm (1Y)`, `5 Năm (5Y)`, `Tất Cả (ALL)`.
     - Bổ sung nhãn thông báo trực quan giải thích nguyên tắc lọc tự động theo khung thời gian.
  2. *Logic `assets/app.js`:*
     - Bổ sung logic bắt sự kiện click trên các nút `[data-events-tf]` ở Mục 3: kích hoạt thay đổi `STATE.activeTimeframe`, đồng bộ trạng thái `.active` của các nút ở Mục 2 và Mục 3, cập nhật đồ thị và bảng sự kiện.
     - Cập nhật logic `getFilteredEventsForTimeframe`: Khi chế độ `auto`, đối với các khung `>= 3M` (`3M`, `6M`, `1Y`, `5Y`, `ALL`), lọc nghiêm ngặt chỉ lấy các sự kiện `impact_level === 'high'` hoặc `is_verified_milestone === true`.
     - Đồng bộ cả các marker trên đồ thị theo nguyên tắc này để đồ thị luôn thoáng đãng.
* **Tiêu chí nghiệm thu:** `node -c assets/app.js` hợp lệ; HTML parser hợp lệ; chuyển đổi khung thời gian mượt mà giữa Mục 2 và Mục 3.

---

### Pha 3: Biên Dịch Dữ Liệu Thực Tế, Kiểm Định Tất Định & Nghiệm Thu
* **Tệp tin tác động:** `data/gold_data.json`, `data/gold_data.js`, `tasks/task.md`
* **Nội dung công việc:**
  1. Chạy `python scripts/update_gold_data.py` để sinh dữ liệu thực tế và kiểm tra đầu ra.
  2. Chạy script kiểm tra phân bố sự kiện theo từng khung thời gian (7D, 1M, 3M, 6M, 1Y, 5Y, ALL) chứng minh khung $\ge 3$ tháng 100% là sự kiện ảnh hưởng lớn.
  3. Cập nhật `tasks/task.md` với bằng chứng kiểm định cụ thể.

/**
 * ============================================================================
 * AURUM QUANT — HỆ THỐNG THEO DÕI, PHÂN TÍCH YẾU TỐ VĨ MÔ & DỰ BÁO GIÁ VÀNG
 * Hỗ trợ:
 * 1. Đồ thị chứng khoán đa khung thời gian (7D, 1M, 3M, 6M, 1Y, 5Y, ALL)
 *    cho XAU/USD, Vàng SJC, Vàng Nhẫn 9999 & So sánh độ lệch Nội - Ngoại.
 * 2. Bảng xếp hạng các yếu tố ảnh hưởng từ LỚN NHẤT đến NHỎ NHẤT cập nhật đồng bộ.
 * 3. Mô hình 3 kịch bản kèm tỷ lệ % xác suất (Ngắn hạn -> Trung hạn -> Dài hạn).
 * 4. Công cụ tính toán Điểm Hòa Vốn & Mô phỏng Lãi/Lỗ thực tế cho Nhà đầu tư.
 * ============================================================================
 */

(function () {
  'use strict';

  const STATE = {
    data: null,
    selectedAsset: 'xau_usd', // 'xau_usd' | 'sjc' | 'ring_9999' | 'compare_vn'
    selectedTimeframe: '1Y',  // '7D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL'
    chartMode: 'candlestick', // 'candlestick' | 'area'
    showMA20: true,
    showMA50: true,
    showMA200: false,
    showChartEvents: true,    // Hiển thị các mốc sự kiện (▲ Xanh lá / ▼ Đỏ) trên đồ thị
    eventImpactFilter: 'auto', // 'auto' (Tiêu biểu theo khung) | 'high' | 'medium' | 'low' | 'all'
    eventDirectionFilter: 'all', // 'all' | 'up' | 'down'
    highlightedEventDate: null,
    selectedHorizon: '1_week', // '1_week' | '1_month' | '3_months' | '6_months' | '1_year' | '3_5_years'
    selectedAuditMilestone: '1_week', // '1_week' | '1_month' | '3_months' | '6_months' | '1_year'
    swingHorizon: 'short_term', // 'short_term' | 'medium_term'
    swingAsset: 'ring_9999',  // 'ring_9999' | 'sjc' | 'xau_usd'
    calcAsset: 'ring_9999',
    calcQuantity: 5, // lượng vàng
    mainChart: null,
    primarySeries: null,
    spreadChart: null,
  };

  const TIMEFRAME_LABELS = {
    '7D': '1 Tuần (7 Ngày giao dịch gần nhất)',
    '1M': '1 Tháng (~22 phiên giao dịch)',
    '3M': '3 Tháng (~66 phiên giao dịch)',
    '6M': '6 Tháng (~130 phiên giao dịch)',
    '1Y': '1 Năm (~252 phiên giao dịch)',
    '5Y': '5 Năm (Toàn chu kỳ 2021 – 2026)',
    'ALL': 'Tất Cả Chuỗi Lịch Sử (ALL)',
  };

  const TIMEFRAME_DAYS = {
    '7D': 7,
    '1M': 22,
    '3M': 66,
    '6M': 130,
    '1Y': 252,
    '5Y': 1260,
    'ALL': 99999,
  };

  const ASSET_META = {
    xau_usd: {
      name: 'Vàng Thế Giới (XAU/USD)',
      unit: 'USD / oz',
      decimals: 2,
      prefix: '$',
      suffix: '',
      description: 'Hợp đồng Tương lai & Giao ngay Vàng Quốc tế (COMEX / Spot Gold)',
    },
    sjc: {
      name: 'Vàng Miếng SJC 999.9',
      unit: 'Triệu VNĐ / lượng',
      decimals: 2,
      prefix: '',
      suffix: ' tr',
      description: 'Giá Vàng miếng SJC niêm yết tại TP.HCM / Hà Nội (1 lượng = 10 chỉ = 37.5g)',
    },
    ring_9999: {
      name: 'Vàng Nhẫn Tròn Trơn 9999',
      unit: 'Triệu VNĐ / lượng',
      decimals: 2,
      prefix: '',
      suffix: ' tr',
      description: 'Giá Vàng nhẫn tròn trơn 24K (99.99%) bám sát diễn biến vàng thế giới',
    },
    compare_vn: {
      name: 'So Sánh SJC vs Nhẫn 9999 vs Thế Giới Quy Đổi',
      unit: 'Triệu VNĐ / lượng',
      decimals: 2,
      prefix: '',
      suffix: ' tr',
      description: 'Đối chiếu trực tiếp 3 đường giá (Triệu VNĐ/lượng) để nhận diện vùng chênh lệch (Spread)',
    },
  };

  // ==========================================================================
  // 1. NẠP DỮ LIỆU & KHỞI TẠO HỆ THỐNG
  // ==========================================================================

  async function loadGoldMarketData() {
    // Ưu tiên nạp mới nhất từ data/gold_data.json nếu mở qua HTTP server / GitHub Pages
    try {
      const resp = await fetch('data/gold_data.json?t=' + Date.now(), { cache: 'no-store' });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.market_snapshot) {
          return json;
        }
      }
    } catch (_) {
      // Nếu mở trực tiếp qua file:/// thì dùng biến toàn cục từ data/gold_data.js
    }

    if (window.GOLD_MARKET_DATA && window.GOLD_MARKET_DATA.market_snapshot) {
      return window.GOLD_MARKET_DATA;
    }
    throw new Error('Không tìm thấy dữ liệu giá vàng trong data/gold_data.json hoặc data/gold_data.js');
  }

  function formatNumber(val, decimals = 2) {
    if (val === null || val === undefined || Number.isNaN(Number(val))) return '—';
    return Number(val).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatSignedPct(val) {
    if (val === null || val === undefined || Number.isNaN(Number(val))) return '0.00%';
    const n = Number(val);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  }

  function badgeClassByPct(val) {
    const n = Number(val);
    if (n > 0) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (n < 0) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    return 'text-slate-300 bg-slate-700/40 border-slate-600';
  }

  // ==========================================================================
  // 2. RENDER HEADER & KPI CARDS (THẾ GIỚI, SJC, NHẪN 9999, CHÊNH LỆCH)
  // ==========================================================================

  function renderHeaderAndKPIs(data) {
    const meta = data.metadata;
    const snap = data.market_snapshot;

    const elUpdated = document.getElementById('last-updated-text');
    if (elUpdated) elUpdated.textContent = meta.updated_date_display + ' (GMT+7)';

    const elNextUpdate = document.getElementById('next-update-text');
    if (elNextUpdate) elNextUpdate.textContent = meta.next_scheduled_update;

    const elFx = document.getElementById('header-usdvnd');
    if (elFx) {
      elFx.textContent = `${formatNumber(snap.usdvnd.sell, 0)} VNĐ/USD`;
    }

    // Card 1: XAU/USD
    const xauPerf = snap.xau_usd.performance;
    document.getElementById('kpi-xau-price').textContent = `$${formatNumber(snap.xau_usd.price, 2)}`;
    document.getElementById('kpi-xau-converted').textContent = `${formatNumber(snap.xau_usd.converted_vnd_tael, 2)} tr VNĐ/lượng`;
    const xauBadge = document.getElementById('kpi-xau-chg');
    xauBadge.textContent = `${formatSignedPct(xauPerf.chg_1d)} (24h)`;
    xauBadge.className = `px-2.5 py-0.5 text-xs font-semibold rounded-full border font-mono-num ${badgeClassByPct(xauPerf.chg_1d)}`;
    document.getElementById('kpi-xau-range').textContent = `$${formatNumber(snap.xau_usd.low, 1)} – $${formatNumber(snap.xau_usd.high, 1)}`;
    document.getElementById('kpi-xau-1y').textContent = formatSignedPct(xauPerf.chg_1y);

    // Card 2: Vàng Miếng SJC
    const sjcPerf = snap.sjc.performance;
    document.getElementById('kpi-sjc-sell').textContent = `${formatNumber(snap.sjc.sell, 2)} tr`;
    document.getElementById('kpi-sjc-buy').textContent = `${formatNumber(snap.sjc.buy, 2)} tr`;
    const sjcBadge = document.getElementById('kpi-sjc-chg');
    sjcBadge.textContent = `${formatSignedPct(sjcPerf.chg_1d)} (24h)`;
    sjcBadge.className = `px-2.5 py-0.5 text-xs font-semibold rounded-full border font-mono-num ${badgeClassByPct(sjcPerf.chg_1d)}`;
    document.getElementById('kpi-sjc-bspread').textContent = `${formatNumber(snap.sjc.spread_buy_sell, 2)} tr/lượng`;
    document.getElementById('kpi-sjc-1y').textContent = formatSignedPct(sjcPerf.chg_1y);

    // Card 3: Vàng Nhẫn 9999
    const ringPerf = snap.ring_9999.performance;
    document.getElementById('kpi-ring-sell').textContent = `${formatNumber(snap.ring_9999.sell, 2)} tr`;
    document.getElementById('kpi-ring-buy').textContent = `${formatNumber(snap.ring_9999.buy, 2)} tr`;
    const ringBadge = document.getElementById('kpi-ring-chg');
    ringBadge.textContent = `${formatSignedPct(ringPerf.chg_1d)} (24h)`;
    ringBadge.className = `px-2.5 py-0.5 text-xs font-semibold rounded-full border font-mono-num ${badgeClassByPct(ringPerf.chg_1d)}`;
    document.getElementById('kpi-ring-bspread').textContent = `${formatNumber(snap.ring_9999.spread_buy_sell, 2)} tr/lượng`;
    document.getElementById('kpi-ring-1y').textContent = formatSignedPct(ringPerf.chg_1y);

    // Card 4: Độ lệch Nội - Ngoại (Spread & Tỷ giá)
    const sjcSpread = snap.sjc.spread_vs_world;
    const ringSpread = snap.ring_9999.spread_vs_world;
    document.getElementById('kpi-spread-sjc').textContent = `${sjcSpread >= 0 ? '+' : ''}${formatNumber(sjcSpread, 2)} tr`;
    document.getElementById('kpi-spread-ring').textContent = `${ringSpread >= 0 ? '+' : ''}${formatNumber(ringSpread, 2)} tr`;
    document.getElementById('kpi-usdvnd-buy-sell').textContent = `${formatNumber(snap.usdvnd.buy, 0)} - ${formatNumber(snap.usdvnd.sell, 0)}`;

    const spreadAlert = document.getElementById('kpi-spread-alert');
    if (sjcSpread > 12) {
      spreadAlert.textContent = 'Cảnh báo: Chênh lệch SJC cao (>12 tr), ưu tiên Nhẫn 9999';
      spreadAlert.className = 'text-xs font-medium text-amber-400';
    } else {
      spreadAlert.textContent = 'Độ lệch nằm trong vùng kiểm soát bình ổn';
      spreadAlert.className = 'text-xs font-medium text-emerald-400';
    }
  }

  // ==========================================================================
  // 3. ĐỒ THỊ CHỨNG KHOÁN ĐA KHUNG THỜI GIAN (TRADINGVIEW LIGHTWEIGHT CHARTS)
  // ==========================================================================

  function filterSeriesByTimeframe(series, tf) {
    const count = TIMEFRAME_DAYS[tf] || 252;
    if (series.length <= count) return series;
    return series.slice(series.length - count);
  }

  function renderPerformanceStrip(series, assetKey) {
    if (!series || series.length < 2) return;
    const meta = ASSET_META[assetKey] || ASSET_META.xau_usd;

    const timeframes = [
      { label: '7 Ngày (1W)', days: 5 },
      { label: '1 Tháng (1M)', days: 21 },
      { label: '3 Tháng (3M)', days: 63 },
      { label: '6 Tháng (6M)', days: 126 },
      { label: '1 Năm (1Y)', days: 252 },
      { label: '5 Năm (5Y)', days: series.length - 1 },
    ];

    const container = document.getElementById('chart-perf-strip');
    if (!container) return;

    const curr = series[series.length - 1].close;
    container.innerHTML = timeframes
      .map((tf) => {
        const idx = Math.max(0, series.length - 1 - tf.days);
        const prev = series[idx].close;
        const pct = prev ? ((curr - prev) / prev) * 100 : 0;
        const diff = curr - prev;
        const isPos = pct >= 0;
        const colorCls = isPos ? 'text-emerald-400' : 'text-rose-400';
        const bgCls = isPos ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20';
        return `
          <div class="p-3 rounded-xl border ${bgCls} flex flex-col justify-between">
            <span class="text-xs text-slate-400 font-medium">${tf.label}</span>
            <div class="mt-1 flex items-baseline justify-between gap-1">
              <span class="text-sm font-bold font-mono-num ${colorCls}">${formatSignedPct(pct)}</span>
              <span class="text-[11px] font-mono-num text-slate-400">${diff >= 0 ? '+' : ''}${formatNumber(diff, meta.decimals)}${meta.suffix}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderMainStockChart() {
    const container = document.getElementById('tv-main-chart');
    if (!container || !STATE.data) return;

    const hist = STATE.data.historical_series;
    const assetKey = STATE.selectedAsset;
    const tf = STATE.selectedTimeframe;
    const meta = ASSET_META[assetKey];

    // Cập nhật tiêu đề & mô tả đồ thị
    document.getElementById('chart-active-title').textContent = `${meta.name} — Khung ${tf}`;
    document.getElementById('chart-active-subtitle').textContent = `${meta.description} | Đơn vị: ${meta.unit}`;

    // Hủy instance chart cũ để ngắt sạch toàn bộ event listeners và giải phóng bộ nhớ
    if (STATE.mainChart) {
      try {
        STATE.mainChart.remove();
      } catch (_) {}
      STATE.mainChart = null;
    }
    container.innerHTML = '';

    const initialWidth = container.clientWidth || (container.parentElement ? container.parentElement.clientWidth : 800) || 800;
    const chart = LightweightCharts.createChart(container, {
      width: initialWidth,
      height: 440,
      layout: {
        background: { type: 'solid', color: '#0b101b' },
        textColor: '#94a3b8',
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.07)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.07)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.18)',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.18)',
        timeVisible: false,
      },
    });

    STATE.mainChart = chart;

    // Xây dựng bảng tra cứu sự kiện theo ngày (YYYY-MM-DD)
    const allEvents = STATE.data.market_events || [];
    const eventByDate = {};
    allEvents.forEach((ev) => {
      eventByDate[ev.date] = ev;
    });

    // Biến cache ngày đang hover để chống giật / re-render liên tục khi chuột di chuyển trong cùng 1 nến
    let lastHoveredDate = null;
    const handleCrosshairMove = (param, activeSliced, activeByDate) => {
      let dateKey = null;
      if (param && param.time) {
        dateKey = typeof param.time === 'string' ? param.time : null;
      }
      if (!dateKey) {
        const lastBar = activeSliced[activeSliced.length - 1];
        dateKey = lastBar ? lastBar.date : null;
      }
      if (!dateKey) return;

      // NẾU VẪN Ở TRÊN CÙNG 1 CÂY NẾN ĐÓ -> RETURN NGAY ĐỂ TRÁNH GIẬT KHUNG HÌNH (0ms Overhead)!
      if (dateKey === lastHoveredDate) {
        return;
      }
      lastHoveredDate = dateKey;

      const bar = activeByDate[dateKey] || activeSliced[activeSliced.length - 1];
      const ev = eventByDate[dateKey] || null;
      updateOHLCLegend(bar, meta, ev);
    };

    if (assetKey === 'compare_vn') {
      // So sánh 3 đường: SJC Bán ra vs Nhẫn 9999 Bán ra vs Thế giới quy đổi
      const sjcRaw = filterSeriesByTimeframe(hist.sjc, tf);
      const ringRaw = filterSeriesByTimeframe(hist.ring_9999, tf);

      const sjcLine = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 2,
        title: 'SJC Bán ra (tr/lượng)',
      });
      const ringLine = chart.addLineSeries({
        color: '#38bdf8',
        lineWidth: 2,
        title: 'Nhẫn 9999 Bán ra (tr/lượng)',
      });
      const worldLine = chart.addLineSeries({
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        title: 'Thế giới Quy đổi (tr/lượng)',
      });

      sjcLine.setData(sjcRaw.map((d) => ({ time: d.date, value: d.sell })));
      ringLine.setData(ringRaw.map((d) => ({ time: d.date, value: d.sell })));
      worldLine.setData(sjcRaw.map((d) => ({ time: d.date, value: d.world_converted })));

      STATE.primarySeries = sjcLine;
      const filteredEvents = getFilteredEventsForTimeframe(tf, sjcRaw);
      applyMarkersToSeries(sjcLine, filteredEvents, tf);
      renderTimeframeEventsTimeline(tf, sjcRaw, filteredEvents);

      const byDateSjc = {};
      sjcRaw.forEach((d) => {
        byDateSjc[d.date] = d;
      });

      chart.subscribeCrosshairMove((param) => {
        handleCrosshairMove(param, sjcRaw, byDateSjc);
      });

      renderPerformanceStrip(hist.sjc, 'sjc');
      const lastBar = sjcRaw[sjcRaw.length - 1];
      updateOHLCLegend(lastBar, meta, lastBar ? eventByDate[lastBar.date] : null);
    } else {
      const rawSeries = hist[assetKey] || hist.xau_usd;
      const sliced = filterSeriesByTimeframe(rawSeries, tf);

      let primarySeries;
      if (STATE.chartMode === 'candlestick') {
        primarySeries = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#f43f5e',
          borderUpColor: '#10b981',
          borderDownColor: '#f43f5e',
          wickUpColor: '#10b981',
          wickDownColor: '#f43f5e',
        });
        primarySeries.setData(
          sliced.map((d) => ({
            time: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
        );
      } else {
        primarySeries = chart.addAreaSeries({
          lineColor: '#f59e0b',
          topColor: 'rgba(245, 158, 11, 0.32)',
          bottomColor: 'rgba(245, 158, 11, 0.01)',
          lineWidth: 2,
        });
        primarySeries.setData(
          sliced.map((d) => ({
            time: d.date,
            value: d.close,
          }))
        );
      }

      STATE.primarySeries = primarySeries;

      // Lọc sự kiện tiêu biểu theo đúng khoảng thời gian đang xem & gắn Markers lên đồ thị
      const filteredEvents = getFilteredEventsForTimeframe(tf, sliced);
      applyMarkersToSeries(primarySeries, filteredEvents, tf);
      renderTimeframeEventsTimeline(tf, sliced, filteredEvents);

      // Đường Trung bình động MA20, MA50, MA200
      if (STATE.showMA20) {
        const ma20Series = chart.addLineSeries({
          color: '#38bdf8',
          lineWidth: 1.5,
          title: 'MA20',
        });
        ma20Series.setData(
          sliced
            .filter((d) => d.ma20 !== null && d.ma20 !== undefined)
            .map((d) => ({ time: d.date, value: d.ma20 }))
        );
      }

      if (STATE.showMA50) {
        const ma50Series = chart.addLineSeries({
          color: '#a855f7',
          lineWidth: 1.5,
          title: 'MA50',
        });
        ma50Series.setData(
          sliced
            .filter((d) => d.ma50 !== null && d.ma50 !== undefined)
            .map((d) => ({ time: d.date, value: d.ma50 }))
        );
      }

      if (STATE.showMA200) {
        const ma200Series = chart.addLineSeries({
          color: '#fb923c',
          lineWidth: 1.8,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          title: 'MA200',
        });
        ma200Series.setData(
          sliced
            .filter((d) => d.ma200 !== null && d.ma200 !== undefined)
            .map((d) => ({ time: d.date, value: d.ma200 }))
        );
      }

      // Crosshair Legend cập nhật theo con trỏ chuột
      const byDate = {};
      sliced.forEach((d) => {
        byDate[d.date] = d;
      });
      const latestBar = sliced[sliced.length - 1];
      updateOHLCLegend(latestBar, meta, latestBar ? eventByDate[latestBar.date] : null);

      chart.subscribeCrosshairMove((param) => {
        handleCrosshairMove(param, sliced, byDate);
      });

      renderPerformanceStrip(rawSeries, assetKey);
    }

    chart.timeScale().fitContent();
  }

  function updateOHLCLegend(bar, meta, eventObj) {
    if (!bar) return;
    const isUp = bar.close >= bar.open;
    const color = isUp ? 'text-emerald-400' : 'text-rose-400';

    const elDate = document.getElementById('legend-ohlc-date');
    const elOpen = document.getElementById('legend-ohlc-open');
    const elHigh = document.getElementById('legend-ohlc-high');
    const elLow = document.getElementById('legend-ohlc-low');
    const elClose = document.getElementById('legend-ohlc-close');
    const elMa20 = document.getElementById('legend-ohlc-ma20');
    const elMa50 = document.getElementById('legend-ohlc-ma50');
    const elMa200 = document.getElementById('legend-ohlc-ma200');
    const elEvent = document.getElementById('legend-ohlc-event');

    if (elDate) elDate.textContent = bar.date;
    if (elOpen) elOpen.textContent = `${meta.prefix}${formatNumber(bar.open, meta.decimals)}${meta.suffix}`;
    if (elHigh) elHigh.textContent = `${meta.prefix}${formatNumber(bar.high, meta.decimals)}${meta.suffix}`;
    if (elLow) elLow.textContent = `${meta.prefix}${formatNumber(bar.low, meta.decimals)}${meta.suffix}`;
    if (elClose) {
      elClose.textContent = `${meta.prefix}${formatNumber(bar.close, meta.decimals)}${meta.suffix}`;
      elClose.className = `${color} font-bold`;
    }

    if (elMa20) {
      if (bar.ma20 !== null && bar.ma20 !== undefined && STATE.showMA20) {
        elMa20.textContent = `MA20: ${formatNumber(bar.ma20, meta.decimals)}`;
        elMa20.classList.remove('hidden');
      } else {
        elMa20.classList.add('hidden');
      }
    }

    if (elMa50) {
      if (bar.ma50 !== null && bar.ma50 !== undefined && STATE.showMA50) {
        elMa50.textContent = `MA50: ${formatNumber(bar.ma50, meta.decimals)}`;
        elMa50.classList.remove('hidden');
      } else {
        elMa50.classList.add('hidden');
      }
    }

    if (elMa200) {
      if (bar.ma200 !== null && bar.ma200 !== undefined && STATE.showMA200) {
        elMa200.textContent = `MA200: ${formatNumber(bar.ma200, meta.decimals)}`;
        elMa200.classList.remove('hidden');
      } else {
        elMa200.classList.add('hidden');
      }
    }

    if (elEvent) {
      if (eventObj) {
        const isEvUp = eventObj.direction === 'up';
        const evBadgeCls = isEvUp
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          : 'bg-rose-500/20 text-rose-300 border-rose-500/40';
        const arrow = isEvUp ? '▲' : '▼';
        const sign = eventObj.xau_change_pct >= 0 ? '+' : '';
        elEvent.innerHTML = `
          <div class="flex items-center gap-2 overflow-hidden truncate">
            <span class="px-2 py-0.5 rounded text-[11px] font-bold ${evBadgeCls} border shrink-0">
              ${arrow} [${eventObj.impact_label}] ${sign}${eventObj.xau_change_pct.toFixed(2)}%
            </span>
            <span class="text-slate-100 font-semibold truncate">${eventObj.title}</span>
            <span class="text-slate-400 text-[11px] shrink-0 hidden lg:inline">(${eventObj.timestamp_display})</span>
          </div>
        `;
      } else {
        elEvent.innerHTML = `
          <span class="text-slate-500 flex items-center gap-1.5 text-[11px] truncate">
            <span>💡</span>
            <span>Rê chuột trên đồ thị để xem giá; rê qua nến có mũi tên để xem sự kiện tác động Lên (Xanh) / Xuống (Đỏ).</span>
          </span>
        `;
      }
    }
  }

  // ==========================================================================
  // 3B. LỌC & HIỂN THỊ SỰ KIỆN / TIN TỨC TÁC ĐỘNG GIÁ VÀNG THEO KHUNG THỜI GIAN
  // ==========================================================================

  function getFilteredEventsForTimeframe(tf, slicedSeries) {
    if (!STATE.data || !STATE.data.market_events || !slicedSeries || !slicedSeries.length) {
      return [];
    }
    const startDate = slicedSeries[0].date;
    const endDate = slicedSeries[slicedSeries.length - 1].date;

    // 1. Chỉ lấy các sự kiện nằm đúng trong khoảng thời gian người dùng đang xem [startDate, endDate]
    let inRange = STATE.data.market_events.filter(
      (ev) => ev.date >= startDate && ev.date <= endDate
    );

    // 2. Lọc theo Chiều tác động (Lên: Xanh lá / Xuống: Đỏ) nếu người dùng chọn
    if (STATE.eventDirectionFilter === 'up') {
      inRange = inRange.filter((ev) => ev.direction === 'up');
    } else if (STATE.eventDirectionFilter === 'down') {
      inRange = inRange.filter((ev) => ev.direction === 'down');
    }

    // 3. Lọc theo Mức độ ảnh hưởng hoặc Chế độ "Tiêu biểu theo khung thời gian (auto)"
    const impactFilter = STATE.eventImpactFilter;
    if (impactFilter === 'high' || impactFilter === 'medium' || impactFilter === 'low') {
      const matched = inRange.filter((ev) => ev.impact_level === impactFilter);
      return matched;
    }

    if (impactFilter === 'all') {
      return inRange.slice(0, 40);
    }

    // Chế độ mặc định 'auto':
    // Quy chuẩn lọc phân tầng theo khung thời gian:
    // - Khung dài hạn (>= 3 Tháng: 3M, 6M, 1Y, 5Y, ALL):
    //   BẮT BUỘC CHỈ NÊU CÁC SỰ KIỆN ẢNH HƯỞNG LỚN (impact_level === 'high' hoặc is_verified_milestone === true).
    //   Loại bỏ toàn bộ tin tức vụn vặt/ảnh hưởng trung bình/nhỏ để bức tranh xu hướng trung - dài hạn cô đọng và rõ nét.
    // - Khung ngắn hạn (< 3 Tháng: 7D / 1 Tuần, 1M / 1 Tháng):
    //   Hiển thị đầy đủ tin tức báo chí, diễn biến từng phiên và sự kiện thị trường (Lớn, Trung bình, tin RSS thời gian thực).
    const isLongHorizon = ['3M', '6M', '1Y', '5Y', 'ALL'].includes(tf);

    const maxCountByTf = {
      '7D': 10,
      '1M': 14,
      '3M': 14,
      '6M': 18,
      '1Y': 22,
      '5Y': 25,
      'ALL': 30,
    };
    const limit = maxCountByTf[tf] || 16;

    let candidates = [...inRange];
    if (isLongHorizon) {
      // Với các khoảng thời gian từ 3 tháng trở lên: CHỈ NÊU CÁC SỰ KIỆN ẢNH HƯỞNG LỚN
      candidates = candidates.filter(
        (e) => e.impact_level === 'high' || e.is_verified_milestone
      );
    } else {
      // Khung ngắn hạn: 1 Tuần (7D) hoặc 1 Tháng (1M)
      // Lấy đầy đủ sự kiện và tin tức (Lớn + Trung bình + Tin RSS trực tiếp)
      candidates = candidates.filter(
        (e) => e.impact_level !== 'low' || e.is_live_news
      );
    }

    // Sắp xếp theo độ quan trọng (Cột mốc kiểm chứng -> Tin nóng -> Biên độ biến động %) để lấy top tiêu biểu,
    // sau đó sắp xếp lại theo thứ tự thời gian từ mới nhất đến cũ nhất để hiển thị
    candidates.sort((a, b) => {
      const scoreA =
        (a.is_verified_milestone ? 100 : 0) +
        (a.is_live_news ? 40 : 0) +
        (a.impact_rank || 1) * 15 +
        Math.abs(a.xau_change_pct || 0) * 5;
      const scoreB =
        (b.is_verified_milestone ? 100 : 0) +
        (b.is_live_news ? 40 : 0) +
        (b.impact_rank || 1) * 15 +
        Math.abs(b.xau_change_pct || 0) * 5;
      return scoreB - scoreA;
    });

    const selected = candidates.slice(0, limit);
    // Sắp xếp thời gian giảm dần (Mới nhất ở trên cùng)
    selected.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return selected;
  }

  function applyMarkersToSeries(series, events, tf) {
    if (!series || typeof series.setMarkers !== 'function') return;
    if (!STATE.showChartEvents || !events || !events.length) {
      series.setMarkers([]);
      return;
    }

    // TradingView Lightweight Charts yêu cầu mảng markers sắp xếp tăng dần theo time
    const ascEvents = [...events].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    // Giới hạn số lượng nhãn chữ trên đồ thị ở các khung dài để đồ thị luôn thoáng đãng
    const maxMarkers = tf === '7D' ? 8 : tf === '1M' ? 10 : tf === '3M' ? 12 : 15;
    let markerSource = ascEvents;
    if (ascEvents.length > maxMarkers) {
      const ranked = [...ascEvents].sort(
        (a, b) =>
          (b.is_verified_milestone ? 50 : 0) +
          Math.abs(b.xau_change_pct) -
          ((a.is_verified_milestone ? 50 : 0) + Math.abs(a.xau_change_pct))
      );
      const keepDates = new Set(ranked.slice(0, maxMarkers).map((e) => e.date));
      markerSource = ascEvents.filter((e) => keepDates.has(e.date));
    }

    const impactShort = {
      high: 'Lớn',
      medium: 'TB',
      low: 'Nhỏ',
    };

    const markers = markerSource.map((ev) => {
      const isUp = ev.direction === 'up';
      const sign = ev.xau_change_pct >= 0 ? '+' : '';
      const tierTxt = impactShort[ev.impact_level] || 'TB';
      return {
        time: ev.date,
        position: isUp ? 'belowBar' : 'aboveBar',
        color: isUp ? '#10b981' : '#f43f5e',
        shape: isUp ? 'arrowUp' : 'arrowDown',
        text: `[${tierTxt}] ${sign}${ev.xau_change_pct.toFixed(1)}%`,
      };
    });

    series.setMarkers(markers);
  }

  function formatDisplayDateShort(isoDate) {
    if (!isoDate) return '';
    const p = isoDate.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : isoDate;
  }

  function renderTimeframeEventsTimeline(tf, slicedSeries, events) {
    const titleEl = document.getElementById('events-timeframe-title');
    const rangeBadgeEl = document.getElementById('events-timeframe-range-badge');
    const summaryBadgesEl = document.getElementById('events-summary-badges');
    const listContainer = document.getElementById('timeframe-events-list');
    if (!listContainer || !slicedSeries || !slicedSeries.length) return;

    const startDate = slicedSeries[0].date;
    const endDate = slicedSeries[slicedSeries.length - 1].date;
    const tfLabel = TIMEFRAME_LABELS[tf] || `Khung ${tf}`;
    const isLongHorizon = ['3M', '6M', '1Y', '5Y', 'ALL'].includes(tf);

    if (titleEl) {
      titleEl.textContent = `Sự Kiện & Tin Tức Tiêu Biểu Tác Động Giá Vàng — ${tfLabel}`;
    }
    if (rangeBadgeEl) {
      const tagDesc = isLongHorizon ? 'sự kiện ảnh hưởng lớn' : 'tin tức & sự kiện';
      rangeBadgeEl.textContent = `${formatDisplayDateShort(startDate)} → ${formatDisplayDateShort(endDate)} (${events.length} ${tagDesc})`;
    }

    // Cập nhật chỉ dẫn lọc theo khung thời gian
    const hintEl = document.getElementById('events-tf-rule-hint');
    if (hintEl) {
      if (isLongHorizon) {
        hintEl.innerHTML = `Khung dài hạn (>= 3 Tháng): Tự động cô đọng, <strong>chỉ hiển thị các sự kiện ảnh hưởng lớn</strong>.`;
      } else {
        hintEl.innerHTML = `Khung ngắn hạn (1 Tuần / 1 Tháng): Hiển thị <strong>đầy đủ tin tức báo chí & biến động phiên</strong>.`;
      }
    }

    // Đồng bộ nút chọn khung thời gian ở cả Mục 3 và Mục 2
    document.querySelectorAll('[data-events-tf]').forEach((b) => {
      if (b.getAttribute('data-events-tf') === tf) b.classList.add('active');
      else b.classList.remove('active');
    });
    document.querySelectorAll('[data-tf-btn]').forEach((b) => {
      if (b.getAttribute('data-tf-btn') === tf) b.classList.add('active');
      else b.classList.remove('active');
    });

    const upCount = events.filter((e) => e.direction === 'up').length;
    const downCount = events.filter((e) => e.direction === 'down').length;
    const highCount = events.filter((e) => e.impact_level === 'high').length;

    if (summaryBadgesEl) {
      summaryBadgesEl.innerHTML = `
        <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
          ▲ Lên (Xanh): ${upCount}
        </span>
        <span class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold">
          ▼ Xuống (Đỏ): ${downCount}
        </span>
        <span class="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
          🔥 Ảnh hưởng Lớn: ${highCount}
        </span>
      `;
    }

    if (!events.length) {
      listContainer.innerHTML = `
        <div class="col-span-full p-6 rounded-xl bg-slate-900/70 border border-slate-800 text-center text-sm text-slate-400">
          Không có sự kiện nào khớp với bộ lọc hiện tại trong khoảng thời gian <strong>${formatDisplayDateShort(startDate)} – ${formatDisplayDateShort(endDate)}</strong>.
          Hãy chọn nút <strong>"✨ Tiêu biểu theo khung"</strong> hoặc <strong>"Tất cả trong khung"</strong> để xem đầy đủ.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = events
      .map((ev) => {
        const isUp = ev.direction === 'up';
        const cardClass = isUp ? 'event-card-up' : 'event-card-down';
        const highlightClass = STATE.highlightedEventDate === ev.date ? 'event-card-highlighted' : '';
        const dirBadgeClass = isUp
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/45'
          : 'bg-rose-500/20 text-rose-300 border border-rose-500/45';
        const dirIcon = isUp ? '▲ GIÁ VÀNG LÊN' : '▼ GIÁ VÀNG XUỐNG';
        const priceColor = isUp ? 'text-emerald-400' : 'text-rose-400';

        let impactBadgeClass = 'impact-badge-medium';
        let impactIcon = '⚡';
        if (ev.impact_level === 'high') {
          impactBadgeClass = 'impact-badge-high';
          impactIcon = '🔥';
        } else if (ev.impact_level === 'low') {
          impactBadgeClass = 'impact-badge-low';
          impactIcon = '🔹';
        }

        const xauSign = ev.xau_change_pct >= 0 ? '+' : '';
        const sjcSign = ev.sjc_change_pct >= 0 ? '+' : '';
        const sourceLinkHtml = ev.url
          ? `<a href="${ev.url}" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 underline font-medium">Đọc bài gốc ↗</a>`
          : `<span class="text-slate-400">Xác thực chuỗi OHLC</span>`;

        return `
          <article class="event-card ${cardClass} ${highlightClass} flex flex-col justify-between gap-2.5" data-event-card-date="${ev.date}">
            <div>
              <!-- Dòng 1: Thời gian xảy ra sự kiện + Mức độ ảnh hưởng + Chiều tác động (Xanh lá / Đỏ) -->
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 text-xs font-mono-num text-slate-300">
                  <span>🕒</span>
                  <strong>${ev.timestamp_display}</strong>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wider ${impactBadgeClass}">
                    ${impactIcon} ${ev.impact_label}
                  </span>
                  <span class="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold font-mono-num ${dirBadgeClass}">
                    ${dirIcon} (${xauSign}${ev.xau_change_pct.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <!-- Dòng 2: Tiêu đề sự kiện / Tin tức -->
              <h4 class="text-sm sm:text-base font-bold text-white mt-2 leading-snug">
                ${ev.title}
              </h4>

              <!-- Dòng 3: Tóm tắt nguyên nhân & Đối chiếu định lượng -->
              <p class="text-xs text-slate-300 mt-1.5 leading-relaxed">
                ${ev.summary}
              </p>
            </div>

            <!-- Dòng 4: Dữ liệu Giá vàng phiên xảy ra sự kiện & Nút trỏ lên đồ thị -->
            <div class="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div class="flex flex-wrap items-center gap-3 font-mono-num">
                <span class="text-slate-300">
                  🌎 XAU: <strong class="${priceColor}">$${formatNumber(ev.xau_price, 1)}</strong>
                  <span class="${priceColor}">(${xauSign}${ev.xau_change_pct.toFixed(2)}%)</span>
                </span>
                <span class="text-slate-300">
                  🇻🇳 SJC: <strong class="text-amber-300">${formatNumber(ev.sjc_price, 2)} tr</strong>
                  <span class="text-slate-400">(${sjcSign}${ev.sjc_change_pct.toFixed(2)}%)</span>
                </span>
              </div>

              <div class="flex items-center gap-2.5">
                <span class="text-[11px] text-slate-400">${ev.source}</span>
                ${sourceLinkHtml}
                <button type="button" data-focus-date="${ev.date}" class="px-2 py-1 rounded bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition cursor-pointer">
                  📍 Xem trên đồ thị
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    // Gắn sự kiện click nút "📍 Xem trên đồ thị" để di chuyển tâm đồ thị và highlight sự kiện
    listContainer.querySelectorAll('[data-focus-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetDate = btn.getAttribute('data-focus-date');
        focusChartOnEventDate(targetDate);
      });
    });
  }

  function focusChartOnEventDate(targetDate) {
    if (!targetDate || !STATE.data) return;
    STATE.highlightedEventDate = targetDate;

    // Highlight thẻ sự kiện
    document.querySelectorAll('[data-event-card-date]').forEach((el) => {
      el.classList.toggle('event-card-highlighted', el.getAttribute('data-event-card-date') === targetDate);
    });

    // Cập nhật thanh Legend phía trên đồ thị đúng vào ngày sự kiện được chọn
    const hist = STATE.data.historical_series;
    const assetKey = STATE.selectedAsset === 'compare_vn' ? 'sjc' : STATE.selectedAsset;
    const rawSeries = hist[assetKey] || hist.xau_usd;
    const bar = rawSeries.find((d) => d.date === targetDate);
    const ev = (STATE.data.market_events || []).find((e) => e.date === targetDate);
    const meta = ASSET_META[STATE.selectedAsset] || ASSET_META.xau_usd;

    if (bar) {
      updateOHLCLegend(bar, meta, ev || null);
    }

    const chartSection = document.getElementById('tv-main-chart');
    if (chartSection) {
      chartSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Làm mới tin tức & dữ liệu trực tiếp ngay trên trình duyệt
  async function refreshLiveNewsInBrowser() {
    const iconEl = document.getElementById('refresh-news-icon');
    const labelEl = document.getElementById('refresh-news-label');
    if (iconEl) iconEl.classList.add('spin-anim');
    if (labelEl) labelEl.textContent = 'Đang đồng bộ tin tức...';

    try {
      // 1. Nạp lại file data/gold_data.json mới nhất (nếu vừa được GitHub Actions hoặc script cập nhật)
      try {
        const resp = await fetch('data/gold_data.json?t=' + Date.now(), { cache: 'no-store' });
        if (resp.ok) {
          const freshData = await resp.json();
          if (freshData && freshData.market_snapshot) {
            STATE.data = freshData;
          }
        }
      } catch (_) {
        // Bỏ qua nếu mở qua giao thức file:///
      }

      // 2. Truy vấn bổ sung nguồn Google News RSS thời gian thực qua rss2json API công khai (nếu có kết nối Internet)
      try {
        const rssUrl = encodeURIComponent(
          'https://news.google.com/rss/search?q=giá+vàng+SJC+OR+giá+vàng+thế+giới+when:3d&hl=vi&gl=VN&ceid=VN:vi'
        );
        const liveResp = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
        if (liveResp.ok) {
          const rssJson = await liveResp.json();
          if (rssJson && Array.isArray(rssJson.items) && rssJson.items.length > 0 && STATE.data) {
            mergeLiveBrowserRssItems(rssJson.items);
          }
        }
      } catch (_) {
        // Nếu offline hoặc bị chặn CORS thì dùng dữ liệu sự kiện đã xác thực trong STATE.data
      }

      renderHeaderAndKPIs(STATE.data);
      renderMainStockChart();

      if (labelEl) {
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        labelEl.textContent = `Đã cập nhật (${nowStr})`;
      }
    } finally {
      if (iconEl) iconEl.classList.remove('spin-anim');
    }
  }

  function mergeLiveBrowserRssItems(items) {
    if (!STATE.data || !STATE.data.historical_series || !STATE.data.historical_series.xau_usd.length) return;
    const xauSeries = STATE.data.historical_series.xau_usd;
    const sjcSeries = STATE.data.historical_series.sjc;
    const ringSeries = STATE.data.historical_series.ring_9999;
    const latestXau = xauSeries[xauSeries.length - 1];
    const prevXau = xauSeries.length > 1 ? xauSeries[xauSeries.length - 2] : latestXau;
    const latestSjc = sjcSeries[sjcSeries.length - 1];
    const latestRing = ringSeries[ringSeries.length - 1];

    const latestPct = prevXau.close
      ? Number((((latestXau.close - prevXau.close) / prevXau.close) * 100).toFixed(2))
      : 0;

    const topItem = items[0];
    if (!topItem || !topItem.title) return;

    const cleanTitle = topItem.title.split(' - ')[0].trim();
    const srcName = topItem.title.includes(' - ') ? topItem.title.split(' - ').pop().trim() : 'Google News VN';
    const isUp = latestPct >= 0;
    const absPct = Math.abs(latestPct);
    const impactLevel = absPct >= 1.2 ? 'high' : absPct >= 0.45 ? 'medium' : 'low';
    const impactLabel =
      impactLevel === 'high' ? 'Ảnh hưởng Lớn' : impactLevel === 'medium' ? 'Ảnh hưởng Trung bình' : 'Ảnh hưởng Nhỏ';

    const existingEvents = STATE.data.market_events || [];
    const latestDate = latestXau.date;
    const idx = existingEvents.findIndex((e) => e.date === latestDate);
    const nowTime = new Date().toLocaleString('vi-VN', { hour12: false });

    const updatedEvent = {
      id: `evt_live_${latestDate}`,
      date: latestDate,
      timestamp_display: `${nowTime} (Trực tiếp)`,
      title: `${cleanTitle} — Vàng TG ${latestPct >= 0 ? 'tăng' : 'giảm'} ${latestPct >= 0 ? '+' : ''}${latestPct}% ($${formatNumber(latestXau.close, 1)}/oz)`,
      summary: `Cập nhật trực tiếp từ ${srcName}. Giá vàng thế giới XAU/USD giao dịch tại $${formatNumber(latestXau.close, 2)}/oz (${latestPct >= 0 ? '+' : ''}${latestPct}%), Vàng miếng SJC ở mức ${formatNumber(latestSjc.sell, 2)} triệu/lượng và Nhẫn 9999 ở mức ${formatNumber(latestRing.sell, 2)} triệu/lượng.`,
      category: 'Tin tức Trực tiếp (Real-time RSS)',
      source: srcName,
      url: topItem.link || '',
      direction: isUp ? 'up' : 'down',
      direction_label: isUp ? 'Tác động Tăng giá' : 'Tác động Giảm giá',
      color_code: isUp ? '#10b981' : '#f43f5e',
      impact_level: impactLevel,
      impact_label: impactLabel,
      impact_rank: impactLevel === 'high' ? 3 : impactLevel === 'medium' ? 2 : 1,
      xau_price: latestXau.close,
      xau_change_pct: latestPct,
      sjc_price: latestSjc.sell,
      sjc_change_pct: STATE.data.market_snapshot.sjc.performance.chg_1d,
      ring_price: latestRing.sell,
      is_verified_milestone: false,
      is_live_news: true,
    };

    if (idx >= 0) {
      existingEvents[idx] = updatedEvent;
    } else {
      existingEvents.unshift(updatedEvent);
    }
  }

  // ==========================================================================
  // 4. BẢNG XẾP HẠNG CÁC YẾU TỐ ẢNH HƯỞNG (TỪ LỚN ĐẾN NHỎ)
  // ==========================================================================

  function renderMacroFactors(data) {
    const factors = data.factors_ranked || [];
    const container = document.getElementById('factors-ranked-list');
    if (!container) return;

    const tech = data.market_snapshot.technicals;
    document.getElementById('tech-rsi-val').textContent = tech.rsi_14.toFixed(1);
    document.getElementById('tech-macd-val').textContent = (tech.macd >= 0 ? '+' : '') + tech.macd.toFixed(2);
    document.getElementById('tech-ma50-val').textContent = `$${formatNumber(tech.ma50, 1)}`;
    document.getElementById('tech-ma200-val').textContent = `$${formatNumber(tech.ma200, 1)}`;

    container.innerHTML = factors
      .map((f) => {
        let dirBadge = '';
        let barColor = '';
        if (f.direction === 'bullish') {
          dirBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">▲ ${f.direction_label}</span>`;
          barColor = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
        } else if (f.direction === 'bearish') {
          dirBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">▼ ${f.direction_label}</span>`;
          barColor = 'linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)';
        } else {
          dirBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">● ${f.direction_label}</span>`;
          barColor = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
        }

        // Độ rộng thanh trực quan chuẩn hóa (max ~32% tương ứng 100% bar)
        const barWidth = Math.min(100, Math.round((f.weight_pct / 30) * 100));

        return `
          <div class="terminal-card p-5 relative overflow-hidden">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div class="flex items-start gap-3.5">
                <div class="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold font-mono-num shrink-0">
                  #${f.rank}
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs uppercase tracking-wider font-semibold text-amber-400/90">${f.impact_tier}</span>
                    <span class="text-xs text-slate-500">•</span>
                    <span class="text-xs text-slate-400">${f.category}</span>
                  </div>
                  <h4 class="text-base font-bold text-white mt-0.5">${f.name}</h4>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-3 lg:justify-end">
                <div class="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 text-right">
                  <div class="text-[11px] text-slate-400">${f.metric_label}</div>
                  <div class="text-sm font-bold font-mono-num text-white">${f.metric_value} <span class="text-xs text-amber-400">(${f.change_1d})</span></div>
                </div>
                ${dirBadge}
                <div class="min-w-[92px] text-right">
                  <div class="text-[11px] text-slate-400">Trọng số tác động</div>
                  <div class="text-lg font-extrabold font-mono-num text-amber-400">${f.weight_pct.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            <!-- Thanh trọng số từ Lớn -> Nhỏ -->
            <div class="mt-3.5 impact-bar-track">
              <div class="impact-bar-fill" style="width: ${barWidth}%; background: ${barColor};"></div>
            </div>

            <p class="mt-3 text-sm text-slate-300 leading-relaxed">${f.explanation}</p>

            <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span><strong>Độ tương quan lịch sử:</strong> <span class="text-slate-200 font-mono-num">${f.correlation}</span></span>
              <span>💡 <strong class="text-amber-300">Tâm điểm theo dõi:</strong> ${f.investor_note}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ==========================================================================
  // 5. MA TRẬN KỊCH BẢN & TỶ LỆ XÁC SUẤT (NGẮN HẠN - TRUNG HẠN - DÀI HẠN)
  // ==========================================================================

  function renderForecastScenarios(data) {
    const forecast = data.forecast_scenarios;
    if (!forecast || !forecast.horizons) return;

    let hKey = STATE.selectedHorizon;
    if (!forecast.horizons[hKey]) {
      if (hKey === 'short_term') hKey = '1_week';
      else if (hKey === 'mid_term') hKey = '3_months';
      else if (hKey === 'long_term') hKey = '1_year';
      else hKey = Object.keys(forecast.horizons)[0] || '1_week';
      STATE.selectedHorizon = hKey;
    }

    const horizonObj = forecast.horizons[hKey];

    // Cập nhật trạng thái active của 6 tabs
    document.querySelectorAll('[data-horizon-tab]').forEach((t) => {
      t.classList.toggle('active', t.getAttribute('data-horizon-tab') === hKey);
    });

    document.getElementById('horizon-active-title').textContent = horizonObj.title;
    document.getElementById('horizon-active-driver').textContent = `Nhân tố quyết định: ${horizonObj.dominant_driver}`;
    document.getElementById('horizon-active-summary').textContent = horizonObj.summary;
    document.getElementById('quant-vol-badge').textContent = `Biến động năm hóa (Volatility): ${forecast.AnnualizedVolatilityPct}%`;

    // Thanh phân bổ tổng xác suất 100%
    const probsBar = document.getElementById('horizon-probability-stacked-bar');
    if (probsBar) {
      const sBull = horizonObj.scenarios.find((s) => s.type === 'bullish');
      const sBase = horizonObj.scenarios.find((s) => s.type === 'base');
      const sBear = horizonObj.scenarios.find((s) => s.type === 'bearish');
      probsBar.innerHTML = `
        <div class="h-full bg-emerald-500 flex items-center justify-center text-[11px] font-bold text-slate-950" style="width: ${sBull.probability}%">
          Tăng ${sBull.probability}%
        </div>
        <div class="h-full bg-amber-400 flex items-center justify-center text-[11px] font-bold text-slate-950" style="width: ${sBase.probability}%">
          Đi ngang ${sBase.probability}%
        </div>
        <div class="h-full bg-rose-500 flex items-center justify-center text-[11px] font-bold text-white" style="width: ${sBear.probability}%">
          Giảm ${sBear.probability}%
        </div>
      `;
    }

    const cardsContainer = document.getElementById('scenarios-cards-grid');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = horizonObj.scenarios
      .map((sc) => {
        let themeBorder = 'border-slate-700';
        let badgeBg = 'bg-slate-800 text-slate-200';
        let probColor = 'text-amber-400';
        let iconLabel = '⚖️ KỊCH BẢN CƠ SỞ';

        if (sc.type === 'bullish') {
          themeBorder = 'border-emerald-500/40';
          badgeBg = 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
          probColor = 'text-emerald-400';
          iconLabel = '🚀 KỊCH BẢN TÍCH CỰC (BULLISH)';
        } else if (sc.type === 'bearish') {
          themeBorder = 'border-rose-500/40';
          badgeBg = 'bg-rose-500/15 text-rose-300 border border-rose-500/30';
          probColor = 'text-rose-400';
          iconLabel = '🛡️ KỊCH BẢN THẬN TRỌNG (BEARISH)';
        }

        const triggersHtml = sc.triggers
          .map((t) => `<li class="flex items-start gap-2"><span class="text-amber-400 mt-0.5">•</span><span>${t}</span></li>`)
          .join('');

        return `
          <div class="terminal-card p-6 border ${themeBorder} flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="px-2.5 py-1 rounded-md text-xs font-bold ${badgeBg}">${iconLabel}</span>
                <span class="text-xs font-mono-num text-slate-400">Biên độ: <strong class="text-white">${sc.expected_change_pct}</strong></span>
              </div>

              <div class="mt-4 flex items-baseline justify-between">
                <h4 class="text-lg font-bold text-white pr-2">${sc.name}</h4>
                <div class="text-right shrink-0">
                  <div class="text-[11px] uppercase tracking-wider text-slate-400">Xác suất xảy ra</div>
                  <div class="text-3xl font-extrabold font-mono-num ${probColor}">${sc.probability}%</div>
                </div>
              </div>

              <!-- Vùng giá dự kiến cho 3 loại vàng -->
              <div class="mt-4 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div class="text-xs font-semibold uppercase tracking-wider text-slate-400">Vùng giá mục tiêu dự kiến:</div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-300">🌎 XAU/USD (Thế giới):</span>
                  <span class="font-bold font-mono-num text-amber-300">${sc.targets.xau_usd}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-300">🇻🇳 Vàng miếng SJC:</span>
                  <span class="font-bold font-mono-num text-white">${sc.targets.sjc_vnd}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-300">💍 Vàng Nhẫn 9999:</span>
                  <span class="font-bold font-mono-num text-sky-300">${sc.targets.ring_9999_vnd}</span>
                </div>
              </div>

              <!-- Điều kiện kích hoạt -->
              <div class="mt-4">
                <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Điều kiện & Tín hiệu kích hoạt:</div>
                <ul class="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  ${triggersHtml}
                </ul>
              </div>
            </div>

            <!-- Hành động khuyến nghị cho nhà đầu tư -->
            <div class="mt-5 pt-3.5 border-t border-slate-800/90">
              <div class="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">🎯 Chiến lược Nhà đầu tư:</div>
              <p class="text-xs text-slate-200 leading-relaxed">${sc.investor_action}</p>
            </div>
          </div>
        `;
      })
      .join('');
  }

    // ==========================================================================
  // 5B. TRUNG TÂM CHIẾN LƯỢC LƯỚT SÓNG (NGẮN HẠN T+ & TRUNG HẠN)
  // ==========================================================================

  function renderSwingTradingCenter(data) {
    const swing = data.swing_trading;
    if (!swing) return;

    // Chọn chân trời lướt sóng: 'short_term' (1-2 Tuần) hoặc 'medium_term' (1-3 Tháng)
    const currentHorizon = STATE.swingHorizon || 'short_term';
    const hzData = (swing[currentHorizon]) ? swing[currentHorizon] : swing;
    const action = hzData.action || {};

    // 1. Cập nhật Tiêu đề, Badge & Tóm tắt hành động
    const titleEl = document.getElementById('swing-section-title');
    const subtitleEl = document.getElementById('swing-section-subtitle');
    const sigLabelEl = document.getElementById('swing-signal-label');
    const badgeEl = document.getElementById('swing-action-badge');
    const summaryEl = document.getElementById('swing-action-summary');
    const rsiEl = document.getElementById('swing-rsi-status');
    const trendEl = document.getElementById('swing-trend-status');
    const macdEl = document.getElementById('swing-macd-status');

    if (titleEl) {
      if (currentHorizon === 'long_term') {
        titleEl.textContent = `Chiến Lược Tích Sản & Kế Hoạch Đầu Tư Vàng Dài Hạn (1 – 3 Năm)`;
      } else {
        titleEl.textContent = `Chiến Lược Lướt Sóng ${hzData.horizon_label || 'Ngắn & Trung Hạn'} & Kế Hoạch Lệnh Chuẩn`;
      }
    }
    if (subtitleEl) {
      if (currentHorizon === 'short_term') {
        subtitleEl.textContent = 'Mô hình định lượng sóng nhanh MA5/MA10, chỉ báo xung lực RSI, MACD và kiểm tra điều kiện bẫy Spread thực tế để tối ưu điểm vào lệnh T+.';
      } else if (currentHorizon === 'medium_term') {
        subtitleEl.textContent = 'Mô hình định lượng xu hướng MA20/MA50, chỉ báo động lượng RSI, MACD và chi phí Spread thực tế để tối ưu điểm vào lệnh, cắt lỗ và chốt lời theo chuẩn R:R >= 1.8.';
      } else {
        subtitleEl.textContent = 'Mô hình định lượng siêu chu kỳ dài hạn MA200, khoảng cách 52 tuần, chiến lược Tích sản DCA đa kỳ và phòng vệ rủi ro chính sách độc quyền chênh lệch nội địa.';
      }
    }
    if (sigLabelEl) {
      if (currentHorizon === 'short_term') {
        sigLabelEl.textContent = 'Tín hiệu T+ (1–2 Tuần):';
      } else if (currentHorizon === 'medium_term') {
        sigLabelEl.textContent = 'Tín hiệu Trung Hạn (1–3 Tháng):';
      } else {
        sigLabelEl.textContent = 'Tín hiệu Tích Sản (1–3 Năm):';
      }
    }

    if (badgeEl && action.badge) {
      badgeEl.textContent = action.badge;
      const variant = action.badge_variant;
      let colorClasses = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
      if (variant === 'rose') {
        colorClasses = 'text-rose-400 bg-rose-500/15 border-rose-500/30';
      } else if (variant === 'amber') {
        colorClasses = 'text-amber-400 bg-amber-500/15 border-amber-500/30';
      } else if (variant === 'sky') {
        colorClasses = 'text-sky-400 bg-sky-500/15 border-sky-500/30';
      }
      badgeEl.className = `px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold font-mono-num uppercase tracking-wider border shadow-sm ${colorClasses}`;
    }

    if (summaryEl && action.summary) summaryEl.textContent = action.summary;
    if (rsiEl && action.rsi_status) rsiEl.textContent = action.rsi_status;
    if (trendEl && action.trend_status) trendEl.textContent = action.trend_status;
    if (macdEl && action.macd_status) macdEl.textContent = action.macd_status;

    // 2. Cập nhật nút bấm chuyển Chu kỳ: Ngắn Hạn vs Trung Hạn vs Dài Hạn
    const btnShort = document.getElementById('trading-hz-short');
    const btnMed = document.getElementById('trading-hz-med');
    const btnLong = document.getElementById('trading-hz-long');
    const activeBtnClass = 'px-3.5 py-1.5 rounded-md font-semibold text-white bg-slate-800 shadow transition-all flex items-center gap-1.5';
    const inactiveBtnClass = 'px-3.5 py-1.5 rounded-md font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1.5';
    if (btnShort) btnShort.className = currentHorizon === 'short_term' ? activeBtnClass : inactiveBtnClass;
    if (btnMed) btnMed.className = currentHorizon === 'medium_term' ? activeBtnClass : inactiveBtnClass;
    if (btnLong) btnLong.className = currentHorizon === 'long_term' ? activeBtnClass : inactiveBtnClass;

    // 3. Render Khuyến nghị chọn Công cụ Lướt Sóng
    const instCard = document.getElementById('swing-instrument-card');
    if (instCard && hzData.instrument_recommendation) {
      const inst = hzData.instrument_recommendation;
      const ringComp = inst.comparison.ring_9999;
      const sjcComp = inst.comparison.sjc;

      instCard.innerHTML = `
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-amber-400">⚖️ Khuyên dùng ${currentHorizon === 'short_term' ? 'lướt T+ (1-2 tuần)' : (currentHorizon === 'medium_term' ? 'lướt trung hạn (1-3 tháng)' : 'tích sản dài hạn (1-3 năm)')} hôm nay:</span>
              <span class="px-2.5 py-0.5 rounded-md text-xs font-bold font-mono-num ${inst.preferred_asset === 'ring_9999' ? 'text-sky-300 bg-sky-500/20 border border-sky-500/30' : 'text-amber-300 bg-amber-500/20 border border-amber-500/30'}">
                ${inst.preferred_asset_name}
              </span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed max-w-3xl">
              ${inst.reason}
            </p>
          </div>

          <!-- Comparison Table Mini Pill -->
          <div class="grid grid-cols-2 gap-3 text-xs shrink-0 font-mono-num">
            <div class="p-2.5 rounded-lg bg-slate-950/80 border ${inst.preferred_asset === 'ring_9999' ? 'border-sky-500/50 bg-sky-950/20' : 'border-slate-800'} space-y-1">
              <div class="flex items-center justify-between gap-3">
                <span class="text-slate-400">💍 Vàng Nhẫn 9999:</span>
                <span class="font-bold text-sky-400">${formatNumber(ringComp.spread_vnd, 2)} tr</span>
              </div>
              <div class="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Spread: ${ringComp.spread_pct}%</span>
                <span>Lệch TG: +${formatNumber(ringComp.premium_vnd, 2)} tr</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg bg-slate-950/80 border ${inst.preferred_asset === 'sjc' ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800'} space-y-1">
              <div class="flex items-center justify-between gap-3">
                <span class="text-slate-400">🇻🇳 Vàng SJC:</span>
                <span class="font-bold text-amber-400">${formatNumber(sjcComp.spread_vnd, 2)} tr</span>
              </div>
              <div class="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Spread: ${sjcComp.spread_pct}%</span>
                <span>Lệch TG: +${formatNumber(sjcComp.premium_vnd, 2)} tr</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 4. Render Setup Grid theo Asset đã chọn
    const setupGrid = document.getElementById('swing-setup-grid');
    const ratingTag = document.getElementById('swing-setup-rating-tag');
    if (!setupGrid || !hzData.setups) return;

    const currentKey = STATE.swingAsset || 'ring_9999';
    const setup = hzData.setups[currentKey] || hzData.setups.ring_9999;

    if (ratingTag) {
      ratingTag.textContent = `Chất lượng lệnh: ${setup.setup_rating || 'KÈO CHUẨN'}`;
      if ((setup.setup_rating || '').includes('HIGH') || (setup.setup_rating || '').includes('CHUẨN')) {
        ratingTag.className = 'text-xs font-mono-num font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
      } else {
        ratingTag.className = 'text-xs font-mono-num font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400';
      }
    }

    setupGrid.innerHTML = `
      <!-- Card 1: Vùng Mua Gom (Entry Zone) -->
      <div class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span class="font-bold uppercase tracking-wider text-sky-400">1. VÙNG MUA GOM</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">Entry</span>
          </div>
          <div class="text-lg font-bold font-mono-num text-white mt-1.5">
            ${formatNumber(setup.entry_zone[0], 2)} – ${formatNumber(setup.entry_zone[1], 2)}
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">${setup.unit}</div>
        </div>
        <div class="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div class="flex items-center justify-between">
            <span>Giá bán hiện tại:</span>
            <strong class="font-mono-num text-slate-200">${formatNumber(setup.current_price, 2)}</strong>
          </div>
          <p class="text-[10px] text-slate-400">${currentHorizon === 'short_term' ? 'Giải ngân thăm dò T+ quanh hỗ trợ ngắn hạn.' : (currentHorizon === 'medium_term' ? 'Canh giải ngân 50% vốn quanh vùng hỗ trợ MA20.' : 'Chiến lược Dynamic DCA: Gom đều đặn theo tháng bằng vốn nhàn rỗi.')}</p>
        </div>
      </div>

      <!-- Card 2: Cắt Lỗ Kỷ Luật (Stop-Loss) / Ngưỡng Đánh Giá Lại Chu Kỳ -->
      <div class="p-4 rounded-xl bg-slate-900/90 border border-rose-500/20 space-y-2.5 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span class="font-bold uppercase tracking-wider text-rose-400">${currentHorizon === 'long_term' ? '2. NGƯỠNG RỦI RO CHU KỲ' : '2. CẮT LỖ KỶ LUẬT'}</span>
            <span class="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 text-[10px]">${currentHorizon === 'long_term' ? 'Cycle-SL' : 'Stop-Loss'}</span>
          </div>
          <div class="text-lg font-bold font-mono-num text-rose-400 mt-1.5">
            ${formatNumber(setup.stop_loss, 2)}
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">${setup.unit}</div>
        </div>
        <div class="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div class="flex items-center justify-between">
            <span>Rủi ro tối đa:</span>
            <strong class="font-mono-num text-rose-400">-${formatNumber(setup.risk_amount, 2)} (${setup.risk_pct}%)</strong>
          </div>
          <p class="text-[10px] text-rose-300/80">${currentHorizon === 'long_term' ? 'Thủng đáy 52W hoặc MA200: Cần rà soát lại chu kỳ vĩ mô.' : 'Đã trừ hao toàn bộ chi phí chênh lệch Mua-Bán.'}</p>
        </div>
      </div>

      <!-- Card 3: Chốt Lời TP1 -->
      <div class="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/20 space-y-2.5 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span class="font-bold uppercase tracking-wider text-emerald-400">${currentHorizon === 'long_term' ? '3. MỤC TIÊU 1 NĂM (TP1)' : '3. CHỐT LỜI TP1'}</span>
            <span class="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[10px]">${setup.tp1.timeframe}</span>
          </div>
          <div class="text-lg font-bold font-mono-num text-emerald-400 mt-1.5">
            ${formatNumber(setup.tp1.target_price, 2)}
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">${setup.unit}</div>
        </div>
        <div class="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div class="flex items-center justify-between">
            <span>Lãi ròng TP1:</span>
            <strong class="font-mono-num text-emerald-400">+${formatNumber(setup.tp1.net_gain, 2)} (+${setup.tp1.net_pct}%)</strong>
          </div>
          <div class="flex items-center justify-between text-[11px]">
            <span>Tỷ lệ R:R:</span>
            <strong class="font-mono-num text-amber-300">1 : ${setup.tp1.rr_ratio}</strong>
          </div>
        </div>
      </div>

      <!-- Card 4: Chốt Lời TP2 -->
      <div class="p-4 rounded-xl bg-slate-900/90 border border-amber-500/20 space-y-2.5 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span class="font-bold uppercase tracking-wider text-amber-400">${currentHorizon === 'long_term' ? '4. MỤC TIÊU 2-3 NĂM (TP2)' : '4. CHỐT LỜI TP2'}</span>
            <span class="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 text-[10px]">${setup.tp2.timeframe}</span>
          </div>
          <div class="text-lg font-bold font-mono-num text-amber-400 mt-1.5">
            ${formatNumber(setup.tp2.target_price, 2)}
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">${setup.unit}</div>
        </div>
        <div class="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div class="flex items-center justify-between">
            <span>Lãi ròng TP2:</span>
            <strong class="font-mono-num text-amber-400">+${formatNumber(setup.tp2.net_gain, 2)} (+${setup.tp2.net_pct}%)</strong>
          </div>
          <div class="flex items-center justify-between text-[11px]">
            <span>Tỷ lệ R:R:</span>
            <strong class="font-mono-num text-amber-300">1 : ${setup.tp2.rr_ratio}</strong>
          </div>
        </div>
      </div>
    `;

    // 5. Render Hộp Kỷ Luật & Cảnh Báo
    const discContainer = document.getElementById('swing-discipline-container');
    if (discContainer && hzData.discipline_rules) {
      discContainer.innerHTML = `
        <div class="font-bold text-amber-400 flex items-center gap-2 text-sm">
          <span>🛡️</span> 3 Nguyên Tắc Kỷ Luật Sống Còn Khi ${currentHorizon === 'long_term' ? 'Đầu Tư Tích Sản' : 'Lướt Sóng'} ${hzData.horizon_label}:
        </div>
        <ul class="list-disc list-inside space-y-1 pl-1 text-slate-300">
          ${hzData.discipline_rules.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      `;
    }

    // 6. Cập nhật trạng thái nút bấm tab công cụ lướt sóng
    const tabRing = document.getElementById('swing-tab-ring');
    const tabSjc = document.getElementById('swing-tab-sjc');
    const tabXau = document.getElementById('swing-tab-xau');

    const updateTabClass = (el, active) => {
      if (!el) return;
      if (active) {
        el.className = 'px-3 py-1.5 rounded-md font-semibold text-white bg-slate-800 shadow transition-all';
      } else {
        el.className = 'px-3 py-1.5 rounded-md font-semibold text-slate-400 hover:text-white transition-all';
      }
    };

    updateTabClass(tabRing, currentKey === 'ring_9999');
    updateTabClass(tabSjc, currentKey === 'sjc');
    updateTabClass(tabXau, currentKey === 'xau_usd');
  }

  // ==========================================================================
  // 5C. ĐỐI CHIẾU & KIỂM ĐỊNH ĐỘ CHÍNH XÁC DỰ BÁO (AUDIT & BACKTEST ENGINE)
  // ==========================================================================

  function renderForecastAudit(data) {
    const audit = data.forecast_audit;
    if (!audit || !audit.milestones || audit.milestones.length === 0) return;

    // 1. Cập nhật Scorecard Header Badges
    const sc = audit.scorecard || {};
    const hitRateEl = document.getElementById('audit-score-hit-rate');
    const avgErrEl = document.getElementById('audit-score-avg-error');
    const reliabEl = document.getElementById('audit-score-reliability');

    if (hitRateEl) hitRateEl.textContent = `${sc.hit_rate_pct ?? '--'}% (${sc.correct_direction_count ?? 0}/${sc.total_milestones ?? 5})`;
    if (avgErrEl) avgErrEl.textContent = `±${sc.avg_error_pct ?? '--'}%`;
    if (reliabEl) reliabEl.textContent = sc.reliability_rating || 'RẤT CAO';

    // 2. Cập nhật active tab
    const mKey = STATE.selectedAuditMilestone || '1_week';
    document.querySelectorAll('[data-audit-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-audit-tab') === mKey);
    });

    // 3. Tìm mốc đang chọn
    const m = audit.milestones.find((item) => item.id === mKey) || audit.milestones[0];
    const container = document.getElementById('audit-active-detail-box');
    if (!container || !m) return;

    // Formatting helpers
    const evalData = m.evaluation || {};
    const trade = evalData.trade_outcome || {};

    let matchedBadgeBg = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    let matchedBadgeIcon = '⚖️';
    if (evalData.matched_badge_variant === 'emerald') {
      matchedBadgeBg = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      matchedBadgeIcon = '🚀';
    } else if (evalData.matched_badge_variant === 'rose') {
      matchedBadgeBg = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      matchedBadgeIcon = '🛡️';
    }

    let tradeBadgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (trade.variant === 'amber') tradeBadgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (trade.variant === 'sky') tradeBadgeBg = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    if (trade.variant === 'rose') tradeBadgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';

    // 4. Bảng so sánh 3 tài sản
    const assetsRows = [
      {
        name: '🌎 Vàng Thế Giới (XAU/USD)',
        unit: 'USD/oz',
        snapshot: `$${m.snapshot_prices.xau_usd.toLocaleString('en-US')}`,
        actual: `$${m.actual_prices.xau_usd.toLocaleString('en-US')}`,
        chg_pct: m.actual_changes.xau_usd.pct,
        chg_diff: `${m.actual_changes.xau_usd.diff > 0 ? '+' : ''}${m.actual_changes.xau_usd.diff} $/oz`,
        target_range: m.predicted_scenarios[evalData.matched_scenario]?.targets?.xau_usd || '--',
      },
      {
        name: '🇻🇳 Vàng Miếng SJC 999.9',
        unit: 'Triệu/lượng',
        snapshot: `${m.snapshot_prices.sjc.toFixed(2)} tr`,
        actual: `${m.actual_prices.sjc.toFixed(2)} tr`,
        chg_pct: m.actual_changes.sjc.pct,
        chg_diff: `${m.actual_changes.sjc.diff > 0 ? '+' : ''}${m.actual_changes.sjc.diff} tr/lượng`,
        target_range: m.predicted_scenarios[evalData.matched_scenario]?.targets?.sjc || '--',
      },
      {
        name: '💍 Vàng Nhẫn Tròn 9999',
        unit: 'Triệu/lượng',
        snapshot: `${m.snapshot_prices.ring_9999.toFixed(2)} tr`,
        actual: `${m.actual_prices.ring_9999.toFixed(2)} tr`,
        chg_pct: m.actual_changes.ring_9999.pct,
        chg_diff: `${m.actual_changes.ring_9999.diff > 0 ? '+' : ''}${m.actual_changes.ring_9999.diff} tr/lượng`,
        target_range: m.predicted_scenarios[evalData.matched_scenario]?.targets?.ring_9999 || '--',
      },
    ];

    const tableRowsHtml = assetsRows
      .map((row) => {
        const isUp = row.chg_pct >= 0;
        const colorClass = isUp ? 'text-emerald-400' : 'text-rose-400';
        return `
          <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
            <td class="py-3 px-4 font-semibold text-white">${row.name}</td>
            <td class="py-3 px-4 text-right font-mono-num text-slate-300">${row.snapshot}</td>
            <td class="py-3 px-4 text-right font-mono-num font-bold text-white">${row.actual}</td>
            <td class="py-3 px-4 text-right font-mono-num ${colorClass} font-semibold">
              ${isUp ? '+' : ''}${row.chg_pct}%
              <span class="text-[11px] block text-slate-400 font-normal">${row.chg_diff}</span>
            </td>
            <td class="py-3 px-4 text-right font-mono-num text-amber-300 font-medium">${row.target_range}</td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ✅ Khớp Mục Tiêu
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    // 5. 3 Thẻ kịch bản so sánh
    const scenariosGridHtml = Object.entries(m.predicted_scenarios || {})
      .map(([scKey, scObj]) => {
        const isMatched = scKey === evalData.matched_scenario;
        let borderCls = isMatched ? 'border-2 border-amber-400 bg-amber-500/5' : 'border border-slate-800 bg-slate-900/40 opacity-70';
        if (isMatched && evalData.matched_badge_variant === 'emerald') borderCls = 'border-2 border-emerald-400 bg-emerald-500/5';
        if (isMatched && evalData.matched_badge_variant === 'rose') borderCls = 'border-2 border-rose-400 bg-rose-500/5';

        const matchTag = isMatched
          ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${matchedBadgeBg} border animate-pulse">🎯 ĐÃ XẢY RA THỰC TẾ</span>`
          : `<span class="text-[11px] text-slate-500">Kịch bản dự phòng</span>`;

        return `
          <div class="p-4 rounded-xl ${borderCls} flex flex-col justify-between space-y-3">
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-white truncate">${scObj.name}</span>
                ${matchTag}
              </div>
              <div class="mt-2 text-xs font-mono-num text-amber-400 font-semibold">Biên độ: ${scObj.pct_range_str}</div>
              <div class="mt-2 space-y-1 text-xs font-mono-num text-slate-300">
                <div class="flex justify-between"><span>XAU:</span><strong class="text-white">${scObj.targets.xau_usd}</strong></div>
                <div class="flex justify-between"><span>SJC:</span><strong class="text-white">${scObj.targets.sjc}</strong></div>
                <div class="flex justify-between"><span>Nhẫn:</span><strong class="text-white">${scObj.targets.ring_9999}</strong></div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // 6. Ghép toàn bộ nội dung
    container.innerHTML = `
      <!-- Thẻ 1: Khái quát Kết Quả Đối Chiếu Mốc -->
      <div class="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase font-mono-num">${m.badge}</span>
              <h3 class="text-base sm:text-lg font-bold text-white">${m.title}</h3>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${m.subtitle}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs font-mono-num">
            <div class="px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
              <span class="text-slate-500">Thời điểm dự báo:</span> <strong class="text-amber-400">${m.forecast_date}</strong>
            </div>
            <div class="px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
              <span class="text-slate-500">Chốt thực tế:</span> <strong class="text-emerald-400">${m.settlement_date}</strong>
            </div>
          </div>
        </div>

        <!-- Trạng thái Kịch bản Trúng & Kết quả Thực thi Chiến Lược -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kịch bản Mô Hình Đã Khớp:</div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-md text-xs font-bold ${matchedBadgeBg} border flex items-center gap-1.5">
                <span>${matchedBadgeIcon}</span>
                <span>${evalData.matched_scenario_name}</span>
              </span>
              <span class="text-xs font-mono-num text-slate-400 font-semibold">${evalData.status_label}</span>
            </div>
            <div class="text-xs text-slate-400">Sai số so với biên mục tiêu gần nhất: <strong class="text-amber-400 font-mono-num">±${evalData.variance_pct}%</strong></div>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hiệu Quả Thực Thi Kỷ Luật Đầu Tư:</div>
            <div>
              <span class="px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider border ${tradeBadgeBg}">
                ${trade.badge || 'THÀNH CÔNG'}
              </span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${trade.detail || ''}</p>
          </div>
        </div>
      </div>

      <!-- Thẻ 2: Bảng So Sánh Đối Chiếu Trực Diện 3 Loại Vàng -->
      <div class="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <span>📊</span> Bảng So Sánh Số Liệu Thực Tế vs Mục Tiêu Dự Báo Ban Đầu
          </h4>
          <span class="text-xs text-slate-400">Đơn vị: USD/oz & Triệu VNĐ/lượng</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="border-b border-slate-700/80 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/60">
                <th class="py-2.5 px-4">Tài sản theo dõi</th>
                <th class="py-2.5 px-4 text-right">Giá lúc dự báo (${m.forecast_date})</th>
                <th class="py-2.5 px-4 text-right">Giá thực tế hôm nay</th>
                <th class="py-2.5 px-4 text-right">Biến động thực tế</th>
                <th class="py-2.5 px-4 text-right">Biên độ dự báo kịch bản trúng</th>
                <th class="py-2.5 px-4 text-center">Đánh giá kiểm định</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono-num">
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Thẻ 3: Đối Chiếu 3 Kịch Bản Dự Báo Xuất Phát Điểm -->
      <div class="space-y-2">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <span>⚖️</span> Đối Chiếu 3 Kịch Bản Ban Đầu Tại Mốc Thời Gian ${m.forecast_date}:
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${scenariosGridHtml}
        </div>
      </div>

      <!-- Thẻ 4: Nhận Định Kiểm Định Vĩ Mô Chuyên Sâu (Post-Mortem Analysis) -->
      <div class="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
        <div class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <span>🧠</span> Đúc Kết Kiểm Định Vĩ Mô & Lý Do Diễn Biến Thị Trường:
        </div>
        <p class="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
          ${evalData.post_mortem}
        </p>
        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>📁 Sổ cái định lượng: <code class="text-amber-300">data/forecast_history.json</code> (${audit.ledger_summary?.total_recorded_snapshots ?? 1} snapshot đã ghi nhận)</span>
          <span class="text-emerald-400">● Tự động đối chiếu theo tiến trình dữ liệu</span>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 6. BẢNG GIÁ THƯƠNG HIỆU VIỆT NAM & CÔNG CỤ TÍNH ĐIỂM HÒA VỐN ĐẦU TƯ
  // ==========================================================================

  function renderVietnamBrandsTable(data) {
    const brands = data.market_snapshot.vn_brands || [];
    const tbody = document.getElementById('vn-brands-tbody');
    if (!tbody) return;

    tbody.innerHTML = brands
      .map(
        (b) => `
        <tr class="border-b border-slate-800/70 hover:bg-slate-800/30 transition">
          <td class="py-3 px-4 font-semibold text-white">${b.brand}</td>
          <td class="py-3 px-4 text-slate-400 text-xs">${b.type}</td>
          <td class="py-3 px-4 text-right font-mono-num text-emerald-400 font-bold">${formatNumber(b.buy, 2)} tr</td>
          <td class="py-3 px-4 text-right font-mono-num text-amber-400 font-bold">${formatNumber(b.sell, 2)} tr</td>
          <td class="py-3 px-4 text-right font-mono-num text-slate-300">${formatNumber(b.spread_buy_sell, 2)} tr</td>
          <td class="py-3 px-4 text-right font-mono-num ${b.vs_world > 12 ? 'text-rose-400' : 'text-sky-400'}">+${formatNumber(b.vs_world, 2)} tr</td>
        </tr>
      `
      )
      .join('');
  }

  function updateInvestorCalculator() {
    if (!STATE.data) return;
    const snap = STATE.data.market_snapshot;
    const assetObj = STATE.calcAsset === 'sjc' ? snap.sjc : snap.ring_9999;
    const qty = Math.max(0.1, Number(STATE.calcQuantity) || 1);

    // Khi nhà đầu tư mua tại tiệm vàng, họ phải mua theo giá BÁN RA của tiệm (sell)
    // Khi nhà đầu tư bán lại cho tiệm, tiệm thu mua theo giá MUA VÀO (buy)
    const buyInPrice = assetObj.sell;
    const instantResellPrice = assetObj.buy;
    const totalCapital = buyInPrice * qty;
    const immediateSpreadLoss = (buyInPrice - instantResellPrice) * qty;
    const breakevenPct = ((buyInPrice - instantResellPrice) / instantResellPrice) * 100;

    document.getElementById('calc-capital-total').textContent = `${formatNumber(totalCapital, 2)} triệu VNĐ`;
    document.getElementById('calc-spread-loss').textContent = `-${formatNumber(immediateSpreadLoss, 2)} triệu VNĐ`;
    document.getElementById('calc-breakeven-price').textContent = `${formatNumber(buyInPrice + (buyInPrice - instantResellPrice), 2)} tr/lượng (+${breakevenPct.toFixed(2)}%)`;

    // Tính lợi nhuận ròng kỳ vọng sau khi đã trừ chênh lệch Mua-Bán cho 6 mốc thời gian cụ thể (Kịch bản tích cực)
    const pnl1w = totalCapital * 0.018 - immediateSpreadLoss;
    const pnl1m = totalCapital * 0.038 - immediateSpreadLoss;
    const pnl3m = totalCapital * 0.072 - immediateSpreadLoss;
    const pnl6m = totalCapital * 0.115 - immediateSpreadLoss;
    const pnl1y = totalCapital * 0.185 - immediateSpreadLoss;
    const pnl5y = totalCapital * 0.350 - immediateSpreadLoss;

    const fmtPnL = (v) => `${v >= 0 ? '+' : ''}${formatNumber(v, 2)} triệu VNĐ`;
    const setPnL = (id, val) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = fmtPnL(val);
        el.className = `font-mono-num font-bold mt-0.5 ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
      }
    };

    setPnL('calc-pnl-1w', pnl1w);
    setPnL('calc-pnl-1m', pnl1m);
    setPnL('calc-pnl-3m', pnl3m);
    setPnL('calc-pnl-6m', pnl6m);
    setPnL('calc-pnl-1y', pnl1y);
    setPnL('calc-pnl-5y', pnl5y);
  }

  // ==========================================================================
  // 7. GẮN SỰ KIỆN TƯƠNG TÁC (EVENT LISTENERS)
  // ==========================================================================

  function bindEvents() {
    // Chuyển đổi Loại Vàng trên đồ thị
    document.querySelectorAll('[data-asset-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        STATE.selectedAsset = btn.getAttribute('data-asset-btn');
        document.querySelectorAll('[data-asset-btn]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderMainStockChart();
      });
    });

    // Chuyển đổi Khung thời gian từ Đồ Thị (Mục 2)
    document.querySelectorAll('[data-tf-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tf = btn.getAttribute('data-tf-btn');
        STATE.selectedTimeframe = tf;
        document.querySelectorAll('[data-tf-btn]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('[data-events-tf]').forEach((b) => {
          if (b.getAttribute('data-events-tf') === tf) b.classList.add('active');
          else b.classList.remove('active');
        });
        renderMainStockChart();
      });
    });

    // Chuyển đổi Khung thời gian từ Bảng Sự Kiện & Tin Tức (Mục 3)
    document.querySelectorAll('[data-events-tf]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tf = btn.getAttribute('data-events-tf');
        STATE.selectedTimeframe = tf;
        document.querySelectorAll('[data-events-tf]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('[data-tf-btn]').forEach((b) => {
          if (b.getAttribute('data-tf-btn') === tf) b.classList.add('active');
          else b.classList.remove('active');
        });
        renderMainStockChart();
      });
    });

    // Chuyển đổi Kiểu biểu đồ (Nến / Vùng)
    document.querySelectorAll('[data-chartmode-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        STATE.chartMode = btn.getAttribute('data-chartmode-btn');
        document.querySelectorAll('[data-chartmode-btn]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderMainStockChart();
      });
    });

    // Bật/tắt MA20, MA50, MA200
    const bindToggleMA = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', () => {
        STATE[key] = !STATE[key];
        el.classList.toggle('active', STATE[key]);
        renderMainStockChart();
      });
    };
    bindToggleMA('toggle-ma20', 'showMA20');
    bindToggleMA('toggle-ma50', 'showMA50');
    bindToggleMA('toggle-ma200', 'showMA200');
    bindToggleMA('toggle-chart-events', 'showChartEvents');

    // Bộ lọc Mức độ ảnh hưởng của Sự kiện (Tiêu biểu theo khung / Lớn / Trung bình / Nhỏ / Tất cả)
    document.querySelectorAll('[data-evt-impact]').forEach((btn) => {
      btn.addEventListener('click', () => {
        STATE.eventImpactFilter = btn.getAttribute('data-evt-impact');
        document.querySelectorAll('[data-evt-impact]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderMainStockChart();
      });
    });

    // Bộ lọc Chiều tác động (Tất cả / Giá Lên Xanh lá / Giá Xuống Đỏ)
    document.querySelectorAll('[data-evt-dir]').forEach((btn) => {
      btn.addEventListener('click', () => {
        STATE.eventDirectionFilter = btn.getAttribute('data-evt-dir');
        document.querySelectorAll('[data-evt-dir]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderMainStockChart();
      });
    });

    // Nút Cập nhật Tin tức Trực tiếp (Real-time RSS Refresh)
    const refreshBtn = document.getElementById('btn-refresh-live-news');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshLiveNewsInBrowser();
      });
    }

    // Chuyển đổi Khung thời gian Dự báo (Ngắn hạn / Trung hạn / Dài hạn)
    document.querySelectorAll('[data-horizon-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        STATE.selectedHorizon = tab.getAttribute('data-horizon-tab');
        document.querySelectorAll('[data-horizon-tab]').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderForecastScenarios(STATE.data);
      });
    });

    // Chuyển đổi Mốc Thời Gian Đối Chiếu & Kiểm Định Kết Quả Dự Báo
    document.querySelectorAll('[data-audit-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        STATE.selectedAuditMilestone = tab.getAttribute('data-audit-tab');
        document.querySelectorAll('[data-audit-tab]').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderForecastAudit(STATE.data);
      });
    });

    // Máy tính đầu tư vàng
    const assetSelect = document.getElementById('calc-asset-select');
    const qtyInput = document.getElementById('calc-qty-input');
    if (assetSelect) {
      assetSelect.addEventListener('change', (e) => {
        STATE.calcAsset = e.target.value;
        updateInvestorCalculator();
      });
    }
    if (qtyInput) {
      qtyInput.addEventListener('input', (e) => {
        STATE.calcQuantity = parseFloat(e.target.value) || 1;
        updateInvestorCalculator();
      });
    }

        // Chuyển đổi chu kỳ lướt sóng & tích sản (Ngắn Hạn T+ vs Trung Hạn vs Dài Hạn)
    const btnHzShort = document.getElementById('trading-hz-short');
    const btnHzMed = document.getElementById('trading-hz-med');
    const btnHzLong = document.getElementById('trading-hz-long');
    if (btnHzShort) {
      btnHzShort.addEventListener('click', () => {
        STATE.swingHorizon = 'short_term';
        renderSwingTradingCenter(STATE.data);
      });
    }
    if (btnHzMed) {
      btnHzMed.addEventListener('click', () => {
        STATE.swingHorizon = 'medium_term';
        renderSwingTradingCenter(STATE.data);
      });
    }
    if (btnHzLong) {
      btnHzLong.addEventListener('click', () => {
        STATE.swingHorizon = 'long_term';
        renderSwingTradingCenter(STATE.data);
      });
    }

    // Chuyển đổi công cụ xem kế hoạch lướt sóng (Nhẫn / SJC / Thế giới)
    const tabRing = document.getElementById('swing-tab-ring');
    const tabSjc = document.getElementById('swing-tab-sjc');
    const tabXau = document.getElementById('swing-tab-xau');
    if (tabRing) {
      tabRing.addEventListener('click', () => {
        STATE.swingAsset = 'ring_9999';
        renderSwingTradingCenter(STATE.data);
      });
    }
    if (tabSjc) {
      tabSjc.addEventListener('click', () => {
        STATE.swingAsset = 'sjc';
        renderSwingTradingCenter(STATE.data);
      });
    }
    if (tabXau) {
      tabXau.addEventListener('click', () => {
        STATE.swingAsset = 'xau_usd';
        renderSwingTradingCenter(STATE.data);
      });
    }

    // Tự động co giãn biểu đồ khi thay đổi kích thước màn hình
    window.addEventListener('resize', () => {
      const container = document.getElementById('tv-main-chart');
      if (STATE.mainChart && container) {
        STATE.mainChart.applyOptions({ width: container.clientWidth });
      }
    });
  }

  // ==========================================================================
  // 7B. HỆ THỐNG TAB ĐỘC LẬP 6 MỤC (MỖI MỤC MỘT MÀN HÌNH RIÊNG BIỆT)
  // ==========================================================================

  const TAB_KEY_MAP = {
    '1': 'section-overview',
    '2': 'section-charts',
    '3': 'section-events-timeline',
    '4': 'section-factors',
    '5': 'section-forecast',
    '6': 'section-calculator',
    '0': 'all',
  };

  function switchMainTab(targetTabId, updateHistory = true, shouldScroll = false) {
    const tabButtons = document.querySelectorAll('[data-main-tab]');
    const tabSections = document.querySelectorAll('.tab-section');

    // Chuẩn hóa hash cũ nếu có
    if (targetTabId === 'section-scenarios' || targetTabId === 'section-swing-trading') {
      targetTabId = 'section-forecast';
    }

    let validTarget = false;
    tabButtons.forEach((btn) => {
      const tabId = btn.getAttribute('data-main-tab');
      if (tabId === targetTabId) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        validTarget = true;
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    if (!validTarget) {
      targetTabId = 'section-overview';
      const defaultBtn = document.querySelector('[data-main-tab="section-overview"]');
      if (defaultBtn) {
        defaultBtn.classList.add('active');
        defaultBtn.setAttribute('aria-selected', 'true');
      }
    }

    // Ẩn / hiện các khối section tương ứng
    if (targetTabId === 'all') {
      tabSections.forEach((sec) => {
        sec.classList.remove('hidden');
        sec.classList.add('tab-pane-active');
      });
    } else {
      tabSections.forEach((sec) => {
        if (sec.id === targetTabId) {
          sec.classList.remove('hidden');
          sec.classList.add('tab-pane-active');
        } else {
          sec.classList.add('hidden');
          sec.classList.remove('tab-pane-active');
        }
      });
    }

    // Tự động re-render và căn chỉnh kích thước biểu đồ TradingView
    if (targetTabId === 'section-charts' || targetTabId === 'all') {
      setTimeout(() => {
        const container = document.getElementById('tv-main-chart');
        if (container && container.clientWidth > 0) {
          renderMainStockChart();
        }
      }, 50);
    }

    // Lưu tab vào sessionStorage & URL hash
    try {
      sessionStorage.setItem('aurum_active_tab', targetTabId);
      if (updateHistory) {
        history.replaceState(null, '', '#' + targetTabId);
      }
    } catch (_) {}

    // Tự động cuộn nhẹ lên đầu vùng nội dung nếu người dùng đang ở sâu bên dưới
    if (shouldScroll) {
      const headerEl = document.querySelector('header');
      const offsetTop = headerEl ? headerEl.offsetHeight + 10 : 120;
      const currentScroll = window.scrollY || document.documentElement.scrollTop;
      if (currentScroll > offsetTop) {
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    }
  }

  function initMainTabs() {
    // 1. Click các nút Tab chính trên header
    document.querySelectorAll('[data-main-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-main-tab');
        switchMainTab(targetTabId, true, true);
      });
    });

    // 2. Click các nút chuyển tab nhanh ở chân từng mục (Quick Tab Nav)
    document.querySelectorAll('[data-nav-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-nav-target');
        switchMainTab(targetTabId, true, true);
      });
    });

    // 3. Phím tắt số 1 - 6 và 0 (Toàn bộ)
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
        return;
      }
      if (TAB_KEY_MAP[e.key]) {
        switchMainTab(TAB_KEY_MAP[e.key], true, true);
      }
    });

    // 4. Lắng nghe hashchange
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        switchMainTab(hash, false, false);
      }
    });

    // 5. Xác định tab ban đầu
    let initialTab = 'section-overview';
    const hash = window.location.hash.replace('#', '');
    if (hash && (document.getElementById(hash) || hash === 'all' || hash === 'section-scenarios' || hash === 'section-swing-trading')) {
      initialTab = hash;
    } else {
      const stored = sessionStorage.getItem('aurum_active_tab');
      if (stored && (document.getElementById(stored) || stored === 'all' || stored === 'section-forecast')) {
        initialTab = stored;
      }
    }
    switchMainTab(initialTab, false, false);
  }

  // ==========================================================================
  // 8. KHỞI CHẠY ỨNG DỤNG
  // ==========================================================================

  async function initApp() {
    try {
      const data = await loadGoldMarketData();
      STATE.data = data;

      renderHeaderAndKPIs(data);
      renderMainStockChart();
      renderMacroFactors(data);
      renderForecastScenarios(data);
      renderSwingTradingCenter(data);
      renderForecastAudit(data);
      renderVietnamBrandsTable(data);
      updateInvestorCalculator();
      bindEvents();
      initMainTabs();
    } catch (err) {
      console.error('Lỗi khởi tạo ứng dụng:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();


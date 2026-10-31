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
    selectedHorizon: 'short_term', // 'short_term' | 'mid_term' | 'long_term'
    calcAsset: 'ring_9999',
    calcQuantity: 5, // lượng vàng
    mainChart: null,
    spreadChart: null,
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

    // Xóa chart cũ nếu có
    container.innerHTML = '';

    const chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
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

      renderPerformanceStrip(hist.sjc, 'sjc');
      updateOHLCLegend(sjcRaw[sjcRaw.length - 1], meta);
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
      updateOHLCLegend(sliced[sliced.length - 1], meta);

      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time) {
          updateOHLCLegend(sliced[sliced.length - 1], meta);
          return;
        }
        const dateKey = typeof param.time === 'string' ? param.time : null;
        if (dateKey && byDate[dateKey]) {
          updateOHLCLegend(byDate[dateKey], meta);
        }
      });

      renderPerformanceStrip(rawSeries, assetKey);
    }

    chart.timeScale().fitContent();
  }

  function updateOHLCLegend(bar, meta) {
    if (!bar) return;
    const el = document.getElementById('chart-ohlc-legend');
    if (!el) return;
    const isUp = bar.close >= bar.open;
    const color = isUp ? 'text-emerald-400' : 'text-rose-400';
    el.innerHTML = `
      <span class="text-slate-400">Ngày: <strong class="text-slate-200">${bar.date}</strong></span>
      <span class="text-slate-400">Mở: <strong class="text-slate-200">${meta.prefix}${formatNumber(bar.open, meta.decimals)}${meta.suffix}</strong></span>
      <span class="text-slate-400">Cao: <strong class="text-emerald-400">${meta.prefix}${formatNumber(bar.high, meta.decimals)}${meta.suffix}</strong></span>
      <span class="text-slate-400">Thấp: <strong class="text-rose-400">${meta.prefix}${formatNumber(bar.low, meta.decimals)}${meta.suffix}</strong></span>
      <span class="text-slate-400">Đóng: <strong class="${color}">${meta.prefix}${formatNumber(bar.close, meta.decimals)}${meta.suffix}</strong></span>
      ${bar.ma20 ? `<span class="text-sky-400">MA20: ${formatNumber(bar.ma20, meta.decimals)}</span>` : ''}
      ${bar.ma50 ? `<span class="text-purple-400">MA50: ${formatNumber(bar.ma50, meta.decimals)}</span>` : ''}
    `;
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

    const horizonObj = forecast.horizons[STATE.selectedHorizon] || forecast.horizons.short_term;

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

    // Tính lợi nhuận ròng kỳ vọng sau khi đã trừ chênh lệch Mua-Bán cho 3 khung thời gian (Kịch bản tích cực trung bình)
    const stNet = totalCapital * 0.032 - immediateSpreadLoss;
    const mtNet = totalCapital * 0.095 - immediateSpreadLoss;
    const ltNet = totalCapital * 0.26 - immediateSpreadLoss;

    const fmtPnL = (v) => `${v >= 0 ? '+' : ''}${formatNumber(v, 2)} triệu VNĐ`;
    const elSt = document.getElementById('calc-pnl-short');
    const elMt = document.getElementById('calc-pnl-mid');
    const elLt = document.getElementById('calc-pnl-long');

    elSt.textContent = fmtPnL(stNet);
    elSt.className = `font-mono-num font-bold ${stNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

    elMt.textContent = fmtPnL(mtNet);
    elMt.className = `font-mono-num font-bold ${mtNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

    elLt.textContent = fmtPnL(ltNet);
    elLt.className = `font-mono-num font-bold ${ltNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
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

    // Chuyển đổi Khung thời gian (7D -> ALL)
    document.querySelectorAll('[data-tf-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        STATE.selectedTimeframe = btn.getAttribute('data-tf-btn');
        document.querySelectorAll('[data-tf-btn]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
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

    // Chuyển đổi Khung thời gian Dự báo (Ngắn hạn / Trung hạn / Dài hạn)
    document.querySelectorAll('[data-horizon-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        STATE.selectedHorizon = tab.getAttribute('data-horizon-tab');
        document.querySelectorAll('[data-horizon-tab]').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderForecastScenarios(STATE.data);
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

    // Tự động co giãn biểu đồ khi thay đổi kích thước màn hình
    window.addEventListener('resize', () => {
      const container = document.getElementById('tv-main-chart');
      if (STATE.mainChart && container) {
        STATE.mainChart.applyOptions({ width: container.clientWidth });
      }
    });
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
      renderVietnamBrandsTable(data);
      updateInvestorCalculator();
      bindEvents();
    } catch (err) {
      console.error('Lỗi khởi tạo ứng dụng:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();


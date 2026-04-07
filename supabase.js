// ================================================================
// supabase.js — Supabase 연동 클라이언트 & API 함수
// !! 아래 두 값을 본인 Supabase 프로젝트 값으로 교체하세요 !!
// ================================================================

const SUPABASE_URL = 'https://qqisudyfktpnakldgrls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxaXN1ZHlma3RwbmFrbGRncmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTMxOTMsImV4cCI6MjA5MTAyOTE5M30.MWir7d_xbGU2ptnddl4JCHMBudZH1LK9kmOhBl-4dSA';

// Supabase JS CDN 클라이언트 (index.html 등에서 script 태그로 로드)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 공통 에러 처리 ──────────────────────────────────────────────
function handleError(label, error) {
  console.error(`[${label}]`, error);
  showToast(`오류: ${label} — ${error.message}`, 'error');
  return null;
}

// ── Toast 알림 (각 페이지에 #toast div 필요) ────────────────────
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── 로딩 상태 ────────────────────────────────────────────────────
function setLoading(id, on) {
  const el = document.getElementById(id);
  if (el) el.style.opacity = on ? '0.4' : '1';
}

// ================================================================
// CHANNELS 상수
// ================================================================
const CHANNELS = [
  { key: 'naver',    label: '네이버',     color: '#03C75A' },
  { key: 'coupang',  label: '쿠팡',       color: '#E8232A' },
  { key: 'esm',      label: 'G마켓/옥션', color: '#0032A0' },
  { key: 'elevenst', label: '11번가',     color: '#e5001d' },
  { key: 'cafe24',   label: '카페24',     color: '#0040FF' },
  { key: 'toss',     label: 'Toss',       color: '#3182F6' },
  { key: 'easy',     label: '이지판매',   color: '#7C3AED' },
];

// ================================================================
// WAREHOUSES
// ================================================================
async function getWarehouses() {
  const { data, error } = await sb.from('warehouses').select('*').order('id');
  if (error) return handleError('창고 조회', error) ?? [];
  return data;
}

async function addWarehouse(name, manager = '') {
  const { data, error } = await sb.from('warehouses').insert({ name, manager }).select().single();
  if (error) return handleError('창고 추가', error);
  showToast(`창고 "${name}" 추가됨`);
  return data;
}

async function deleteWarehouse(id) {
  const { error } = await sb.from('warehouses').delete().eq('id', id);
  if (error) return handleError('창고 삭제', error);
  showToast('창고 삭제됨');
}

// ================================================================
// PRODUCTS
// ================================================================
async function getProducts() {
  const { data, error } = await sb
    .from('product_stock_summary')
    .select('*')
    .order('id');
  if (error) return handleError('품목 조회', error) ?? [];
  return data;
}

async function getProductsWithPrices() {
  const [prodRes, priceRes, stockRes] = await Promise.all([
    sb.from('products').select('*').order('id'),
    sb.from('channel_prices').select('*'),
    sb.from('stock').select('*, warehouses(name)'),
  ]);
  if (prodRes.error) return handleError('품목+단가 조회', prodRes.error) ?? [];

  const prices = priceRes.data || [];
  const stocks = stockRes.data || [];

  return (prodRes.data || []).map(p => {
    const pMap = {};
    prices.filter(x => x.product_id === p.id).forEach(x => { pMap[x.channel] = x.price; });
    const sMap = {};
    stocks.filter(x => x.product_id === p.id).forEach(x => { sMap[x.warehouse_id] = x.quantity; });
    const total = Object.values(sMap).reduce((a, v) => a + v, 0);
    const unit_price = p.unit > 1 ? Math.round(p.cost / p.unit) : p.cost;
    return { ...p, prices: pMap, stock: sMap, total_stock: total, unit_price };
  });
}

async function addProduct({ name, category, cost, unit, type }) {
  const { data, error } = await sb.from('products')
    .insert({ name, category, cost, unit, type })
    .select().single();
  if (error) return handleError('품목 추가', error);

  // 모든 창고에 재고 0 초기화
  const warehouses = await getWarehouses();
  if (warehouses.length) {
    await sb.from('stock').insert(
      warehouses.map(w => ({ product_id: data.id, warehouse_id: w.id, quantity: 0 }))
    );
  }
  // 모든 채널 단가 0 초기화
  await sb.from('channel_prices').insert(
    CHANNELS.map(c => ({ product_id: data.id, channel: c.key, price: 0 }))
  );

  showToast(`"${name}" 등록 완료`);
  return data;
}

async function deleteProduct(id) {
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) return handleError('품목 삭제', error);
  showToast('품목 삭제됨');
}

// ================================================================
// CHANNEL PRICES
// ================================================================
async function getChannelPrices(productId) {
  const { data, error } = await sb.from('channel_prices')
    .select('*').eq('product_id', productId);
  if (error) return handleError('단가 조회', error) ?? [];
  return data;
}

async function upsertChannelPrice(productId, channel, price) {
  const { error } = await sb.from('channel_prices')
    .upsert({ product_id: productId, channel, price, updated_at: new Date().toISOString() },
             { onConflict: 'product_id,channel' });
  if (error) return handleError('단가 저장', error);
}

async function saveAllChannelPrices(productId, priceMap) {
  // priceMap: { naver: 900, coupang: 880, ... }
  const rows = Object.entries(priceMap).map(([channel, price]) => ({
    product_id: productId, channel, price: parseInt(price) || 0,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from('channel_prices')
    .upsert(rows, { onConflict: 'product_id,channel' });
  if (error) return handleError('단가 일괄 저장', error);
  showToast('단가 저장 완료');
}

// ================================================================
// STOCK (창고별 재고)
// ================================================================
async function getStockAll() {
  const { data, error } = await sb.from('stock')
    .select('*, products(name), warehouses(name)').order('product_id');
  if (error) return handleError('재고 조회', error) ?? [];
  return data;
}

async function updateStock(productId, warehouseId, quantity) {
  const { error } = await sb.from('stock')
    .upsert({ product_id: productId, warehouse_id: warehouseId, quantity,
              updated_at: new Date().toISOString() },
             { onConflict: 'product_id,warehouse_id' });
  if (error) return handleError('재고 수정', error);
  showToast('재고 수정됨');
}

async function updateStockBatch(rows) {
  // rows: [{ product_id, warehouse_id, quantity }, ...]
  const { error } = await sb.from('stock')
    .upsert(rows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
            { onConflict: 'product_id,warehouse_id' });
  if (error) return handleError('재고 일괄 수정', error);
}

// ================================================================
// STOCKTAKE (실사)
// ================================================================
async function getSessions() {
  const { data, error } = await sb.from('stocktake_sessions')
    .select('*').order('date', { ascending: true });
  if (error) return handleError('실사 이력 조회', error) ?? [];
  return data;
}

async function getSessionItems(sessionId) {
  const { data, error } = await sb.from('stocktake_items')
    .select('*, products(name, category)').eq('session_id', sessionId);
  if (error) return handleError('실사 상세 조회', error) ?? [];
  return data;
}

async function saveStocktakeSession(date, memo, items) {
  // items: [{ product_id, system_qty, actual_qty }]
  const { data: session, error: sessErr } = await sb.from('stocktake_sessions')
    .insert({ date, memo }).select().single();
  if (sessErr) return handleError('실사 저장', sessErr);

  const rows = items.map(i => ({ session_id: session.id, ...i }));
  const { error: itemErr } = await sb.from('stocktake_items').insert(rows);
  if (itemErr) return handleError('실사 항목 저장', itemErr);

  showToast(`${date} 실사 저장 완료 (${items.length}품목)`);
  return session;
}

async function deleteSession(id) {
  const { error } = await sb.from('stocktake_sessions').delete().eq('id', id);
  if (error) return handleError('실사 삭제', error);
  showToast('실사 이력 삭제됨');
}

// ================================================================
// DAILY ORDERS
// ================================================================
async function getDailyOrders(date) {
  const { data, error } = await sb.from('daily_orders')
    .select('*').eq('date', date);
  if (error) return handleError('주문 현황 조회', error) ?? [];
  return data;
}

async function upsertDailyOrder(date, channel, ordered, processed) {
  const { error } = await sb.from('daily_orders')
    .upsert({ date, channel, ordered, processed },
             { onConflict: 'date,channel' });
  if (error) return handleError('주문 저장', error);
}

// ================================================================
// HELPERS
// ================================================================
function totalStock(p) {
  if (p.total_stock !== undefined) return p.total_stock;
  return Object.values(p.stock || {}).reduce((a, v) => a + v, 0);
}

function unitPrice(p) {
  if (p.unit_price !== undefined) return p.unit_price;
  return p.unit > 1 ? Math.round(p.cost / p.unit) : p.cost;
}

function stockStatus(s) {
  if (s <= 10) return 'danger';
  if (s <= 20) return 'warn';
  return 'ok';
}

function fmtPrice(n) {
  return (n || 0).toLocaleString() + '원';
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ================================================================
// SALES (판매관리)
// ================================================================

// 판매 기록 추가
async function addSale({ channel, buyer_name, product_name, quantity, note, report_type, sold_at, date }) {
  const { data, error } = await sb.from('sales').insert({
    channel, buyer_name, product_name,
    quantity: parseInt(quantity) || 1,
    note: note || '',
    report_type: report_type || 'morning',
    sold_at: sold_at || new Date().toISOString(),
    date: date || new Date().toISOString().slice(0, 10),
  }).select().single();
  if (error) return handleError('판매 기록 추가', error);
  return data;
}

// 판매 기록 일괄 추가
async function addSalesBatch(rows) {
  if (!rows.length) return [];
  const { data, error } = await sb.from('sales').insert(rows).select();
  if (error) return handleError('판매 기록 일괄 추가', error);
  return data;
}

// 판매 기록 조회 (필터 가능)
async function getSales({ date, dateFrom, dateTo, channel, buyerName, reportType, limit = 500 } = {}) {
  let q = sb.from('sales').select('*').order('sold_at', { ascending: false }).limit(limit);
  if (date)       q = q.eq('date', date);
  if (dateFrom)   q = q.gte('date', dateFrom);
  if (dateTo)     q = q.lte('date', dateTo);
  if (channel)    q = q.eq('channel', channel);
  if (buyerName)  q = q.ilike('buyer_name', `%${buyerName}%`);
  if (reportType) q = q.eq('report_type', reportType);
  const { data, error } = await q;
  if (error) return handleError('판매 기록 조회', error);
  return data || [];
}

// 판매 기록 삭제
async function deleteSale(id) {
  const { error } = await sb.from('sales').delete().eq('id', id);
  if (error) return handleError('판매 기록 삭제', error);
}

// 판매 기록 일괄 삭제
async function deleteSalesBatch(ids) {
  const { error } = await sb.from('sales').delete().in('id', ids);
  if (error) return handleError('판매 기록 일괄 삭제', error);
}

// 구매자별 통계
async function getBuyerSummary(buyerName = '') {
  let q = sb.from('sales').select('buyer_name, channel, product_name, quantity, date, note').order('date', { ascending: false });
  if (buyerName) q = q.ilike('buyer_name', `%${buyerName}%`);
  const { data, error } = await q;
  if (error) return handleError('구매자 통계 조회', error);
  return data || [];
}

// 특정 날짜 판매 데이터 → 보고서용
async function getSalesForReport(date, reportType) {
  return getSales({ date, reportType });
}

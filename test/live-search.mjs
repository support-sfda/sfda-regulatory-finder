import worker from '../dist/server/index.js';

const NativeResponse = globalThis.Response;
const upstream = new Map([
  ['warnings', `<article><time>2026-05-25</time><a href="/ar/warnings/5521915">تحذير من منتج عسل تجريبي</a></article><article><time>2026-04-10</time><a href="/ar/warnings/5521900">تحذير من كريم تفتيح البشرة</a></article><article><time>2026-03-08</time><a href="/ar/warnings/5521800">تحذير من ايس كريم بالفانيلا</a></article>`],
 ['drugs-circulars-withdrawal', `<table><tr><td>عسل طبي 10 mg</td><td>Medicine Product</td><td>Recall</td><td>Hospital level</td><td>2026-06-15</td><td><a href="/ar/node/5521951">عرض</a></td></tr></table>`],
  ['safety-alert', `<table><tr><td>251</td><td>Safety Signal of عسل طبي and the Risk of allergy</td><td>Signal</td><td>2026-06-18</td><td><a href="/sites/default/files/2026-06/honey-signal.pdf">عرض</a></td></tr></table>`],
 ['regulations', `<article><span>2026-07-05</span><span>الغذاء</span><span>متطلبات</span><div>متطلبات فحص العسل</div><a href="/sites/default/files/honey.pdf">Image</a></article>`],
  ['Guide', `<article><span>2025-01-01</span><div>دليل العسل ومنتجات النحل</div><a href="/sites/default/files/honey-guide.pdf">Image</a></article>`],
  ['circulars', `<article><span>فعال</span><span>2025-02-02</span><div>تعميم اشتراطات العسل</div><a href="/ar/node/12345">عرض</a></article>`]
]);

globalThis.fetch = async input => {
  const url = String(input);
  const key = [...upstream.keys()].find(item => url.includes(item));
  return new NativeResponse(upstream.get(key) || '', { status: key ? 200 : 404 });
};

const response = await worker.fetch(new Request('https://example.test/api/official-search?q=عسل'));
const data = await response.json();
console.log(data.records.map(record => `${record.kind}: ${record.title}`));

if (!response.ok) throw new Error('فشل مسار البحث الحي');
if (data.records.length !== 6) throw new Error(`عدد السجلات غير صحيح: ${data.records.length}`);
if (!data.records.some(record => record.kind === 'warning' && record.url.includes('/warnings/5521915'))) throw new Error('لم يُحلل التحذير الفعلي');
if (!data.records.some(record => record.kind === 'recall' && record.action === 'Recall')) throw new Error('لم تُحلل حقول الاستدعاء');
if (!data.records.some(record => record.kind === 'safety_alert' && record.status === 'Signal')) throw new Error('لم تُحلل تحذيرات السلامة الدوائية');
if (!data.records.some(record => record.kind === 'legislation')) throw new Error('لم تُحلل الأنظمة والمتطلبات');
if (!data.records.some(record => record.kind === 'guide')) throw new Error('لم تُحلل الأدلة');
if (!data.records.some(record => record.kind === 'circular')) throw new Error('لم تُحلل التعاميم');

const precisionResponse = await worker.fetch(new Request('https://example.test/api/official-search?q=كريم%20تفتيح'));
const precisionData = await precisionResponse.json();
if (!precisionData.records.some(record => record.title.includes('كريم تفتيح'))) throw new Error('فُقدت المطابقة المركبة الصحيحة');
if (precisionData.records.some(record => record.title.includes('ايس كريم'))) throw new Error('ظهرت مطابقة بعيدة بسبب كلمة مشتركة واحدة');

console.log('PASS: محلل البحث الحي يعرض السجلات الرسمية الفعلية عبر جميع القواعد الست');

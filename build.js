const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'public');
const output = path.join(__dirname, 'dist');

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, output, { recursive: true });

const routes = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/sources.js': ['sources.js', 'application/javascript; charset=utf-8'],
  '/content-index.js': ['content-index.js', 'application/javascript; charset=utf-8'],
  '/classification-library.js': ['classification-library.js', 'application/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8']
};
const bundled = Object.fromEntries(
  Object.entries(routes).map(([route, [file, type]]) => [
    route,
    { body: fs.readFileSync(path.join(source, file), 'utf8'), type }
  ])
);
const worker = `const files = ${JSON.stringify(bundled)};
const SFDA_BASE = 'https://www.sfda.gov.sa';
const visualRequirements = {
  'TEMP-MDS': { title: 'وسائل إلكترونية لقياس الحرارة والرطوبة', clause: 'تثبت في أماكن وارتفاعات مختلفة وفق خارطة حرارية فعالة، وتخضع للمعايرة والمراقبة الدورية.', source: 'MDS-REQ 12 — منطقة التخزين', page: 'الصفحتان 5–6', url: 'https://www.sfda.gov.sa/ar/regulations/88142' },
  'TEMP-GDP': { title: 'توفير قراءات وسجلات درجات الحرارة والرطوبة', clause: 'تكون القراءات متاحة عند الطلب مع الاحتفاظ بالسجلات وفق المدة المحددة.', source: 'مدونة أسس ممارسة التوزيع والتخزين الجيدة', page: 'الصفحتان 17–18', url: 'https://www.sfda.gov.sa/ar/regulations/69390' },
  'RECEIVE-GDP': { title: 'التحقق من ظروف النقل عند الاستلام', clause: 'يجب التأكد من أن المستحضرات نُقلت ووزعت وفق ظروف التوزيع والتخزين المناسبة والاحتفاظ بالسجلات.', source: 'مدونة أسس ممارسة التوزيع والتخزين الجيدة — الاستلام والصرف', page: 'الصفحة 23', url: 'https://www.sfda.gov.sa/ar/regulations/69390' },
  'RECEIVE-SOP': { title: 'إجراءات مكتوبة للاستلام والصرف', clause: 'تراعي طبيعة المنتجات وأي احتياطات خاصة وحالة المنتجات المعلقة.', source: 'مدونة أسس ممارسة التوزيع والتخزين الجيدة', page: 'الصفحة 23', url: 'https://www.sfda.gov.sa/ar/regulations/69390' },
  'STORAGE-MDS': { title: 'تهيئة منطقة التخزين', clause: 'تكون نظيفة، مضاءة ومهوّاة، وبمساحة تسمح بالتنظيف والفحص، مع أسطح وأرفف مناسبة.', source: 'MDS-REQ 12 — منطقة التخزين', page: 'الصفحتان 4–5', url: 'https://www.sfda.gov.sa/ar/regulations/88142' },
  'ISOLATE-MDS': { title: 'عزل المنتجات ذات الحالات الخاصة', clause: 'يخصص مكان واضح للمحرز والمرتجع والمستدعى والتالف والمنتهي، ويُراقب إلى حين التصرف.', source: 'MDS-REQ 12 — منطقة التخزين', page: 'الصفحة 5', url: 'https://www.sfda.gov.sa/ar/regulations/88142' },
  'COLD-MDS': { title: 'مراقبة درجات الحرارة وخطة الطوارئ', clause: 'تطبق تعليمات المصنع وتتوفر المراقبة والإنذارات وخطة طوارئ للمنتجات التي تحتاج إلى تبريد.', source: 'MDS-REQ 12', page: 'الصفحتان 5–7', url: 'https://www.sfda.gov.sa/ar/regulations/88142' },
  'PRODUCT-MDS': { title: 'الالتزام بالمعلومات التعريفية وتعليمات المصنع', clause: 'تشمل المعلومات طرق التخزين والنقل، ويلزم الالتزام بها في الإجراءات ذات العلاقة.', source: 'MDS-REQ 12', page: 'الصفحتان 4 و6', url: 'https://www.sfda.gov.sa/ar/regulations/88142' }
};
const visualCaseConfig = {
  temperature: { label: 'قارئ الحرارة والرطوبة', requirementIds: ['TEMP-MDS', 'TEMP-GDP'], evidence: ['شهادة المعايرة السارية ورقم الجهاز', 'الخارطة الحرارية وموقع القارئ عليها', 'سجل القراءات والتنبيهات والتجاوزات', 'إجراء التعامل مع تجاوز درجات الحرارة'] },
  receiving: { label: 'منطقة الاستلام', requirementIds: ['RECEIVE-GDP', 'RECEIVE-SOP'], evidence: ['إجراء الاستلام المعتمد', 'سجل فحص الشحنة ودرجات الحرارة', 'حالة قبول أو تعليق الشحنة', 'بيانات الناقل والتشغيلة والكميات'] },
  storage: { label: 'منطقة التخزين', requirementIds: ['STORAGE-MDS', 'TEMP-MDS'], evidence: ['تعليمات المصنع لظروف التخزين', 'الخارطة الحرارية', 'سجلات التنظيف ومكافحة الآفات', 'قياسات المسافات عند الاشتباه'] },
  isolation: { label: 'منطقة العزل', requirementIds: ['ISOLATE-MDS'], evidence: ['سجل العزل والكميات والتشغيلات', 'صلاحيات الدخول', 'قرارات السحب أو التحريز', 'إجراء التصرف والإتلاف أو الإرجاع'] },
  cold: { label: 'ثلاجة أو مجمد', requirementIds: ['COLD-MDS', 'TEMP-GDP'], evidence: ['سجل الحرارة المستمر', 'اختبار الإنذار', 'شهادة معايرة المسبار', 'خطة الطوارئ ومصدر الطاقة الاحتياطي'] },
  product: { label: 'منتج أو بطاقة', requirementIds: ['PRODUCT-MDS'], evidence: ['صورة المكونات والادعاءات', 'رقم التشغيلة والصلاحية', 'الباركود أو رقم التسجيل', 'البحث الفعلي في قواعد التسجيل والتحذيرات والسحب'] }
};

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code.replace(/^x/i, ''), /^x/i.test(code) ? 16 : 10)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}
function plainText(html) {
  return decodeEntities(String(html || '').replace(/<script\\b[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style\\b[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\\s+/g, ' ').trim();
}
function absoluteUrl(href) { try { return new URL(decodeEntities(href), SFDA_BASE).href; } catch { return ''; } }
function firstHref(html, patterns) {
  const links = [...String(html || '').matchAll(/href=["']([^"']+)["']/gi)].map(match => match[1]);
  return links.find(href => patterns.some(pattern => pattern.test(href))) || '';
}
function articleBlocks(html) {
  const articles = String(html || '').match(/<article\\b[\\s\\S]*?<\\/article>/gi) || [];
  if (articles.length) return articles;
  return String(html || '').match(/<div\\b[^>]*class=["'][^"']*views-row[^"']*["'][^>]*>[\\s\\S]*?(?=<div\\b[^>]*class=["'][^"']*views-row|<nav\\b|<footer\\b)/gi) || [];
}
function parseArticles(html, source, kind) {
  return articleBlocks(html).map((block, index) => {
    const rawText = plainText(block).replace(/^(?:Image\\s*)+/i, '').trim();
    const date = (rawText.match(/\\b20\\d{2}-\\d{2}-\\d{2}\\b/) || [])[0] || '';
    const href = firstHref(block, kind === 'warning' ? [/\\/ar\\/warnings\\/\\d+/i]
      : [/\\/sites\\/default\\/files\\//i, /\\/ar\\/node\\/\\d+/i, /\\/ar\\/(?:regulations|Guide|circulars)\\//i]);
    const titledAnchor = [...block.matchAll(/<a\\b[^>]*href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi)]
      .map(match => plainText(match[2])).filter(text => text && !/^(?:image|عرض|فتح|المزيد)$/i.test(text))
      .sort((a, b) => b.length - a.length)[0];
    const descriptiveText = rawText.replace(date, '').replace(/(?:Image|عرض|فتح|المزيد)/gi, ' ').replace(/\\s+/g, ' ').trim();
    const title = kind === 'warning' ? (titledAnchor || descriptiveText) : descriptiveText;
    if (!title || !href) return null;
    return { id: source + '-' + index, source, kind, title, date,
      status: /غير فعال/.test(rawText) ? 'غير فعال' : /فعال/.test(rawText) ? 'فعال' : '',
      details: rawText, url: absoluteUrl(href) };
  }).filter(Boolean);
}
function parseRecalls(html) {
  const rows = String(html || '').match(/<tr\\b[\\s\\S]*?<\\/tr>/gi) || [];
  return rows.map((row, index) => {
    const cells = [...row.matchAll(/<td\\b[^>]*>([\\s\\S]*?)<\\/td>/gi)].map(match => plainText(match[1]));
    const href = firstHref(row, [/\\/ar\\/node\\/\\d+/i]);
    if (cells.length < 5 || !href) return null;
    return { id: 'recall-' + index, source: 'السحب والاستدعاء للمنتجات العلاجية', kind: 'recall',
      title: cells[0], productType: cells[1], action: cells[2], level: cells[3], date: cells[4],
      status: cells[2], details: cells.slice(1, 5).join(' • '), url: absoluteUrl(href) };
  }).filter(Boolean);
}
function parseSafetyAlerts(html) {
  const rows = String(html || '').match(/<tr\\b[\\s\\S]*?<\\/tr>/gi) || [];
  return rows.map((row, index) => {
    const cells = [...row.matchAll(/<td\\b[^>]*>([\\s\\S]*?)<\\/td>/gi)].map(match => plainText(match[1]));
    const href = firstHref(row, [/\\/sites\\/default\\/files\\//i, /\\/ar\\/node\\/\\d+/i]);
    if (cells.length < 4 || !href) return null;
    return { id: 'safety-alert-' + index, source: 'تحذيرات السلامة الدوائية', kind: 'safety_alert',
      title: cells[1], status: cells[2], date: cells[3], details: cells.slice(1, 4).join(' • '),
      url: absoluteUrl(href) };
  }).filter(Boolean);
}
function normalizeSearch(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\\u064b-\\u065f\\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\\u0600-\\u06ff0-9a-z]+/gi, ' ').trim();
}
function relevantRecord(record, query) {
  const words = normalizeSearch(query).split(/\\s+/).filter(word => word.length > 1);
  const haystack = normalizeSearch([record.title, record.details, record.productType, record.action].filter(Boolean).join(' '));
  if (!words.length) return false;
  const normalizedQuery = words.join(' ');
  if (haystack.includes(normalizedQuery)) return true;
  const matchedWords = words.filter(word => haystack.includes(word)).length;
  return words.length === 1 ? matchedWords === 1 : matchedWords >= Math.ceil(words.length * 0.6);
}
async function fetchOfficial(url, parser) {
  const response = await fetch(url, { headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'SFDA-Regulatory-Finder/0.9' } });
  if (!response.ok) throw new Error('SFDA ' + response.status);
  return parser(await response.text());
}
async function officialSearch(requestUrl) {
  const query = String(requestUrl.searchParams.get('q') || '').trim().slice(0, 160);
  if (query.length < 2) return Response.json({ query, records: [], error: 'أدخل كلمتين على الأقل.' }, { status: 400 });
  const q = encodeURIComponent(query);
  const searches = [
    ['warnings', 'بوابة تحذيرات الهيئة', 'warning', SFDA_BASE + '/ar/warnings?keys=' + q + '&date%5Bmin%5D=&date%5Bmax%5D=&tags=All&field_warning_number=', parseArticles],
    ['recalls', 'السحب والاستدعاء للمنتجات العلاجية', 'recall', SFDA_BASE + '/ar/drugs-circulars-withdrawal?combine=' + q + '&field_product_type=All&date%5Bmin%5D=&date%5Bmax%5D=', null],
    ['safety-alerts', 'تحذيرات السلامة الدوائية', 'safety_alert', SFDA_BASE + '/ar/safety-alert?title=' + q + '&type_of_news=All', parseSafetyAlerts],
    ['regulations', 'الأنظمة واللوائح', 'legislation', SFDA_BASE + '/ar/regulations?keys=' + q + '&regulation_type=All&date%5Bmin%5D=&date%5Bmax%5D=&tags=All', parseArticles],
    ['guides', 'الأدلة الإرشادية', 'guide', SFDA_BASE + '/ar/Guide?keys=' + q + '&date%5Bmin%5D=&date%5Bmax%5D=&tags=All', parseArticles],
    ['circulars', 'التعاميم', 'circular', SFDA_BASE + '/ar/circulars?date%5Bmin%5D=&date%5Bmax%5D=&tags=All&keys=' + q + '&field_country_name=All&field_customer_type=All&field_scope_of_regulation=All&field_mainstreaming=All&field_circular_status=All&field_food_group=All&field_drug_group=All&field_md_group=All&field_feed_group=All&field_cosmetic_group=All&field_pesticides_group=All', parseArticles]
  ];
  const settled = await Promise.allSettled(searches.map(async ([key, label, kind, url, parser]) => {
    const records = await fetchOfficial(url, html => parser ? parser(html, label, kind) : parseRecalls(html));
    return { key, label, ok: true, records: records.filter(record => relevantRecord(record, query)).slice(0, 12) };
  }));
  const sources = settled.map((result, index) => result.status === 'fulfilled' ? result.value
    : { key: searches[index][0], label: searches[index][1], ok: false, records: [], error: String(result.reason?.message || result.reason) });
  const records = sources.flatMap(source => source.records)
    .filter((record, index, all) => all.findIndex(item => item.url === record.url && item.title === record.title) === index);
  return Response.json({ query, searchedAt: new Date().toISOString(), records, sources }, {
    headers: { 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' }
  });
}
function extractResponseText(payload) {
  if (payload && typeof payload.output_text === 'string') return payload.output_text;
  const items = (payload && Array.isArray(payload.output) ? payload.output : [])
    .flatMap(item => Array.isArray(item.content) ? item.content : []);
  const output = items.find(item => item && item.type === 'output_text' && typeof item.text === 'string');
  return output ? output.text : '';
}
function cleanVisualItem(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/\\s+/g, ' ').trim().slice(0, 500);
}
async function visualAnalysis(request, env) {
  if (request.method !== 'POST') return Response.json({ error: 'طريقة الطلب غير مدعومة.' }, { status: 405 });
  const apiKey = env && env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'التحليل الحقيقي للصور لم يُفعّل بعد على الخادم؛ يلزم إضافة مفتاح OpenAI في إعدادات الاستضافة الآمنة.' }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'بيانات الصورة غير صالحة.' }, { status: 400 }); }
  const config = visualCaseConfig[String(body.caseType || '')];
  const image = String(body.image || '');
  if (!config) return Response.json({ error: 'نوع الحالة غير مدعوم.' }, { status: 400 });
  if (!/^data:image\\/(?:jpeg|png|webp);base64,/i.test(image) || image.length > 9000000) {
    return Response.json({ error: 'الصورة غير صالحة أو يتجاوز حجمها الحد المسموح.' }, { status: 400 });
  }
  const context = cleanVisualItem(body.context).slice(0, 600);
  const allowedIds = config.requirementIds.join(', ');
  const prompt = [
    'أنت مساعد تفتيش بصري للهيئة العامة للغذاء والدواء. حلل فقط ما يظهر في الصورة ولا تفترض وجود مخالفة أو مطابقة.',
    'نوع الحالة: ' + config.label + '.',
    context ? 'سياق المفتش: ' + context : '',
    'المتطلبات المسموح ربطها فقط: ' + allowedIds + '.',
    'أعد JSON فقط دون Markdown بهذا الشكل:',
    '{"summary":"ملخص عربي موجز","observations":[{"finding":"حقيقة مرئية","evidence":"ما يظهر في الصورة","confidence":"high|medium|low"}],"requirementIds":["ID"],"evidenceNeeded":["دليل إضافي مطلوب"]}',
    'قواعد إلزامية: لا تقل إن الحالة مخالفة أو مطابقة. لا تختر معرفًا خارج القائمة. لا تخمّن قراءة غير واضحة أو صلاحية معايرة. اجعل الملاحظات بحد أقصى 6 والأدلة الإضافية بحد أقصى 6.'
  ].filter(Boolean).join('\\n');
  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: (env && env.OPENAI_VISION_MODEL) || 'gpt-5.4-mini',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image, detail: 'high' }] }]
    })
  });
  if (!upstream.ok) {
    await upstream.text();
    return Response.json({ error: 'تعذر تشغيل محرك الرؤية الآن.' }, { status: 502 });
  }
  const payload = await upstream.json();
  const fence = String.fromCharCode(96).repeat(3);
  const text = extractResponseText(payload).replace(fence + 'json', '').replace(fence, '').trim();
  let parsed;
  try { parsed = JSON.parse(text); } catch { return Response.json({ error: 'أعاد محرك الرؤية نتيجة غير قابلة للعرض المنظم.' }, { status: 502 }); }
  const observations = (Array.isArray(parsed.observations) ? parsed.observations : []).slice(0, 6).map(item => ({
    finding: cleanVisualItem(item.finding), evidence: cleanVisualItem(item.evidence),
    confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'low'
  })).filter(item => item.finding);
  const selectedIds = (Array.isArray(parsed.requirementIds) ? parsed.requirementIds : [])
    .filter(id => config.requirementIds.includes(id));
  const requirementIds = selectedIds.length ? [...new Set(selectedIds)] : config.requirementIds;
  const evidenceNeeded = (Array.isArray(parsed.evidenceNeeded) ? parsed.evidenceNeeded : config.evidence)
    .slice(0, 6).map(cleanVisualItem).filter(Boolean);
  return Response.json({
    summary: cleanVisualItem(parsed.summary) || 'تم تحليل العناصر المرئية في الصورة بصورة استرشادية.',
    observations, requirements: requirementIds.map(id => visualRequirements[id]).filter(Boolean),
    evidenceNeeded: evidenceNeeded.length ? evidenceNeeded : config.evidence,
    analyzedAt: new Date().toISOString(), stored: false
  }, { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/official-search') return officialSearch(url);
    if (url.pathname === '/api/visual-analysis') return visualAnalysis(request, env);
    const file = files[url.pathname] || files['/'];
    return new Response(file.body, { status: 200, headers: {
      'content-type': file.type, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff'
    }});
  }
};
`;
fs.mkdirSync(path.join(output, 'server'), { recursive: true });
fs.writeFileSync(path.join(output, 'server', 'index.js'), worker);
fs.mkdirSync(path.join(output, '.openai'), { recursive: true });
fs.copyFileSync(
  path.join(__dirname, '.openai', 'hosting.json'),
  path.join(output, '.openai', 'hosting.json')
);

console.log('Static site built in dist/');

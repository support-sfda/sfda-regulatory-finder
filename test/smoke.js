const fs = require('fs');
const path = require('path');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const sources = fs.readFileSync(path.join(root, 'public', 'sources.js'), 'utf8');
const contentIndex = fs.readFileSync(path.join(root, 'public', 'content-index.js'), 'utf8');
const classificationLibrary = fs.readFileSync(path.join(root, 'public', 'classification-library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;

window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.eval(sources);
window.eval(contentIndex);
window.eval(classificationLibrary);
window.eval(app);

const document = window.document;
const click = selector => document.querySelector(selector).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const change = selector => document.querySelector(selector).dispatchEvent(new window.Event('change', { bubbles: true }));
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
};

expect(document.querySelectorAll('.result-card').length === 52, 'تظهر جميع المصادر الرسمية عند فتح البحث');
expect(window.SFDA_CLASSIFICATION_LIBRARY.length === 138, 'مكتبة دليل التصنيف تحتوي 138 قاعدة موثقة');

document.querySelector('#searchInput').value = 'إعادة التسجيل عند تغيير بلد المنشأ';
click('#searchBtn');
expect(document.querySelectorAll('.text-hit').length >= 1, 'البحث يعرض مطابقة موثقة داخل نص اللائحة');
expect(document.querySelector('.text-hit').textContent.includes('المادة (11)'), 'المطابقة النصية تعرض رقم المادة');

document.querySelector('#searchInput').value = 'تصنيف';
click('#searchBtn');
expect(document.querySelectorAll('.result-card').length >= 2, 'البحث النصي عن «تصنيف» يعيد نتائج');

document.querySelector('#searchInput').value = 'عسل';
click('#searchBtn');
expect(document.querySelector('[data-regulatory-dossier]'), 'البحث عن المنتج ينشئ ملفًا رقابيًا شاملًا');
expect(document.querySelectorAll('.dossier-group').length === 6, 'الملف الرقابي يغطي ستة محاور');
expect(document.querySelector('[data-relation="alerts"]')?.textContent.includes('بوابة تحذيرات الهيئة'), 'الملف يفرض فحص بوابة التحذيرات الحية');
expect(document.querySelector('[data-relation="alerts"]')?.textContent.includes('@Saudi_FDA'), 'الملف يضم البحث في حساب الهيئة الرسمي');
expect(document.querySelector('[data-relation="composition"]'), 'الملف يشمل المواصفات والمكونات والتركيب');
expect(!document.querySelector('[data-relation="classification"]')?.textContent.includes('تصنيف المخالفات'), 'لا يخلط محور تصنيف المنتج مع جداول تصنيف المخالفات');
expect(document.querySelector('.product-guide')?.textContent.includes('منتج غذائي'), 'البحث عن العسل يعرض مسار الغذاء ومراجع المنتج');
expect(document.querySelectorAll('.product-links a').length === 4, 'دليل العسل يعرض أربعة مراجع رسمية');

document.querySelector('#searchInput').value = 'مناديب';
click('#searchBtn');
expect(document.querySelector('.product-guide')?.textContent.includes('هل تقصد: مناديل'), 'البحث يصحح «مناديب» إلى «مناديل»');
expect(document.querySelector('.product-guide')?.textContent.includes('يلزم تحديد الاستخدام'), 'نتيجة المناديل تمنع التصنيف من الاسم وحده');

for (const [query, expected] of [
  ['لحم', 'منتج غذائي'],
  ['دجاج', 'منتج غذائي'],
  ['كمامات طبية', 'جهاز أو مستلزم طبي'],
  ['كريم تفتيح', 'منتج تجميلي'],
  ['بنادول', 'مستحضر صيدلاني'],
  ['طعام قطط', 'منتج علفي'],
  ['مبيد حشري', 'مسار التحقق من المبيدات'],
  ['لقاح بيطري', 'مستحضر بيطري']
]) {
  document.querySelector('#searchInput').value = query;
  click('#searchBtn');
  expect(document.querySelector('.product-guide')?.textContent.includes(expected), `محرك المنتجات يصنف «${query}» إلى المسار المتوقع`);
  expect(document.querySelectorAll('.product-links a').length === 4, `مسار «${query}» يعرض أربعة مراجع رسمية`);
}

const coverageCases = [
  ['بيض', 'منتج غذائي'], ['تونة', 'منتج غذائي'], ['مايونيز', 'منتج غذائي'], ['مخللات', 'منتج غذائي'],
  ['طحين', 'منتج غذائي'], ['زبادي', 'منتج غذائي'], ['food supplement', 'منتج غذائي'],
  ['طعام طيور', 'منتج علفي'], ['بذور طيور', 'منتج علفي'], ['مكعبات علف', 'منتج علفي'],
  ['pet food', 'منتج علفي'], ['feed additive', 'منتج علفي'],
  ['مبيد أعشاب', 'مسار التحقق من المبيدات'], ['سم فئران', 'مسار التحقق من المبيدات'],
  ['insecticide', 'مسار التحقق من المبيدات'], ['fungicide', 'مسار التحقق من المبيدات'],
  ['قسطرة', 'جهاز أو مستلزم طبي'], ['كانيولا', 'جهاز أو مستلزم طبي'], ['اختبار حمل', 'جهاز أو مستلزم طبي'],
  ['جهاز أكسيميتر', 'جهاز أو مستلزم طبي'], ['surgical mask', 'جهاز أو مستلزم طبي'], ['infusion pump', 'جهاز أو مستلزم طبي'],
  ['لوشن جسم', 'منتج تجميلي'], ['صبغة شعر', 'منتج تجميلي'], ['حناء شعر', 'منتج تجميلي'],
  ['روج', 'منتج تجميلي'], ['صن بلوك', 'منتج تجميلي'], ['مزيل عرق', 'منتج تجميلي'],
  ['Panadol', 'مستحضر صيدلاني'], ['Paracetamol', 'مستحضر صيدلاني'], ['Amoxicillin', 'مستحضر صيدلاني'],
  ['أسبرين', 'مستحضر صيدلاني'], ['Metformin', 'مستحضر صيدلاني'], ['normal saline', 'مستحضر صيدلاني'],
  ['مضاد ديدان حيواني', 'مستحضر بيطري'], ['علاج قراد', 'مستحضر بيطري'],
  ['veterinary vaccine', 'مستحضر بيطري'], ['animal dewormer', 'مستحضر بيطري']
];

for (const [query, expected] of coverageCases) {
  document.querySelector('#searchInput').value = query;
  click('#searchBtn');
  expect(document.querySelector('.product-guide')?.textContent.includes(expected), `اختبار التغطية يصنف «${query}» تصنيفًا استرشاديًا صحيحًا`);
}
expect(coverageCases.length >= 35, 'حزمة التغطية الموسعة تختبر 35 منتجًا إضافيًا على الأقل');

document.querySelector('#searchInput').value = 'زرفتونكس';
click('#searchBtn');
expect(document.querySelector('.product-guide')?.textContent.includes('ابدأ بمسار التصنيف'), 'المنتج غير المعروف يعرض مسار تصنيف بدلاً من صفحة فارغة');

for (const query of ['محاليل', 'IV']) {
  document.querySelector('#searchInput').value = query;
  click('#searchBtn');
  expect(document.querySelector('.product-guide')?.textContent.includes('حدّد المنتج المقصود'), `المصطلح المتداخل «${query}» يطلب تحديد المحلول أو طقم الإعطاء`);
}

for (const [query, expected] of [['محلول ملحي وريدي', 'مستحضر صيدلاني'], ['IV solution', 'مستحضر صيدلاني'], ['طقم محلول', 'جهاز أو مستلزم طبي'], ['IV set', 'جهاز أو مستلزم طبي']]) {
  document.querySelector('#searchInput').value = query;
  click('#searchBtn');
  expect(document.querySelector('.product-guide')?.textContent.includes(expected), `التفصيل «${query}» يعرض المسار الصحيح`);
}

for (const [query, expected] of [
  ['عسل', 'العسل ومنتجات النحل الغذائية'],
  ['محلول ملحي وريدي', 'المحاليل الملحية والماء المعقم للحقن الوريدي'],
  ['معقم يد كحولي', 'معقمات اليد الكحولية'],
  ['شامبو حيوان مبيد', 'شامبو الحيوانات المبيد للحشرات'],
  ['عدسات لاصقة', 'العدسات اللاصقة التجميلية والطبية'],
  ['فيلر هيالورونيك', 'الفيلر الجلدي بحمض الهيالورونيك'],
  ['كمامة قماش', 'الأقنعة والقفازات غير الطبية'],
  ['علف مركب', 'الأعلاف المركبة']
]) {
  document.querySelector('#searchInput').value = query;
  click('#searchBtn');
  expect([...document.querySelectorAll('.classification-hit')].some(card => card.textContent.includes(expected)), `مكتبة دليل التصنيف تعيد القاعدة «${expected}»`);
  expect([...document.querySelectorAll('.classification-hit')].some(card => card.textContent.includes('صفحة الدليل')), `نتيجة «${query}» تعرض الصفحة المرجعية`);
}

document.querySelector('#searchInput').value = '';
document.querySelector('#sectorFilter').value = 'الأجهزة الطبية';
change('#sectorFilter');
expect(document.querySelectorAll('.result-card').length === 11, 'تصفية مجال الأجهزة الطبية تعمل');

click('#resetFilters');
for (const [query, expected] of [
  ['سحب العلف غير المطابق', 'سحب العلف غير المطابق'],
  ['إذن التسويق والمطابقة قبل الاستيراد', 'إذن التسويق'],
  ['حظر تسويق المستحضر قبل تسجيله', 'حظر تسويق المستحضر'],
  ['تسجيل المستحضر البيطري قبل الاستيراد', 'تسجيل المستحضر البيطري']
]) {
  document.querySelector('#searchInput').value = query;
  click('#searchBtn');
  expect(document.querySelectorAll('.text-hit').length >= 1, `البحث الموثق يعمل لعبارة «${query}»`);
  expect([...document.querySelectorAll('.text-hit')].some(card => card.textContent.includes(expected)), `تظهر النتيجة الصحيحة لعبارة «${query}»`);
}

click('#resetFilters');
document.querySelector('#quickSearch').value = 'إذن التسويق';
click('#quickSearchBtn');
expect(document.querySelectorAll('.result-card').length >= 1, 'البحث السريع من الرئيسية يعمل');

for (const button of document.querySelectorAll('[data-query]')) {
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  expect(document.querySelectorAll('.result-card').length >= 1, `الاقتراح السريع «${button.dataset.query}» يعيد نتيجة`);
}

document.querySelector('#productName').value = 'كريم ترطيب';
document.querySelector('#intendedUse').value = 'cosmetic';
document.querySelector('#claims').value = 'ترطيب وتحسين مظهر البشرة';
document.querySelector('#classifyForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
expect(document.querySelector('#classificationResult').hidden === false, 'نموذج التصنيف يعرض نتيجة');
expect(document.querySelector('#classificationResult').textContent.includes('مستحضرات التجميل'), 'التصنيف التجميلي الاسترشادي يعمل');

document.querySelector('#verifyInput').value = '123456789';
click('#verifyBtn');
expect(document.querySelector('#verifyOutput').textContent.includes('التحقق غير مكتمل'), 'واجهة التحقق تعرض القواعد الرسمية المناسبة دون استنتاج مضلل');

document.querySelector('#verifyDomain').value = 'device';
document.querySelector('#verifyInput').value = 'UDI-123';
document.querySelector('#verifyCompany').value = 'شركة اختبار';
document.querySelector('#verifyBatch').value = 'LOT-77';
click('#verifyBtn');
expect(document.querySelectorAll('.verification-links a').length === 4, 'مسار تحقق الأجهزة يعرض التسجيل والتحذير والمتطلب');
expect(document.querySelector('.case-summary').textContent.includes('LOT-77'), 'محضر التحقق يعرض رقم التشغيلة');
expect(document.querySelectorAll('[data-check-source]').length === 4, 'قائمة الفحص الرسمية قابلة للتوثيق');
for (const checkbox of document.querySelectorAll('[data-check-source]')) {
  checkbox.checked = true;
  checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
}
expect(document.querySelector('.case-status').classList.contains('complete'), 'حالة المحضر تتحدث بعد فحص جميع المصادر');
expect(document.querySelector('.copy-report'), 'زر نسخ محضر التحقق متاح');

click('[data-route="visual"]');
expect(document.querySelector('#visual').classList.contains('active'), 'صفحة التحليل البصري متاحة من التنقل');
expect(document.querySelectorAll('[data-visual-case]').length === 6, 'التحليل البصري يغطي ست حالات رقابية أولية');
click('#visualExampleBtn');
expect(document.querySelector('#visualResult').hidden === false, 'يمكن عرض مثال تحليلي قبل تفعيل محرك الرؤية');
expect(document.querySelector('#visualResult').textContent.includes('ليس تحليلًا للصورة'), 'المثال التوضيحي لا يوهم بأنه تحليل فعلي');
expect(document.querySelectorAll('#visualResult .visual-requirement').length >= 1, 'النتيجة البصرية ترتبط بمتطلب SFDA رسمي');
expect(document.querySelector('#visualAnalyzeBtn').disabled, 'لا يبدأ تحليل فعلي قبل اختيار صورة');

console.log('All smoke tests passed.');

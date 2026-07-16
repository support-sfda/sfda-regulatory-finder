const sources = Array.isArray(window.SFDA_SOURCES) ? window.SFDA_SOURCES : [];
const contentIndex = Array.isArray(window.SFDA_CONTENT_INDEX) ? window.SFDA_CONTENT_INDEX : [];
const classificationLibrary = Array.isArray(window.SFDA_CLASSIFICATION_LIBRARY) ? window.SFDA_CLASSIFICATION_LIBRARY : [];
let liveSearchSequence = 0;

const normalize = value => (value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u064b-\u065f\u0670]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/[^\u0600-\u06ff0-9a-z]+/gi, ' ')
  .trim();

const escapeHTML = value => String(value || '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const authorityLabel = code => {
  if (code.includes('A1')) return 'نظام/قانون';
  if (code.includes('A2')) return 'لائحة تنفيذية';
  if (code.includes('A3')) return 'متطلب أو إجراء رقابي';
  if (code.includes('B1')) return 'دليل رسمي';
  return 'خدمة أو سجل رسمي';
};

const authorityRank = code => code.includes('A1') ? 6 : code.includes('A2') ? 5 : code.includes('A3') ? 4 : code.includes('B1') ? 3 : 2;
const synonyms = {
  سحب: ['استدعاء', 'تحذير', 'مسحوب'], استدعاء: ['سحب', 'تحذير'], تحذير: ['سحب', 'استدعاء', 'سلامه'],
  تسجيل: ['ادراج', 'اخطار', 'اذن', 'تسويق'], ادراج: ['تسجيل', 'اخطار'], تصنيف: ['فئه', 'نوع', 'مجال'],
  دواء: ['صيدلانيه', 'علاجيه', 'مستحضر'], بيطري: ['بيطريه', 'حيوان'], جهاز: ['اجهزه', 'مستلزمات', 'طبي'],
  مخالفه: ['مخالفات', 'عقوبات', 'ضبط'], تخزين: ['نقل', 'توزيع', 'حراره'], اعلان: ['دعايه', 'ادعاءات', 'ترويج']
};

const regulatoryRelationDefinitions = [
  {
    key: 'classification', label: 'التصنيف ونطاق الخضوع', icon: '◇',
    test: source => {
      const text = normalize(`${source.title} ${source.themes}`);
      return source.id === 'SRC-004' || (!text.includes('مخالفات') && /تصنيف الاجهزه|قواعد التصنيف|المنتجات المتداخله|فئه الخطوره/.test(text));
    }
  },
  {
    key: 'registration', label: 'التسجيل والإدراج والفسح', icon: '✓',
    test: source => /تسجيل|ادراج|اخطار|اذن التسويق|فسح|ترميز|قاعده منتجات|معلومات دوائيه/.test(normalize(`${source.title} ${source.themes} ${source.type}`))
  },
  {
    key: 'legislation', label: 'الأنظمة واللوائح والقرارات', icon: '§',
    test: source => /A1|A2/.test(source.authority) || /نظام|لايحه|مخالفات|عقوبات/.test(normalize(source.type))
  },
  {
    key: 'requirements', label: 'الأدلة والاشتراطات والرقابة', icon: '≡',
    test: source => /دليل|متطلبات|اشتراط|تفتيش|تتبع|تخزين|نقل|اعلان|دعايه/.test(normalize(`${source.title} ${source.themes} ${source.type}`))
  },
  {
    key: 'composition', label: 'المواصفات والمكونات والتركيب', icon: '◉',
    test: source => /مواصف|مكون|تركيب|ماده فعاله|مواد|اضافات|بطاقه|ملصق|ادعاءات|تركيز|عبوه|نشره|جوده|مطابقه/.test(normalize(`${source.title} ${source.themes}`))
  },
  {
    key: 'alerts', label: 'التحذير والسحب والتنبيه', icon: '!',
    test: source => sourceCategory(source) === 'alert' || /سحب|استدعاء|تحذير|انذار سلامه|اجراء تصحيحي/.test(normalize(`${source.title} ${source.themes}`))
  }
];

function officialXSearchUrl(query) {
  return `https://x.com/search?q=${encodeURIComponent(`from:Saudi_FDA \"${String(query || '').trim()}\"`)}&src=typed_query&f=live`;
}

function buildRegulatoryDossier(query, productMatch, classificationMatches) {
  if (!normalize(query) || !productMatch) return '';
  const guide = productMatch.guide;
  const classifiedDomains = [...new Set(classificationMatches.map(item => item.domain)
    .filter(item => item && item !== 'عام مشترك'))];
  const targetDomains = guide.sourceDomain ? [guide.sourceDomain] : classifiedDomains.slice(0, 2);
  const relevant = sources.filter(source => source.domain === 'عام مشترك' || targetDomains.includes(source.domain));
  const relationGroups = regulatoryRelationDefinitions.map(definition => ({
    ...definition,
    items: relevant.filter(definition.test)
  }));
  const uniqueSourceCount = new Set(relationGroups.flatMap(group => group.items.map(item => item.id))).size;
  const matchedRules = classificationMatches.length;
  const domainLabel = targetDomains.length ? targetDomains.join(' / ') : guide.domain;
  const groupHTML = relationGroups.map(group => {
    const links = group.items.slice(0, 8).map(source => `<a href="${source.url}" target="_blank" rel="noopener" data-dossier-source="${source.id}">
      <span><b>${escapeHTML(source.title)}</b><small>${escapeHTML(source.type)} • ${escapeHTML(authorityLabel(source.authority))}</small></span><strong>↗</strong>
    </a>`).join('');
    const classificationLink = group.key === 'classification' && matchedRules
      ? `<div class="dossier-rule-note">وجد المحرك ${matchedRules} قاعدة أو مثالًا مطابقًا في دليل تصنيف المنتجات 8.0؛ تظهر بالتفصيل أسفل الملف.</div>` : '';
    const alertTools = group.key === 'alerts' ? `<a class="live-check" href="https://www.sfda.gov.sa/ar/warnings" target="_blank" rel="noopener"><span><b>البحث الحي في بوابة تحذيرات الهيئة</b><small>ابحث بالاسم العربي والإنجليزي والعلامة ورقم التشغيلة</small></span><strong>↗</strong></a>
      <a class="live-check social" href="${officialXSearchUrl(query)}" target="_blank" rel="noopener"><span><b>البحث عن «${escapeHTML(query)}» في منشورات @Saudi_FDA</b><small>حساب الهيئة الرسمي على منصة X — مسار مساند للتحقق</small></span><strong>↗</strong></a>` : '';
    const emptyNote = !links && !classificationLink && !alertTools ? '<small class="dossier-empty">لا يوجد مصدر مفهرس في هذه الفئة لهذا المسار؛ استخدم بوابة الأنظمة الرسمية.</small>' : '';
    return `<section class="dossier-group" data-relation="${group.key}"><h4><i>${group.icon}</i>${group.label}<span>${group.items.length}</span></h4>${classificationLink}${links}${alertTools}${emptyNote}</section>`;
  }).join('');
  return `<article class="regulatory-dossier" data-regulatory-dossier>
    <div class="dossier-head"><div><span class="eyebrow">الملف الرقابي الشامل</span><h2>${escapeHTML(query)}</h2><p>المسار المحتمل: <b>${escapeHTML(domainLabel)}</b> • ${uniqueSourceCount} مصدرًا رسميًا مرتبطًا • ${matchedRules} قاعدة تصنيف مطابقة</p></div><span class="dossier-mark">⌕</span></div>
    <div class="dossier-scope"><b>نطاق البحث:</b> لا يقتصر على خضوع المنتج؛ بل يشمل الاسم والعلامة والمكونات والتركيز والتركيب والادعاءات وطريقة الاستخدام والتشغيلة، وأي لائحة أو دليل أو اشتراط أو تحذير أو سحب مرتبط بها.</div>
    <div class="dossier-grid">${groupHTML}</div>
    <div class="dossier-warning"><b>مهم:</b> عدم ظهور نتيجة محلية لا يثبت عدم وجود تعميم أو سحب. افتح قواعد الهيئة الحية، وابحث كذلك بالاسم الإنجليزي والعلامة والشركة ورقم التشغيلة، ثم وثّق تاريخ البحث.</div>
  </article>`;
}

const productGuides = [
  {
    id: 'PRODUCT-HONEY',
    aliases: ['عسل', 'عسل نحل', 'عسل النحل', 'عسل سدر'],
    canonical: 'عسل',
    sourceDomain: 'الغذاء',
    domain: 'الغذاء',
    title: 'العسل — منتج غذائي',
    summary: 'يعامل العسل في الأصل كمنتج غذائي. ابدأ بالتحقق من تسجيل المنتج والبطاقة والمنشأة، ثم راجع متطلبات إنتاج وتداول واستيراد العسل وأي تحذير أو حظر سارٍ.',
    caution: 'قد تتغير المتطلبات إذا حمل المنتج ادعاءات علاجية أو أضيفت إليه مكونات أخرى؛ عندها يلزم التحقق من التصنيف الفعلي.',
    links: [
      ['دليل إنتاج وتداول واستيراد العسل ومنتجات النحل', 'https://www.sfda.gov.sa/sites/default/files/2021-03/%D8%AF%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%B9%D8%B3%D9%84%202021.pdf'],
      ['قائمة المنتجات الغذائية المسجلة', 'https://www.sfda.gov.sa/ar/products'],
      ['اللائحة التنفيذية لنظام الغذاء', 'https://www.sfda.gov.sa/ar/regulations/3785396'],
      ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']
    ]
  },
  {
    id: 'PRODUCT-IV-AMBIGUOUS',
    aliases: ['محاليل', 'iv'],
    exactOnly: true,
    canonical: '',
    sourceDomain: '',
    domain: 'دواء / أجهزة طبية',
    title: 'محاليل / IV — حدّد المنتج المقصود',
    summary: 'المصطلح وحده متداخل: إذا كان المقصود السائل أو المحلول الوريدي نفسه فالمسار غالبًا صيدلاني، أما طقم التسريب والأنابيب والموصلات والمضخة فهي أجهزة أو مستلزمات طبية.',
    caution: 'لنتيجة أدق اكتب مثلًا: «محلول ملحي وريدي» أو «IV solution»، أو «طقم محلول» أو «IV set»، وأضف الاسم والتركيز أو رقم الطراز عند التحقق.',
    links: [
      ['دليل تصنيف المنتجات في الهيئة', 'https://www.sfda.gov.sa/sites/default/files/2024-11/SFDA-ProductsClassificationGuidanceV7A.pdf'],
      ['المعلومات الدوائية الرسمية', 'https://sdi.sfda.gov.sa/'],
      ['خدمة الإذن بتسويق الأجهزة الطبية', 'https://www.sfda.gov.sa/ar/eservices/88804'],
      ['خدمة تصنيف المنتجات (PCS)', 'https://www.sfda.gov.sa/ar/eservices/65920']
    ]
  },
  {
    id: 'PRODUCT-WIPES',
    aliases: ['مناديل', 'مناديل مبلله', 'مناديل معقمه', 'مناديل مطهره', 'مناديل تنظيف'],
    canonical: 'مناديل',
    sourceDomain: '',
    domain: 'متعدد المجالات',
    title: 'المناديل — يلزم تحديد الاستخدام والادعاء',
    summary: 'الاسم وحده لا يكفي للتصنيف: مناديل التنظيف العامة تختلف عن المناديل المستخدمة على الجسم، أو ذات الادعاء الطبي أو المطهّر. قد يكون المسار تجميليًا أو دوائيًا أو جهازًا طبيًا، وقد يكون المنتج خارج نطاق الهيئة بحسب الغرض الفعلي.',
    caution: 'دوّن موضع الاستخدام، والادعاءات، والمكونات أو المادة الفعالة، وآلية العمل قبل اعتماد المجال الرقابي.',
    links: [
      ['دليل تصنيف المنتجات في الهيئة', 'https://www.sfda.gov.sa/sites/default/files/2024-11/SFDA-ProductsClassificationGuidanceV7A.pdf'],
      ['دليل المنتجات ذات الخط الحدودي', 'https://www.sfda.gov.sa/sites/default/files/2025-01/GuidanceBorderlineProductsClassificationA.pdf'],
      ['خدمة تصنيف المنتجات (PCS)', 'https://www.sfda.gov.sa/ar/eservices/65920'],
      ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']
    ]
  }
];

const productDomainGuides = [
  {
    key: 'food', sourceDomain: 'الغذاء', domain: 'الغذاء', title: 'منتج غذائي — مسار التحقق الغذائي',
    terms: ['لحم', 'لحوم', 'دجاج', 'دواجن', 'سمك', 'اسماك', 'تونه', 'سردين', 'روبيان', 'بيض', 'حليب', 'لبن', 'زبادي', 'جبن', 'زبده', 'قشطه', 'تمر', 'تمور', 'ارز', 'دقيق', 'طحين', 'خبز', 'معكرونه', 'مكرونه', 'زيت', 'سمن', 'سكر', 'ملح', 'ماء', 'مياه', 'عصير', 'مشروب', 'قهوه', 'شاي', 'شوكولاته', 'حلويات', 'بسكويت', 'معلبات', 'مجمدات', 'صلصه', 'مايونيز', 'كاتشب', 'بهارات', 'توابل', 'مخللات', 'غذاء اطفال', 'حليب اطفال', 'مكمل غذائي', 'بروتين غذائي', 'فيتامين غذائي', 'protein supplement', 'food supplement'],
    summary: 'الاسم يشير إلى منتج غذائي. افحص التسجيل أو الإخطار بالتسويق، البطاقة، الصلاحية، بلد المنشأ، ظروف الحفظ، والمنشأة أو المصدر المعتمد بحسب نوع المنتج.',
    caution: 'المنتجات الحيوانية والمستوردة والمكملات قد تكون لها شهادات ومتطلبات إضافية؛ راجع نوع المنتج وبلد المنشأ قبل اتخاذ الإجراء.',
    links: [['قائمة المنتجات الغذائية المسجلة', 'https://www.sfda.gov.sa/ar/products'], ['اللائحة التنفيذية لنظام الغذاء', 'https://www.sfda.gov.sa/ar/regulations/3785396'], ['شروط ومتطلبات فسح الغذاء', 'https://www.sfda.gov.sa/sites/default/files/2023-11/%D8%AF%D9%84%D9%8A%D9%84%20%D8%B4%D8%B1%D9%88%D8%B7%20%D9%88%D9%85%D8%AA%D8%B7%D9%84%D8%A8%D8%A7%D8%AA%20%D9%81%D8%B3%D8%AD%20%D8%A7%D9%84%D8%BA%D8%B0%D8%A7%D8%A1%20.pdf'], ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']]
  },
  {
    key: 'feed', sourceDomain: 'الأعلاف', domain: 'الأعلاف', title: 'منتج علفي — مسار التحقق من الأعلاف',
    terms: ['علف', 'اعلاف', 'تبن', 'دريس', 'سيلاج', 'غذاء حيوانات', 'طعام قطط', 'طعام كلاب', 'طعام طيور', 'بذور طيور', 'مضاف علفي', 'مخلوط علفي', 'بريمكس', 'مركزات علفيه', 'مكعبات علف', 'املاح معدنيه حيوانيه', 'علف دواجن', 'علف مواشي', 'علف اسماك', 'pet food', 'animal feed', 'feed additive'],
    summary: 'الاسم يشير إلى منتج علفي. افحص تسجيل المنتج والمنشأة، المكونات والمواد المضافة، البطاقة، الصلاحية، التخزين والتداول.',
    caution: 'وجود ادعاء علاجي أو مادة دوائية قد ينقل المنتج إلى مسار المستحضرات البيطرية أو يجعله منتجًا متداخلًا.',
    links: [['تسجيل المنتجات العلفية', 'https://www.sfda.gov.sa/ar/eservices/88815'], ['اللائحة التنفيذية لنظام الأعلاف', 'https://www.sfda.gov.sa/ar/regulations/69009'], ['دليل تسجيل المنتجات العلفية', 'https://www.sfda.gov.sa/sites/default/files/2024-03/SFDAfeed11.pdf'], ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']]
  },
  {
    key: 'pesticide', sourceDomain: 'المبيدات', domain: 'المبيدات', title: 'مبيد — مسار التحقق من المبيدات',
    terms: ['مبيد', 'مبيدات', 'مبيد حشري', 'مبيد فطري', 'مبيد اعشاب', 'مبيد قوارض', 'سم فئران', 'طارد حشرات', 'قاتل حشرات', 'مكافحه افات', 'بخاخ حشرات', 'مصيده حشرات كيميائيه', 'مطهر اسطح عام', 'معقم اسطح عام', 'insecticide', 'herbicide', 'fungicide', 'rodenticide', 'pesticide'],
    summary: 'الاسم أو الاستخدام يشير إلى مبيد. افحص التسجيل، المادة الفعالة، الاستخدامات المعتمدة، البطاقة، الشركة، والصلاحية والتخزين.',
    caution: 'المطهرات والمعقمات قد تتغير تبعيتها بحسب موضع الاستخدام والادعاء؛ تعقيم جهاز طبي ليس كتنظيف سطح عام.',
    links: [['تسجيل منتجات المبيدات', 'https://www.sfda.gov.sa/ar/eservices/88460'], ['نظام المبيدات ولائحته', 'https://www.sfda.gov.sa/ar/regulations/69007'], ['خدمة تصنيف المنتجات', 'https://www.sfda.gov.sa/ar/eservices/65920'], ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']]
  },
  {
    key: 'device', sourceDomain: 'الأجهزة الطبية', domain: 'الأجهزة الطبية', title: 'جهاز أو مستلزم طبي — مسار التحقق الطبي',
    terms: ['كمامه طبيه', 'كمامات طبيه', 'قناع طبي', 'surgical mask', 'medical mask', 'قفاز طبي', 'قفازات طبيه', 'سرنجه', 'حقنه فارغه', 'ابره طبيه', 'قسطره', 'كانيولا', 'cannula', 'catheter', 'ضماد', 'شاش طبي', 'لاصق طبي', 'عدسات لاصقه', 'محلول عدسات', 'طقم محلول', 'طقم محاليل', 'طقم تسريب', 'انبوب وريدي', 'مضخه محاليل', 'iv set', 'infusion set', 'infusion pump', 'جهاز ضغط', 'جهاز سكر', 'شرائط سكر', 'جهاز حمل', 'اختبار حمل', 'ترمومتر', 'ميزان حراره', 'اكسيميتر', 'جهاز تنفس', 'جهاز تخطيط', 'جهاز اشعه', 'كاشف مخبري', 'جهاز مختبر', 'غرسه', 'مفصل صناعي', 'طرف صناعي', 'كرسي متحرك', 'سماعه طبيه', 'معينه سمعيه', 'جهاز ليزر طبي', 'ديرما رولر', 'جهاز تعقيم طبي'],
    summary: 'الاسم أو الغرض يشير إلى جهاز أو مستلزم طبي. افحص الإذن بالتسويق، بيانات المصنع والممثل المعتمد، رقم الطراز أو UDI، البطاقة، التخزين، وإنذارات السلامة.',
    caution: 'كلمة «طبي» أو ادعاء التشخيص والعلاج مهمة، لكن التصنيف النهائي يتأثر بالغرض المقصود وآلية العمل.',
    links: [['خدمة الإذن بتسويق الأجهزة الطبية', 'https://www.sfda.gov.sa/ar/eservices/88804'], ['نظام ترميز الأجهزة Saudi-DI', 'https://www.sfda.gov.sa/ar/eservices/69131'], ['دليل تصنيف الأجهزة الطبية', 'https://www.sfda.gov.sa/ar/regulations/2949460'], ['إنذارات سلامة الأجهزة الطبية', 'https://www.sfda.gov.sa/ar/safety-alert']]
  },
  {
    key: 'cosmetic', sourceDomain: 'مستحضرات التجميل', domain: 'مستحضرات التجميل', title: 'منتج تجميلي — مسار التحقق من مستحضرات التجميل',
    terms: ['كريم تفتيح', 'كريم تبييض', 'كريم ترطيب', 'مرطب بشره', 'لوشن جسم', 'غسول وجه', 'غسول بشره', 'شامبو', 'بلسم شعر', 'صبغه شعر', 'حناء شعر', 'زيت شعر', 'مكياج', 'احمر شفاه', 'روج', 'ماسكرا', 'كحل', 'بودره وجه', 'كريم اساس', 'واقي شمس تجميلي', 'صن بلوك', 'sunscreen cosmetic', 'عطر', 'مزيل عرق', 'صابون تجميلي', 'مقشر بشره', 'سيروم بشره', 'طلاء اظافر', 'مزيل طلاء', 'معجون اسنان تجميلي', 'غسول فم تجميلي'],
    summary: 'الاسم والاستخدام الظاهر يشيران إلى منتج تجميلي. افحص الإدراج، بيانات الملصق والمكونات والتشغيلة، الادعاءات، الصلاحية، والتحذيرات.',
    caution: 'إذا تضمن المنتج ادعاء علاج مرض أو تأثيرًا دوائيًا فقد لا يبقى تجميليًا؛ يلزم التحقق من التصنيف والمواد الفعالة.',
    links: [['إدراج منتجات التجميل', 'https://www.sfda.gov.sa/ar/eservices/88819'], ['اللائحة التنفيذية لنظام منتجات التجميل', 'https://www.sfda.gov.sa/ar/regulations/62872'], ['دليل تصنيف المنتجات', 'https://www.sfda.gov.sa/sites/default/files/2024-11/SFDA-ProductsClassificationGuidanceV7A.pdf'], ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']]
  },
  {
    key: 'pharma', sourceDomain: 'المستحضرات الصيدلانية', domain: 'المستحضرات الصيدلانية', title: 'مستحضر صيدلاني — مسار التحقق الدوائي',
    terms: ['بنادول', 'بانادول', 'panadol', 'باراسيتامول', 'paracetamol', 'ادول', 'فيفادول', 'دواء', 'دوائي', 'مضاد حيوي', 'اموكسيسيلين', 'amoxicillin', 'مسكن', 'اسبرين', 'aspirin', 'خافض حراره', 'حبوب', 'اقراص', 'كبسولات', 'شراب علاجي', 'حقن دوائيه', 'مرهم علاجي', 'قطره عين', 'قطره اذن', 'بخاخ ربو', 'انسولين', 'ميتفورمين', 'metformin', 'لقاح بشري', 'بوتكس', 'بوتوكس', 'مستحضر عشبي', 'دواء عشبي', 'محلول وريدي', 'محاليل وريديه', 'محلول ملحي', 'محاليل ملحيه', 'normal saline', 'محلول تغذيه وريديه', 'محاليل غسيل كلوي', 'iv solution', 'iv fluid', 'infusion solution'],
    summary: 'الاسم أو العلامة التجارية أو الادعاء يشير إلى مستحضر صيدلاني. افحص التسجيل، الاسم والتركيز والشكل الصيدلاني، الشركة والوكيل، رقم التشغيلة، الصلاحية، التخزين، وقرارات السحب.',
    caution: 'تحديد المجال لا يثبت أن الاسم التجاري مسجل أو أن التشغيلة سليمة؛ يجب البحث في السجل الدوائي وقاعدة السحب الرسمية.',
    links: [['المعلومات الدوائية الرسمية', 'https://sdi.sfda.gov.sa/'], ['قاعدة السحب والاستدعاء للمنتجات العلاجية', 'https://www.sfda.gov.sa/ar/drugs-circulars-withdrawal'], ['النظام واللوائح الصيدلانية', 'https://www.sfda.gov.sa/ar/regulations/69003'], ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']]
  },
  {
    key: 'veterinary', sourceDomain: 'المستحضرات البيطرية', domain: 'المستحضرات البيطرية', title: 'مستحضر بيطري — مسار التحقق البيطري',
    terms: ['دواء بيطري', 'مستحضر بيطري', 'لقاح بيطري', 'لقاح حيواني', 'مضاد حيوي بيطري', 'علاج حيوانات', 'علاج مواشي', 'علاج دواجن', 'طارد طفيليات حيواني', 'علاج قراد', 'مضاد ديدان حيواني', 'ديدان حيوانات', 'فيتامينات بيطريه', 'حقن بيطريه', 'مرهم بيطري', 'veterinary medicine', 'veterinary vaccine', 'animal dewormer'],
    summary: 'الاسم أو الغرض يشير إلى مستحضر بيطري. افحص التسجيل، المكونات والتركيز، الحيوان المستهدف، فترة السحب، الشركة، التشغيلة، الصلاحية والتخزين.',
    caution: 'منتجات تغذية الحيوان تختلف عن المستحضرات البيطرية؛ الادعاء العلاجي والمادة الفعالة والغرض المقصود تحسم المسار.',
    links: [['متطلبات تسجيل المستحضرات البيطرية', 'https://www.sfda.gov.sa/ar/regulations/79210'], ['اللائحة التنفيذية للمستحضرات البيطرية', 'https://www.sfda.gov.sa/ar/regulations/62881'], ['قاعدة السحب والاستدعاء', 'https://www.sfda.gov.sa/ar/drugs-circulars-withdrawal'], ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']]
  }
];

const unknownProductGuide = {
  id: 'PRODUCT-UNKNOWN', canonical: '', sourceDomain: '', domain: 'يتطلب تصنيفًا',
  title: 'منتج غير معروف في القاموس — ابدأ بمسار التصنيف',
  summary: 'لم يتمكن المحرك من تحديد المجال من الاسم وحده. هذا لا يعني أن المنتج خارج نطاق الهيئة؛ أدخل الغرض المقصود والادعاءات والمكونات وطريقة الاستخدام في نموذج التصنيف.',
  caution: 'لا تعتمد على الاسم التجاري وحده. استخدم خدمة PCS عند التداخل، ثم ابحث عن التسجيل والتحذيرات في المجال الناتج.',
  links: [['فتح نموذج التصنيف داخل المنصة', '#classify'], ['خدمة تصنيف المنتجات (PCS)', 'https://www.sfda.gov.sa/ar/eservices/65920'], ['بوابة الأنظمة واللوائح', 'https://www.sfda.gov.sa/ar/regulations'], ['التحذيرات الرسمية', 'https://www.sfda.gov.sa/ar/warnings']]
};

function editDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

function matchProductGuide(query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;
  for (const guide of productGuides) {
    const alias = guide.aliases.map(normalize).find(term => guide.exactOnly ? normalizedQuery === term : normalizedQuery.includes(term));
    if (alias) return { guide, corrected: '' };
  }
  if (!normalizedQuery.includes(' ') && normalizedQuery.length >= 4) {
    for (const guide of productGuides) {
      const closest = guide.aliases.map(normalize).find(term => !term.includes(' ') && editDistance(normalizedQuery, term) <= 1);
      if (closest) return { guide, corrected: guide.canonical };
    }
  }
  const ranked = productDomainGuides
    .map(guide => ({ guide, score: guide.terms.map(normalize).filter(term => normalizedQuery.includes(term)).reduce((sum, term) => sum + term.length, 0) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length) return { guide: { ...ranked[0].guide, id: `PRODUCT-${ranked[0].guide.key.toUpperCase()}`, canonical: '' }, corrected: '' };
  return { guide: unknownProductGuide, corrected: '' };
}

function expandedWords(query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return [...new Set(words.flatMap(word => [word, ...(synonyms[word] || [])].map(normalize)))];
}

function sourceCategory(source) {
  const text = normalize(`${source.type} ${source.title} ${source.themes}`);
  if (/سحب|استدعاء|تحذير|سلامه/.test(text)) return 'alert';
  if (/نظام|لائحه/.test(normalize(source.type))) return 'legislation';
  if (/متطلبات|مخالفات|اجراء/.test(text)) return 'requirement';
  if (/دليل/.test(normalize(source.type))) return 'guide';
  return 'service';
}

const routes = [...document.querySelectorAll('[data-route]')];
function go(route) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === route));
  routes.forEach(button => button.classList.toggle('active', button.dataset.route === route));
  history.replaceState(null, '', `#${route}`);
  scrollTo({ top: 0, behavior: 'smooth' });
  if (route === 'search') renderResults();
}
routes.forEach(button => button.addEventListener('click', () => go(button.dataset.route)));

function scoreSource(source, words) {
  if (!words.length) return authorityRank(source.authority);
  const fields = {
    title: normalize(source.title),
    themes: normalize(source.themes),
    domain: normalize(source.domain),
    type: normalize(source.type),
    status: normalize(source.status)
  };
  let score = 0;
  words.forEach(word => {
    if (fields.title.includes(word)) score += 8;
    if (fields.themes.includes(word)) score += 4;
    if (fields.domain.includes(word)) score += 3;
    if (fields.type.includes(word)) score += 2;
    if (fields.status.includes(word)) score += 1;
  });
  const alertQuery = words.some(word => /سحب|استدعاء|تحذير/.test(word));
  if (alertQuery && sourceCategory(source) === 'alert') score += 10;
  return score;
}

function scoreContent(item, words) {
  if (!words.length) return 0;
  const fields = {
    heading: normalize(item.heading),
    reference: normalize(item.reference),
    text: normalize(item.text),
    keywords: normalize(item.keywords),
    domain: normalize(item.domain)
  };
  let score = 0;
  words.forEach(word => {
    if (fields.heading.includes(word)) score += 12;
    if (fields.reference.includes(word)) score += 7;
    if (fields.keywords.includes(word)) score += 6;
    if (fields.text.includes(word)) score += 4;
    if (fields.domain.includes(word)) score += 3;
  });
  const exactQuery = normalize(document.querySelector('#searchInput').value);
  if (exactQuery.length > 3 && fields.text.includes(exactQuery)) score += 18;
  return score;
}

function scoreClassification(item, words, exactQuery) {
  if (!words.length) return 0;
  const title = normalize(item.title);
  const terms = normalize(item.terms);
  const rule = normalize(item.rule);
  const classification = normalize(item.classification);
  let score = 0;
  words.forEach(word => {
    if (title.includes(word)) score += 12;
    if (terms.includes(word)) score += 9;
    if (classification.includes(word)) score += 5;
    if (rule.includes(word)) score += 3;
  });
  if (exactQuery.length > 2 && (title.includes(exactQuery) || terms.includes(exactQuery))) score += 20;
  return score;
}

function renderResults() {
  const query = document.querySelector('#searchInput').value;
  const words = expandedWords(query);
  const domain = document.querySelector('#sectorFilter').value;
  const type = document.querySelector('#typeFilter').value;
  const productMatch = matchProductGuide(query);
  const detectedDomain = productMatch?.guide.sourceDomain;
  const matched = sources
    .map(source => ({ ...source, score: scoreSource(source, words) + (detectedDomain && source.domain === detectedDomain ? 2 : 0) }))
    .filter(source => (!words.length || source.score > 0)
      && (domain === 'all' || source.domain === domain)
      && (type === 'all' || sourceCategory(source) === type))
    .sort((a, b) => b.score - a.score || authorityRank(b.authority) - authorityRank(a.authority) || a.id.localeCompare(b.id));

  const textMatches = contentIndex
    .map(item => ({ ...item, score: scoreContent(item, words) }))
    .filter(item => words.length && item.score > 0
      && (domain === 'all' || item.domain === domain)
      && (type === 'all' || type === 'legislation'))
    .sort((a, b) => b.score - a.score || authorityRank(b.authority) - authorityRank(a.authority))
    .slice(0, 12);

  const exactQuery = normalize(query);
  const classificationMatches = classificationLibrary
    .map(item => ({ ...item, score: scoreClassification(item, words, exactQuery) }))
    .filter(item => words.length && item.score > 0
      && (domain === 'all' || item.domain === domain)
      && (type === 'all' || type === 'guide'))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 10);

  const dossier = type === 'all' && domain === 'all'
    ? buildRegulatoryDossier(query, productMatch, classificationMatches)
    : '';

  const list = document.querySelector('#resultsList');
  const showProductGuide = productMatch && type === 'all'
    && (domain === 'all' || productMatch.guide.sourceDomain === domain)
    && (productMatch.guide.id !== 'PRODUCT-UNKNOWN' || matched.length + textMatches.length + classificationMatches.length === 0);
  const productCards = showProductGuide ? (() => {
    const { guide, corrected } = productMatch;
    const links = guide.links.map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener">${escapeHTML(label)} ↗</a>`).join('');
    return `<article class="result-card product-guide" data-product-guide="${guide.id}">
      <div>
        <div class="badges"><span class="badge product-badge">دليل المنتج</span><span class="badge">${escapeHTML(guide.domain)}</span>${corrected ? `<span class="badge correction-badge">هل تقصد: ${escapeHTML(corrected)}؟</span>` : ''}</div>
        <h3>${escapeHTML(guide.title)}</h3>
        <p>${escapeHTML(guide.summary)}</p>
        <div class="product-caution">${escapeHTML(guide.caution)}</div>
        <div class="product-links">${links}</div>
      </div>
      <span class="result-open">✓</span>
    </article>`;
  })() : '';
  const textCards = textMatches.map(item => {
    const source = sources.find(sourceItem => sourceItem.id === item.sourceId);
    return `<a class="result-card text-hit" href="${item.url}" target="_blank" rel="noopener" data-text-id="${item.id}">
      <div>
        <div class="badges"><span class="badge text-badge">مطابقة داخل النص</span><span class="badge">${escapeHTML(item.domain)}</span><span class="badge official">${escapeHTML(authorityLabel(item.authority))}</span></div>
        <h3>${escapeHTML(item.heading)}</h3>
        <p class="text-excerpt">${escapeHTML(item.text)}</p>
        <div class="result-meta"><span>${escapeHTML(item.reference)}</span><span>${escapeHTML(source?.title || 'وثيقة رسمية')}</span><span>فتح المرجع الرسمي ↗</span></div>
      </div>
      <span class="result-open">↗</span>
    </a>`;
  }).join('');
  const classificationCards = classificationMatches.map(item => `<a class="result-card classification-hit" href="${item.url}" target="_blank" rel="noopener" data-classification-id="${item.id}">
    <div>
      <div class="badges"><span class="badge classification-badge">من دليل التصنيف 8.0</span><span class="badge">${escapeHTML(item.domain)}</span><span class="badge class-result">${escapeHTML(item.classification)}</span></div>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="classification-rule">${escapeHTML(item.rule)}</p>
      <div class="result-meta"><span>${escapeHTML(item.section)}</span><span>صفحة الدليل: ${escapeHTML(item.page)}</span><span>فتح الدليل الرسمي ↗</span></div>
    </div>
    <span class="result-open">↗</span>
  </a>`).join('');
  const sourceCards = matched.map(source => `
    <article class="result-card" data-source="${source.id}">
      <div>
        <div class="badges"><span class="badge">${escapeHTML(source.domain)}</span><span class="badge official">${escapeHTML(authorityLabel(source.authority))}</span><span class="badge status">${escapeHTML(source.status)}</span></div>
        <h3>${escapeHTML(source.title)}</h3>
        <p>${escapeHTML(source.themes.replaceAll(' ', ' • '))}</p>
        <div class="result-meta"><span>${escapeHTML(source.type)}</span><span>${escapeHTML(source.date)}</span><span>أسئلة البنك: ${escapeHTML(source.questions)}</span></div>
      </div>
      <button class="result-open" aria-label="عرض التفاصيل">←</button>
    </article>`).join('');
  list.innerHTML = dossier + productCards + classificationCards + textCards + sourceCards;
  if (normalize(query) && type === 'all') {
    const liveHost = document.createElement('section');
    liveHost.className = 'live-official-panel loading';
    liveHost.dataset.liveOfficialResults = '';
    liveHost.innerHTML = '<div class="live-official-head"><div><span class="eyebrow">بحث مباشر في قواعد الهيئة</span><h2>جارٍ جلب السجلات الرسمية الفعلية…</h2></div><span class="live-spinner">↻</span></div><p>يتم فحص التحذيرات والسحب والاستدعاء وتحذيرات السلامة والأنظمة واللوائح والأدلة والتعاميم المنشورة.</p>';
    list.insertBefore(liveHost, list.firstChild?.nextSibling || list.firstChild);
    loadLiveOfficialResults(query, liveHost, ++liveSearchSequence);
  } else {
    liveSearchSequence += 1;
  }
  const productCount = productCards ? 1 : 0;
  document.querySelector('#resultsCount').textContent = productCount + classificationMatches.length + matched.length + textMatches.length;
  document.querySelector('#resultsBreakdown').textContent = productCount
    ? `ملف رقابي شامل • دليل منتج • ${classificationMatches.length} قاعدة تصنيف • ${textMatches.length} مطابقة نصية • ${matched.length} مصدرًا`
    : classificationMatches.length
      ? `${classificationMatches.length} قاعدة من دليل التصنيف • ${textMatches.length} مطابقة نصية • ${matched.length} مصدرًا`
    : textMatches.length
      ? `${textMatches.length} مطابقة داخل النص • ${matched.length} مصدرًا ذا صلة`
      : 'مرتبة حسب الصلة بالمصطلح';
  document.querySelector('#emptyResults').hidden = productCount + classificationMatches.length + matched.length + textMatches.length > 0;
  list.querySelectorAll('[data-source]').forEach(card => card.addEventListener('click', () => openSource(card.dataset.source)));
}

const liveKindLabels = {
  warning: 'تحذير رسمي فعلي', recall: 'سحب/استدعاء فعلي', safety_alert: 'تحذير سلامة دوائية فعلي', legislation: 'نظام أو لائحة فعلية',
  guide: 'دليل إرشادي فعلي', circular: 'تعميم فعلي'
};

async function loadLiveOfficialResults(query, host, sequence) {
  if (typeof fetch !== 'function') {
    host.remove();
    return;
  }
  try {
    const response = await fetch(`/api/official-search?q=${encodeURIComponent(query)}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (sequence !== liveSearchSequence || !host.isConnected) return;
    const records = Array.isArray(data.records) ? data.records : [];
    const successfulSources = (data.sources || []).filter(source => source.ok).length;
    const failedSources = (data.sources || []).filter(source => !source.ok);
    host.classList.remove('loading');
    if (!records.length) {
      host.classList.add('no-live-match');
      host.innerHTML = `<div class="live-official-head"><div><span class="eyebrow">نتيجة البحث المباشر</span><h2>لم تُرجع القواعد الرسمية مطابقة مباشرة لـ«${escapeHTML(query)}»</h2></div><span class="live-zero">0</span></div>
        <p>تم فحص ${successfulSources} قواعد رسمية وقت البحث. هذه النتيجة لا تثبت عدم وجود ارتباط؛ جرّب الاسم الإنجليزي والعلامة والمكوّن والشركة ورقم التشغيلة.</p>
        ${failedSources.length ? `<div class="live-source-warning">تعذر فحص: ${failedSources.map(item => escapeHTML(item.label)).join('، ')}.</div>` : ''}`;
      return;
    }
    const cards = records.map(record => `<a class="actual-record ${['warning', 'recall', 'safety_alert'].includes(record.kind) ? 'critical' : ''}" href="${escapeHTML(record.url)}" target="_blank" rel="noopener">
      <div class="badges"><span class="badge actual">${escapeHTML(liveKindLabels[record.kind] || 'سجل رسمي فعلي')}</span>${record.status ? `<span class="badge status">${escapeHTML(record.status)}</span>` : ''}${record.date ? `<span class="badge">${escapeHTML(record.date)}</span>` : ''}</div>
      <h3>${escapeHTML(record.title)}</h3>
      ${record.details && record.details !== record.title ? `<p>${escapeHTML(record.details.slice(0, 360))}</p>` : ''}
      <div class="actual-source"><span>${escapeHTML(record.source)}</span><strong>فتح السجل الرسمي ↗</strong></div>
    </a>`).join('');
    host.innerHTML = `<div class="live-official-head"><div><span class="eyebrow">مطابقات رسمية فعلية</span><h2>وجدنا ${records.length} سجلًا منشورًا مرتبطًا بـ«${escapeHTML(query)}»</h2></div><span class="live-count">${records.length}</span></div>
      <p>النتائج التالية أعادتها قواعد الهيئة الرسمية عند تنفيذ البحث، وليست روابط عامة أو استنتاجات من التطبيق.</p>
      <div class="actual-records">${cards}</div>
      ${failedSources.length ? `<div class="live-source-warning">ظهرت النتائج، لكن تعذر فحص: ${failedSources.map(item => escapeHTML(item.label)).join('، ')}.</div>` : ''}
      <small class="searched-at">وقت الفحص: ${escapeHTML(new Date(data.searchedAt).toLocaleString('ar-SA'))}</small>`;
  } catch (error) {
    if (sequence !== liveSearchSequence || !host.isConnected) return;
    host.classList.remove('loading');
    host.classList.add('live-error');
    host.innerHTML = `<div class="live-official-head"><div><span class="eyebrow">تعذر البحث المباشر مؤقتًا</span><h2>لم نتمكن من جلب السجلات الفعلية الآن</h2></div><span>!</span></div><p>لا تفسر ذلك على أنه عدم وجود تحذير أو اشتراط. استخدم النتائج المفهرسة ومسارات التحقق الرسمية، ثم أعد المحاولة.</p>`;
  }
}

function openSource(id) {
  const source = sources.find(item => item.id === id);
  if (!source) return;
  document.querySelector('#dialogContent').innerHTML = `
    <div class="badges"><span class="badge">${escapeHTML(source.domain)}</span><span class="badge official">${escapeHTML(authorityLabel(source.authority))}</span><span class="badge status">${escapeHTML(source.status)}</span></div>
    <h2>${escapeHTML(source.title)}</h2>
    <div class="source-details">
      <div><b>نوع المصدر</b><span>${escapeHTML(source.type)}</span></div>
      <div><b>تاريخ النشر/التحديث</b><span>${escapeHTML(source.date)}</span></div>
      <div><b>مستوى الحجية</b><span>${escapeHTML(source.authority)}</span></div>
      <div><b>نطاق أسئلة البنك</b><span>${escapeHTML(source.questions)}</span></div>
    </div>
    <p class="themes"><b>محاور الاستخدام:</b> ${escapeHTML(source.themes.replaceAll(' ', '، '))}</p>
    <div class="dialog-note">قبل الاستناد إلى المصدر في إجراء رقابي، تحقق من النسخة السارية ومن رقم المادة أو البند المنطبق على الواقعة.</div>
    <div class="dialog-source"><b>المصدر الرسمي</b><p><a href="${source.url}" target="_blank" rel="noopener">فتح الصفحة على موقع الهيئة ↗</a></p></div>`;
  document.querySelector('#sourceDialog').showModal();
}

document.querySelector('.dialog-close').addEventListener('click', () => document.querySelector('#sourceDialog').close());
document.querySelector('#sourceDialog').addEventListener('click', event => { if (event.target.id === 'sourceDialog') event.target.close(); });
document.querySelector('#searchBtn').addEventListener('click', renderResults);
document.querySelector('#searchInput').addEventListener('keydown', event => { if (event.key === 'Enter') renderResults(); });
document.querySelector('#sectorFilter').addEventListener('change', renderResults);
document.querySelector('#typeFilter').addEventListener('change', renderResults);
document.querySelector('#resetFilters').addEventListener('click', () => {
  document.querySelector('#searchInput').value = '';
  document.querySelector('#sectorFilter').value = 'all';
  document.querySelector('#typeFilter').value = 'all';
  renderResults();
});

function quickSearch(query) {
  document.querySelector('#searchInput').value = query;
  go('search');
  renderResults();
}
document.querySelector('#quickSearchBtn').addEventListener('click', () => quickSearch(document.querySelector('#quickSearch').value));
document.querySelector('#quickSearch').addEventListener('keydown', event => { if (event.key === 'Enter') quickSearch(event.target.value); });
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => quickSearch(button.dataset.query)));

const classificationRules = {
  device: { label: 'الأجهزة الطبية', hints: ['جهاز', 'مستلزم', 'عدسات', 'محلول عدسات', 'قسطرة', 'ضماد', 'كاشف', 'مختبر', 'قياس', 'تعقيم جهاز', 'طرف صناعي'] },
  pharma: { label: 'المستحضرات الصيدلانية', hints: ['دواء', 'دوائي', 'ماده فعاله', 'حبوب', 'كبسول', 'شراب علاجي', 'حقن', 'يعالج', 'علاج المرض', 'وصفه طبيه'] },
  cosmetic: { label: 'مستحضرات التجميل', hints: ['تجميل', 'ترطيب', 'عطر', 'مكياج', 'شعر', 'بشره', 'تحسين المظهر', 'تنظيف الجلد', 'شامبو'] },
  food: { label: 'الغذاء', hints: ['غذاء', 'مشروب', 'ماكول', 'مكمل غذائي', 'طاقه', 'تغذيه الانسان', 'نكهه', 'محلي'] },
  feed: { label: 'الأعلاف', hints: ['علف', 'اعلاف', 'تغذيه الحيوان', 'مضاف علفي', 'مخلوط مسبق', 'تحسين الانتاج'] },
  pesticide: { label: 'المبيدات', hints: ['مبيد', 'حشره', 'افه', 'قوارض', 'رش', 'ماده فعاله للمكافحه', 'تعقيم اسطح'] },
  veterinary: { label: 'المستحضرات البيطرية', hints: ['بيطري', 'حيوان', 'لقاح حيواني', 'فتره سحب', 'علاج الماشيه', 'دواجن'] }
};

const useBoost = { medical: ['device', 'pharma'], veterinary: ['veterinary'], cosmetic: ['cosmetic'], food: ['food'], feed: ['feed'], pesticide: ['pesticide'] };
const domainForRule = { device: 'الأجهزة الطبية', pharma: 'المستحضرات الصيدلانية', cosmetic: 'مستحضرات التجميل', food: 'الغذاء', feed: 'الأعلاف', pesticide: 'المبيدات', veterinary: 'المستحضرات البيطرية' };

document.querySelector('#classifyForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = document.querySelector('#productName').value.trim();
  const use = document.querySelector('#intendedUse').value;
  const claims = document.querySelector('#claims').value;
  const ingredients = document.querySelector('#ingredients').value;
  const method = document.querySelector('#useMethod').value;
  const combined = normalize(`${name} ${claims} ${ingredients} ${method}`);
  const scores = Object.fromEntries(Object.keys(classificationRules).map(key => [key, 0]));
  const indicators = {};

  (useBoost[use] || []).forEach(key => { scores[key] += use === 'medical' ? 4 : 8; });
  Object.entries(classificationRules).forEach(([key, rule]) => {
    indicators[key] = rule.hints.filter(hint => combined.includes(normalize(hint)));
    scores[key] += indicators[key].length * 3;
  });

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topKey, topScore] = ranked[0];
  const [secondKey, secondScore] = ranked[1];
  const ambiguous = topScore === 0 || (secondScore > 0 && topScore - secondScore <= 2);
  const likelyDomains = ambiguous && secondScore > 0 ? [topKey, secondKey] : [topKey];
  const title = topScore === 0 ? 'المسار غير محسوم من البيانات المدخلة' : ambiguous
    ? `منتج متداخل محتمل بين ${classificationRules[topKey].label} و${classificationRules[secondKey].label}`
    : `${classificationRules[topKey].label} — المسار الأكثر احتمالًا`;
  const strength = topScore >= 11 && !ambiguous ? 'مؤشرات قوية' : topScore >= 6 ? 'مؤشرات متوسطة' : 'مؤشرات محدودة';
  const matchedHints = [...new Set(likelyDomains.flatMap(key => indicators[key]))];
  const targetDomains = likelyDomains.map(key => domainForRule[key]);
  const related = sources.filter(source => source.id === 'SRC-004' || targetDomains.includes(source.domain)).slice(0, 5);
  const therapeuticCosmetic = use === 'cosmetic' && /علاج|يشفي|وقاي|التهاب|مرض/.test(combined);

  const output = document.querySelector('#classificationResult');
  output.className = `classification-result ${ambiguous ? '' : 'high'}`;
  output.innerHTML = `
    <span class="eyebrow">نتيجة استرشادية أولية</span>
    <h2>${escapeHTML(title)}</h2>
    <p>المنتج: <b>${escapeHTML(name)}</b>. بُني الترجيح على الغرض والادعاءات والمكونات التي أدخلتها، ولا يمثل قرار تصنيف رسميًا.</p>
    <div class="result-reasons">
      <div class="reason"><b>المجال المحتمل</b><span>${escapeHTML(targetDomains.join(' / '))}</span></div>
      <div class="reason"><b>قوة المؤشرات</b><span>${strength}</span></div>
      <div class="reason"><b>طبيعة النتيجة</b><span>استرشادية غير ملزمة</span></div>
    </div>
    ${matchedHints.length ? `<div class="indicator-list"><b>المؤشرات المطابقة:</b>${matchedHints.map(hint => `<span>${escapeHTML(hint)}</span>`).join('')}</div>` : ''}
    ${therapeuticCosmetic ? '<div class="result-warning strong">وجود ادعاء علاجي مع غرض تجميلي يرفع احتمال تداخل التصنيف؛ يلزم طلب تصنيف رسمي.</div>' : '<div class="result-warning">عند وجود تداخل أو قبل اتخاذ إجراء نظامي، استخدم نظام PCS أو قرار تصنيف رسمي.</div>'}
    <div class="related-sources"><h3>المراجع المقترحة للتحقق</h3>${related.map(source => `<a href="${source.url}" target="_blank" rel="noopener"><b>${escapeHTML(source.title)}</b><span>${escapeHTML(authorityLabel(source.authority))} ↗</span></a>`).join('')}</div>`;
  output.hidden = false;
  output.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

let verifyMode = 'barcode';
const modeLabels = { barcode: ['أدخل الباركود', 'numeric'], registration: ['أدخل رقم التسجيل', 'text'], name: ['أدخل اسم المنتج', 'text'] };
document.querySelectorAll('.verify-tabs button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.verify-tabs button').forEach(item => item.classList.toggle('active', item === button));
  verifyMode = button.dataset.mode;
  const [placeholder, inputmode] = modeLabels[verifyMode];
  document.querySelector('#verifyInput').placeholder = placeholder;
  document.querySelector('#verifyInput').inputMode = inputmode;
}));

const verificationSources = {
  general: ['SRC-004', 'SRC-005', 'SRC-001'],
  food: ['SRC-013', 'SRC-005', 'SRC-010'],
  feed: ['SRC-017', 'SRC-005', 'SRC-015'],
  pesticide: ['SRC-019', 'SRC-020', 'SRC-018'],
  device: ['SRC-027', 'SRC-028', 'SRC-026', 'SRC-021'],
  cosmetic: ['SRC-032', 'SRC-034', 'SRC-030'],
  pharma: ['SRC-039', 'SRC-040', 'SRC-041', 'SRC-035'],
  veterinary: ['SRC-047', 'SRC-005', 'SRC-045', 'SRC-044']
};

const domainLabels = {
  general: 'غير محدد', food: 'الغذاء', feed: 'الأعلاف', pesticide: 'المبيدات',
  device: 'الأجهزة الطبية', cosmetic: 'مستحضرات التجميل',
  pharma: 'المستحضرات الصيدلانية', veterinary: 'المستحضرات البيطرية'
};

function verificationPurpose(source, index) {
  if (sourceCategory(source) === 'alert') return 'فحص السحب أو الاستدعاء أو التحذير';
  if (index === 0) return 'فحص التسجيل أو الإدراج أو الترخيص';
  return 'فحص المتطلب أو المسار التنظيمي';
}

document.querySelector('#verifyBtn').addEventListener('click', () => {
  const value = document.querySelector('#verifyInput').value.trim();
  const domain = document.querySelector('#verifyDomain').value;
  const company = document.querySelector('#verifyCompany').value.trim();
  const batch = document.querySelector('#verifyBatch').value.trim();
  const output = document.querySelector('#verifyOutput');
  if (!value) {
    output.className = 'verify-output';
    output.innerHTML = '<span>!</span><h3>أدخل قيمة للبحث</h3><p>يلزم إدخال الباركود أو رقم التسجيل أو اسم المنتج.</p>';
    return;
  }
  const selected = (verificationSources[domain] || verificationSources.general)
    .map(id => sources.find(source => source.id === id)).filter(Boolean);
  const searchTerms = [value, company, batch].filter(Boolean);
  const localMatches = contentIndex
    .map(item => ({ item, score: searchTerms.reduce((sum, term) => sum + (normalize(`${item.heading} ${item.text} ${item.keywords}`).includes(normalize(term)) ? 1 : 0), 0) }))
    .filter(match => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  const checkedAt = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  output.className = 'verify-output ready';
  output.innerHTML = `
    <div class="case-status"><span>!</span><div><b>الحالة: التحقق غير مكتمل</b><small>لا تتحول الحالة إلى «لا يوجد سحب» إلا بعد فحص القواعد الرسمية وتوثيق النتيجة.</small></div></div>
    <div class="case-summary">
      <div><b>قيمة البحث</b><span>${escapeHTML(value)}</span></div><div><b>المجال</b><span>${escapeHTML(domainLabels[domain])}</span></div>
      <div><b>الشركة/المصنع</b><span>${escapeHTML(company || 'غير مدخل')}</span></div><div><b>التشغيلة</b><span>${escapeHTML(batch || 'غير مدخلة')}</span></div>
      <div class="full"><b>وقت إنشاء المحضر</b><span>${escapeHTML(checkedAt)}</span></div>
    </div>
    <div class="case-actions"><button class="copy-value" type="button">نسخ قيمة البحث</button><button class="copy-report" type="button">نسخ محضر التحقق</button></div>
    <h4 class="checklist-title">قائمة الفحص الرسمية</h4>
    <div class="verification-links">${selected.map((source, index) => `<div class="verification-step"><label><input type="checkbox" data-check-source="${source.id}"/><span>تم الفحص</span></label><a href="${source.url}" target="_blank" rel="noopener"><i>${index + 1}</i><span><b>${escapeHTML(source.title)}</b><small>${escapeHTML(verificationPurpose(source, index))}</small></span><strong>فتح ↗</strong></a></div>`).join('')}</div>
    ${localMatches.length ? `<div class="local-matches"><b>مطابقات أولية داخل الفهرس المحلي:</b>${localMatches.map(({ item }) => `<a href="${item.url}" target="_blank" rel="noopener">${escapeHTML(item.heading)} ↗</a>`).join('')}<small>هذه المطابقات لا تمثل نتيجة بحث شاملة في قواعد الهيئة الديناميكية.</small></div>` : ''}
    <div class="no-result-rule">قاعدة مهنية: عدم ظهور المنتج لا يثبت سلامته أو نظاميته، ولا ينفي وجود قرار باسم تجاري مختلف أو شركة أو تشغيلة أخرى.</div>`;
  output.querySelector('.copy-value').addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(value); event.currentTarget.textContent = 'تم النسخ ✓'; }
    catch { event.currentTarget.textContent = `انسخ: ${value}`; }
  });
  output.querySelector('.copy-report').addEventListener('click', async event => {
    const completed = [...output.querySelectorAll('[data-check-source]:checked')].map(input => selected.find(source => source.id === input.dataset.checkSource)?.title).filter(Boolean);
    const report = [
      'محضر تحقق أولي من منتج — المرجع الرقابي الذكي', `التاريخ والوقت: ${checkedAt}`,
      `المجال: ${domainLabels[domain]}`, `قيمة البحث: ${value}`,
      `الشركة/المصنع: ${company || 'غير مدخل'}`, `رقم التشغيلة: ${batch || 'غير مدخلة'}`,
      `المصادر التي تم تحديد فحصها: ${completed.length ? completed.join(' | ') : 'لم يحدد المفتش إكمال أي مصدر بعد'}`,
      'تنبيه: هذا محضر بحث أولي، ولا يعد إثباتًا لسلامة المنتج أو عدم وجود سحب أو تحذير.'
    ].join('\n');
    try { await navigator.clipboard.writeText(report); event.currentTarget.textContent = 'تم نسخ المحضر ✓'; }
    catch { event.currentTarget.textContent = 'تعذر النسخ تلقائيًا'; }
  });
  output.querySelectorAll('[data-check-source]').forEach(input => input.addEventListener('change', () => {
    const total = output.querySelectorAll('[data-check-source]').length;
    const done = output.querySelectorAll('[data-check-source]:checked').length;
    const status = output.querySelector('.case-status');
    status.classList.toggle('complete', done === total);
    status.querySelector('b').textContent = done === total ? 'الحالة: اكتمل فتح مسارات الفحص' : `الحالة: تم توثيق ${done} من ${total} مصادر`;
    status.querySelector('small').textContent = done === total ? 'راجع ما ظهر في كل قاعدة وسجّل القرار أو رقم الإعلان عند وجوده.' : 'أكمل القواعد الرسمية قبل تدوين الاستنتاج.';
  }));
});

document.querySelector('#sourceCount').textContent = sources.length;
document.querySelector('#textCount').textContent = contentIndex.length;

const visualCases = {
  temperature: {
    title: 'قارئ الحرارة والرطوبة',
    guide: ['صوّر شاشة الجهاز بحيث تظهر القراءة بوضوح.', 'التقط صورة ثانية لملصق الجهاز والرقم التسلسلي.', 'أظهر موقع الجهاز بالنسبة للباب أو الرفوف.', 'اطلب شهادة المعايرة والخارطة الحرارية وسجل التنبيهات.'],
    note: 'الصورة قد تثبت وجود الجهاز والقراءة اللحظية، لكنها لا تثبت صلاحية المعايرة أو استمرارية الظروف التخزينية.',
    sample: { summary: 'ظهر جهاز إلكتروني لقياس الحرارة والرطوبة مثبت على جدار منطقة التخزين. القراءة الظاهرة قابلة للقراءة، ولا يظهر ملصق معايرة واضح في المثال.', observations: [
      { finding: 'وجود قارئ إلكتروني للحرارة والرطوبة', evidence: 'جهاز بشاشة رقمية مثبت في المنطقة', confidence: 'high' },
      { finding: 'القراءة اللحظية ظاهرة', evidence: '24.6°م ورطوبة 48% في المثال التوضيحي', confidence: 'high' },
      { finding: 'صلاحية المعايرة غير قابلة للتحقق', evidence: 'لا يظهر ملصق أو تاريخ معايرة واضح', confidence: 'low' }
    ], requirements: [
      { title: 'وسائل إلكترونية لقياس الحرارة والرطوبة', clause: 'تثبت في أماكن وارتفاعات مختلفة وفق خارطة حرارية فعالة، وتخضع للمعايرة والمراقبة الدورية.', source: 'MDS-REQ 12 — منطقة التخزين', page: 'الصفحتان 5–6', url: 'https://www.sfda.gov.sa/ar/regulations/88142' },
      { title: 'توفير قراءات وسجلات درجات الحرارة والرطوبة', clause: 'تكون القراءات متاحة عند الطلب مع الاحتفاظ بالسجلات وفق المدة المحددة.', source: 'مدونة أسس ممارسة التوزيع والتخزين الجيدة', page: 'الصفحتان 17–18', url: 'https://www.sfda.gov.sa/ar/regulations/69390' }
    ], evidenceNeeded: ['شهادة المعايرة السارية ورقم الجهاز', 'الخارطة الحرارية وموقع القارئ عليها', 'سجل القراءات والتنبيهات والتجاوزات', 'إجراء التعامل مع تجاوز درجات الحرارة'] }
  },
  receiving: {
    title: 'منطقة الاستلام',
    guide: ['صوّر المنطقة كاملة من مدخل الشحنة.', 'أظهر مناطق الانتظار والفحص والمنتجات المعلقة.', 'صوّر حالة الأرضية والحماية من الشمس والغبار.', 'التقط صورة لسجل حرارة الشحنة أو جهاز النقل عند الحاجة.'],
    note: 'النظافة والفصل والتكدس يمكن ملاحظتها بصريًا، أما تطبيق إجراءات الاستلام وسلامة الشحنات فيتطلب السجلات.',
    sample: { summary: 'تظهر منطقة استلام محددة، مع شحنة موضوعة مؤقتًا على طبليات. يلزم التحقق من الفصل عن المخزون المقبول ومن سجلات ظروف النقل.', observations: [
      { finding: 'وجود مساحة مخصصة للاستلام', evidence: 'تظهر بوابة تحميل ومنطقة انتظار للشحنات', confidence: 'medium' },
      { finding: 'استخدام طبليات وعدم الملامسة المباشرة للأرض', evidence: 'العبوات ظاهرة فوق طبليات', confidence: 'high' },
      { finding: 'الفصل بين الشحنة قيد الفحص والمخزون غير محسوم', evidence: 'لا تظهر لافتة حالة واضحة في المثال', confidence: 'medium' }
    ], requirements: [
      { title: 'التحقق من ظروف النقل عند الاستلام', clause: 'يجب التأكد من أن المستحضرات نُقلت ووزعت وفق ظروف التوزيع والتخزين المناسبة والاحتفاظ بالسجلات.', source: 'مدونة أسس ممارسة التوزيع والتخزين الجيدة — الاستلام والصرف', page: 'الصفحة 23', url: 'https://www.sfda.gov.sa/ar/regulations/69390' },
      { title: 'إجراءات مكتوبة للاستلام والصرف', clause: 'تراعي طبيعة المنتجات وأي احتياطات خاصة وحالة المنتجات المعلقة.', source: 'مدونة أسس ممارسة التوزيع والتخزين الجيدة', page: 'الصفحة 23', url: 'https://www.sfda.gov.sa/ar/regulations/69390' }
    ], evidenceNeeded: ['إجراء الاستلام المعتمد', 'سجل فحص الشحنة ودرجات الحرارة', 'حالة قبول أو تعليق الشحنة', 'بيانات الناقل والتشغيلة والكميات'] }
  },
  storage: {
    title: 'منطقة التخزين',
    guide: ['التقط صورة واسعة للممرات والأرفف.', 'أظهر المسافة عن الأرض والسقف وحالة الرص.', 'صوّر الإضاءة والتهوية واللوحات الإرشادية.', 'أظهر أي تلف أو تكدس أو تعرض مباشر للشمس.'],
    note: 'لا يمكن قياس كفاءة التهوية أو المسافات بدقة من صورة دون مرجع قياس أو وثائق مساندة.',
    sample: { summary: 'تظهر أرفف تخزين مرتفعة عن الأرض وممرات متاحة. لا تكفي الصورة وحدها لتقييم التهوية أو مطابقة ظروف كل منتج لتعليمات المصنع.', observations: [
      { finding: 'المنتجات مرفوعة عن الأرض', evidence: 'العبوات موضوعة على أرفف وطبليات', confidence: 'high' },
      { finding: 'الممرات ظاهرة وغير محجوبة في الجزء المصور', evidence: 'يوجد مسار حركة بين صفوف الأرفف', confidence: 'medium' },
      { finding: 'كفاءة التهوية غير قابلة للإثبات بصريًا', evidence: 'الصورة لا تقدم قياسات أو سجلات تهوية', confidence: 'low' }
    ], requirements: [
      { title: 'تهيئة منطقة التخزين', clause: 'تكون نظيفة، مضاءة ومهوّاة، وبمساحة تسمح بالتنظيف والفحص، مع أسطح وأرفف مناسبة.', source: 'MDS-REQ 12 — منطقة التخزين', page: 'الصفحتان 4–5', url: 'https://www.sfda.gov.sa/ar/regulations/88142' }
    ], evidenceNeeded: ['تعليمات المصنع لظروف التخزين', 'الخارطة الحرارية', 'سجلات التنظيف ومكافحة الآفات', 'قياسات المسافات عند الاشتباه'] }
  },
  isolation: {
    title: 'منطقة العزل',
    guide: ['أظهر لافتة المنطقة ومدخلها وحدودها.', 'صوّر بطاقات حالة المنتجات المعزولة.', 'تجنب إظهار بيانات شخصية أو مستندات حساسة.', 'طابق الكميات والتشغيلات مع سجل العزل.'],
    note: 'الصورة تساعد في إثبات وجود الفصل والتمييز، لكنها لا تثبت تطابق المخزون أو صلاحية الإجراء.',
    sample: { summary: 'تظهر منطقة محددة بلافتة عزل. يلزم التحقق من التحكم في الدخول وتمييز كل فئة ومطابقة المنتجات للسجلات.', observations: [
      { finding: 'وجود منطقة مميزة للعزل', evidence: 'لافتة عزل وحدود مكانية ظاهرة', confidence: 'high' },
      { finding: 'حالة كل منتج غير ظاهرة بالكامل', evidence: 'بطاقات الحالة صغيرة أو غير واضحة', confidence: 'medium' }
    ], requirements: [
      { title: 'عزل المنتجات ذات الحالات الخاصة', clause: 'يخصص مكان واضح للمحرز والمرتجع والمستدعى والتالف والمنتهي، ويُراقب إلى حين التصرف.', source: 'MDS-REQ 12 — منطقة التخزين', page: 'الصفحة 5', url: 'https://www.sfda.gov.sa/ar/regulations/88142' }
    ], evidenceNeeded: ['سجل العزل والكميات والتشغيلات', 'صلاحيات الدخول', 'قرارات السحب أو التحريز', 'إجراء التصرف والإتلاف أو الإرجاع'] }
  },
  cold: {
    title: 'ثلاجة أو مجمد',
    guide: ['صوّر شاشة القراءة والباب مغلقًا.', 'التقط صورة لمسبار القياس وملصق المعايرة.', 'أظهر حالة الرص وعدم حجب تدفق الهواء.', 'اطلب سجل الحرارة والإنذارات وخطة الطوارئ.'],
    note: 'القراءة المصورة لحظية؛ لا تنفي وجود تجاوز سابق أو انقطاع كهربائي.',
    sample: { summary: 'تظهر ثلاجة تخزين بقراءة لحظية ضمن النطاق المعتاد للمثال. لا يمكن إثبات ثبات الحرارة أو فاعلية الإنذار من الصورة.', observations: [
      { finding: 'قراءة درجة الحرارة ظاهرة', evidence: 'الشاشة تعرض 5.2°م في المثال', confidence: 'high' },
      { finding: 'استمرارية الحرارة غير قابلة للتحقق', evidence: 'لا يتوفر سجل زمني في الصورة', confidence: 'low' }
    ], requirements: [
      { title: 'مراقبة درجات الحرارة وخطة الطوارئ', clause: 'تطبق تعليمات المصنع وتتوفر المراقبة والإنذارات وخطة طوارئ للمنتجات التي تحتاج إلى تبريد.', source: 'MDS-REQ 12', page: 'الصفحتان 5–7', url: 'https://www.sfda.gov.sa/ar/regulations/88142' }
    ], evidenceNeeded: ['سجل الحرارة المستمر', 'اختبار الإنذار', 'شهادة معايرة المسبار', 'خطة الطوارئ ومصدر الطاقة الاحتياطي'] }
  },
  product: {
    title: 'منتج أو بطاقة',
    guide: ['صوّر واجهة العبوة والاسم التجاري.', 'صوّر المكونات والادعاءات وتعليمات التخزين.', 'التقط التشغيلة والصلاحية والباركود بوضوح.', 'صوّر أي ملصق إضافي أو تلف في العبوة.'],
    note: 'شكل العبوة لا يثبت أصالة المنتج أو تسجيله؛ تُستخدم البيانات المقروءة للبحث في قواعد الهيئة.',
    sample: { summary: 'تمت قراءة بيانات أساسية من بطاقة المنتج في المثال. يجب استخدام الاسم والتشغيلة والباركود للبحث في التسجيل والتحذيرات والسحب.', observations: [
      { finding: 'الاسم التجاري والباركود قابلان للقراءة', evidence: 'النص والرمز ظاهران بوضوح في المثال', confidence: 'high' },
      { finding: 'تعليمات التخزين تحتاج صورة أقرب', evidence: 'النص الجانبي صغير', confidence: 'medium' }
    ], requirements: [
      { title: 'الالتزام بالمعلومات التعريفية وتعليمات المصنع', clause: 'تشمل المعلومات طرق التخزين والنقل، ويلزم الالتزام بها في الإجراءات ذات العلاقة.', source: 'MDS-REQ 12', page: 'الصفحتان 4 و6', url: 'https://www.sfda.gov.sa/ar/regulations/88142' }
    ], evidenceNeeded: ['صورة المكونات والادعاءات', 'رقم التشغيلة والصلاحية', 'الباركود أو رقم التسجيل', 'البحث الفعلي في قواعد التسجيل والتحذيرات والسحب'] }
  }
};

let visualSelectedCase = 'temperature';
let visualImageData = '';
const visualFile = document.querySelector('#visualFile');
const visualPreview = document.querySelector('#visualPreview');
const visualDrop = document.querySelector('#visualDrop');
const visualResult = document.querySelector('#visualResult');

function renderVisualGuide() {
  const config = visualCases[visualSelectedCase];
  document.querySelector('#visualGuideTitle').textContent = config.title;
  document.querySelector('#visualGuideContent').innerHTML = `<div class="visual-guide-list">${config.guide.map((item, index) => `<div><i>${index + 1}</i><span>${escapeHTML(item)}</span></div>`).join('')}</div><p class="visual-guide-note">${escapeHTML(config.note)}</p>`;
}

document.querySelectorAll('[data-visual-case]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-visual-case]').forEach(item => item.classList.toggle('active', item === button));
  visualSelectedCase = button.dataset.visualCase;
  renderVisualGuide();
  visualResult.hidden = true;
}));

function readAndResizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('صيغة الصورة غير مدعومة'));
      img.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .84));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

visualFile.addEventListener('change', async () => {
  const file = visualFile.files && visualFile.files[0];
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) {
    alert('اختر صورة JPG أو PNG أو WEBP بحجم لا يتجاوز 12 ميجابايت.');
    visualFile.value = ''; return;
  }
  try {
    visualImageData = await readAndResizeImage(file);
    visualPreview.src = visualImageData; visualPreview.hidden = false;
    visualDrop.classList.add('has-photo');
    document.querySelector('#visualPhotoActions').hidden = false;
    document.querySelector('#visualFileMeta').textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    document.querySelector('#visualAnalyzeBtn').disabled = false;
    visualResult.hidden = true;
  } catch (error) { alert(error.message); }
});

document.querySelector('#replaceVisualPhoto').addEventListener('click', () => visualFile.click());

function renderVisualAnalysis(data, demo = false) {
  const labels = { high: 'ثقة مرتفعة', medium: 'ثقة متوسطة', low: 'يحتاج تحققًا' };
  const observations = (data.observations || []).map(item => `<div class="visual-observation"><div><b>${escapeHTML(item.finding)}</b><small>${escapeHTML(item.evidence)}</small></div><span class="confidence-chip ${escapeHTML(item.confidence)}">${labels[item.confidence] || 'غير محدد'}</span></div>`).join('');
  const requirements = (data.requirements || []).map(item => `<a class="visual-requirement" href="${escapeHTML(item.url)}" target="_blank" rel="noopener"><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.clause)}</small><strong>${escapeHTML(item.source)} • ${escapeHTML(item.page)} ↗</strong></a>`).join('');
  visualResult.className = 'visual-result'; visualResult.hidden = false;
  visualResult.innerHTML = `<div class="visual-result-head"><div><span class="eyebrow">${demo ? 'مثال توضيحي' : 'نتيجة التحليل البصري'}</span><h2>${escapeHTML(visualCases[visualSelectedCase].title)}</h2></div><span class="visual-result-status ${demo ? 'demo' : ''}">${demo ? 'ليس تحليلًا للصورة' : 'تحليل استرشادي'}</span></div>
    <p>${escapeHTML(data.summary)}</p>
    <div class="visual-result-grid"><section class="visual-result-block"><h3>الملاحظات المرئية</h3>${observations || '<p>لم تظهر ملاحظة قابلة للاعتماد.</p>'}</section>
    <section class="visual-result-block"><h3>المتطلبات الرسمية المرتبطة</h3>${requirements}</section>
    <section class="visual-result-block full"><h3>ما الذي يجب على المفتش التحقق منه؟</h3><ul class="visual-evidence-list">${(data.evidenceNeeded || []).map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul></section></div>
    <div class="visual-final-note"><b>الحكم النهائي للمفتش:</b> الصورة قرينة مساندة فقط. لا تُثبت المطابقة أو المخالفة دون مراجعة الوثائق والسجلات والقياسات والنص الرسمي الساري.</div>`;
  visualResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelector('#visualExampleBtn').addEventListener('click', () => renderVisualAnalysis(visualCases[visualSelectedCase].sample, true));
document.querySelector('#visualAnalyzeBtn').addEventListener('click', async () => {
  if (!visualImageData) return;
  visualResult.hidden = false; visualResult.className = 'visual-result loading';
  visualResult.innerHTML = '<span class="live-spinner">↻</span><h2>جارٍ تحليل الصورة وربطها بالمتطلبات…</h2><p>لن تُحفظ الصورة داخل التطبيق.</p>';
  try {
    const response = await fetch('/api/visual-analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseType: visualSelectedCase, context: document.querySelector('#visualContext').value.trim(), image: visualImageData }) });
    const data = await response.json();
    if (!response.ok) {
      visualResult.className = 'visual-result';
      visualResult.innerHTML = `<div class="visual-result-head"><div><span class="eyebrow">الواجهة جاهزة</span><h2>محرك الرؤية يحتاج تفعيلًا آمنًا</h2></div><span class="visual-result-status demo">غير مفعّل</span></div><div class="visual-engine-off">${escapeHTML(data.error || 'لم يتم تفعيل مفتاح التحليل البصري على الخادم بعد.')} يمكنك الآن استخدام زر «عرض مثال تحليلي» لمراجعة شكل النتيجة، ولن ندّعي أن الصورة قد حُللت.</div>`;
      return;
    }
    renderVisualAnalysis(data, false);
  } catch {
    visualResult.className = 'visual-result';
    visualResult.innerHTML = '<div class="visual-engine-off">تعذر الاتصال بمحرك التحليل الآن. لم تُحفظ الصورة ولم يصدر أي استنتاج عنها.</div>';
  }
});

renderVisualGuide();
renderResults();
const initial = location.hash.slice(1);
if (['home', 'search', 'classify', 'verify', 'visual'].includes(initial)) go(initial);

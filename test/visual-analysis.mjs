import worker from '../dist/server/index.js';

const requestBody = {
  caseType: 'temperature',
  context: 'مستودع أجهزة طبية',
  image: 'data:image/jpeg;base64,AA=='
};

const inactiveResponse = await worker.fetch(new Request('https://example.test/api/visual-analysis', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody)
}), {});
if (inactiveResponse.status !== 503) throw new Error('يجب ألا يعمل تحليل الصور دون مفتاح خادم آمن');

const NativeResponse = globalThis.Response;
globalThis.fetch = async (url, options) => {
  if (String(url) !== 'https://api.openai.com/v1/responses') return new NativeResponse('', { status: 404 });
  const sent = JSON.parse(options.body);
  if (!sent.input?.[0]?.content?.some(item => item.type === 'input_image')) throw new Error('لم تُرسل الصورة لمحرك الرؤية');
  return NativeResponse.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
    summary: 'ظهر قارئ رقمي مثبت على الجدار.',
    observations: [{ finding: 'وجود قارئ رقمي', evidence: 'شاشة رقمية ظاهرة', confidence: 'high' }],
    requirementIds: ['TEMP-MDS', 'FAKE-ID'],
    evidenceNeeded: ['شهادة المعايرة']
  }) }] }] });
};

const activeResponse = await worker.fetch(new Request('https://example.test/api/visual-analysis', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody)
}), { OPENAI_API_KEY: 'test-key', OPENAI_VISION_MODEL: 'test-model' });
const data = await activeResponse.json();
if (!activeResponse.ok) throw new Error('فشل التحليل البصري: ' + JSON.stringify(data));
if (data.observations[0]?.confidence !== 'high') throw new Error('لم تُحلل الملاحظة المرئية');
if (data.requirements.length !== 1 || !data.requirements[0].url.includes('sfda.gov.sa')) throw new Error('لم تُقيّد المتطلبات بالمصادر الرسمية المسموحة');
if (data.stored !== false) throw new Error('يجب توضيح أن الصورة لم تُحفظ');

console.log('PASS: التحليل البصري يعمل من الخادم ويربط الملاحظة بمتطلب SFDA رسمي فقط');

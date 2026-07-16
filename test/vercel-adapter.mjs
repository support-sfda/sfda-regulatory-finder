import { Readable } from 'node:stream';
import handler from '../api/official-search.mjs';

const NativeResponse = globalThis.Response;
globalThis.fetch = async () => new NativeResponse('<article><time>2026-01-01</time><a href="/ar/warnings/1">تحذير عسل</a></article>', { status: 200 });

const request = Readable.from([]);
request.method = 'GET';
request.url = '/api/official-search?q=%D8%B9%D8%B3%D9%84';
request.headers = { host: 'example.vercel.app', 'x-forwarded-proto': 'https' };

let body = Buffer.alloc(0);
const headers = {};
const response = {
  statusCode: 200,
  setHeader(key, value) { headers[key] = value; },
  end(value) { body = Buffer.from(value || ''); }
};

await handler(request, response);
const payload = JSON.parse(body.toString('utf8'));
if (response.statusCode !== 200 || !Array.isArray(payload.records) || !payload.records.length) {
  throw new Error('فشل محول Vercel في تشغيل البحث الرسمي');
}
console.log('PASS: محول Vercel يشغّل البحث الرسمي من وظيفة خادمية');

import worker from '../dist/server/index.js';

export async function runWorker(request, response) {
  try {
    const protocol = request.headers['x-forwarded-proto'] || 'https';
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '/', `${protocol}://${host}`);
    const method = request.method || 'GET';
    const init = { method, headers: request.headers };

    if (method !== 'GET' && method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      init.body = Buffer.concat(chunks);
    }

    const workerResponse = await worker.fetch(new Request(url, init), process.env);
    response.statusCode = workerResponse.status;
    workerResponse.headers.forEach((value, key) => response.setHeader(key, value));
    response.end(Buffer.from(await workerResponse.arrayBuffer()));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'تعذر تشغيل خدمة البحث الآن.', detail: String(error?.message || error) }));
  }
}

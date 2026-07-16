import { runWorker } from './_adapter.mjs';

export default function handler(request, response) {
  return runWorker(request, response);
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { createApiApp } from '../server-api.ts';

const app = createApiApp(true);

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawUrl = req.url || '/';
  const parsed = new URL(rawUrl, 'http://localhost');

  if (parsed.pathname === '/api/index' || parsed.searchParams.has('__vercel_path')) {
    const vercelPath = (parsed.searchParams.get('__vercel_path') || '').replace(/^\/+/, '');
    parsed.searchParams.delete('__vercel_path');
    const qs = parsed.searchParams.toString();
    const targetPath = vercelPath ? `/api/${vercelPath}` : '/api/health';
    req.url = qs ? `${targetPath}?${qs}` : targetPath;
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    res.once('finish', done);
    res.once('close', done);
    app(req as unknown as Request, res as unknown as Response);
  });
}

import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config } from './config.js';
import { migrate } from './db.js';
import { router } from './routes.js';

migrate();

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use('/api', router);

  const dist = path.resolve(process.cwd(), 'dist');
  app.use(express.static(dist));
  app.get('*splat', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as any).status) : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(status || 500).json({ error: message });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createApp().listen(config.port, '127.0.0.1', () => {
    console.log(`Interchange server listening on http://127.0.0.1:${config.port}`);
  });
}


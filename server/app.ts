import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter, handleOpenAiAppsChallenge } from './routes/api.js';
import { handleMcpRequest } from './services/mcpService.js';
import { oauthRouter } from './routes/oauth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.APP_BASE_URL || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      try { return new URL(v).origin; } catch { return ''; }
    })
    .filter(Boolean);

  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'self'"],
        "object-src": ["'none'"],
        "img-src": ["'self'", "data:", "https:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'"],
        "connect-src": ["'self'", ...allowedOrigins],
      }
    },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
  }));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && allowedOrigins.length === 0) return callback(null, true);
      return callback(new Error('CORS origin denied'));
    },
    credentials: true,
    methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Idempotency-Key','X-API-Key','Mcp-Session-Id'],
    exposedHeaders: ['Mcp-Session-Id'],
    maxAge: 600
  }));

  const bodyLimit = process.env.MAX_REQUEST_BODY_BYTES || '2mb';
  app.use('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: bodyLimit }));

  app.get('/.well-known/openai-apps-challenge', handleOpenAiAppsChallenge);
  app.use('/', oauthRouter);
  app.use('/api', apiRouter);
  app.all('/mcp', handleMcpRequest);

  if (!process.env.VERCEL) {
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  });

  return (req: Request, res: Response) => new Promise<void>((resolve) => {
    res.on('finish', () => resolve());
    app(req, res);
  });
}

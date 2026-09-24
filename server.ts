import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { apiRouter, handleOpenAiAppsChallenge } from './server/routes/api.js';
import { handleMcpRequest } from './server/services/mcpService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// 1. Basic security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Allow framing from AI Studio preview or disallow otherwise
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// 2. CORS configuration (allowing ChatGPT and web dashboard)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or MCP clients)
      if (!origin) return callback(null, true);
      // Allow localhost and any subdomains
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'X-API-Key'],
  })
);

// 3. Body parsers (max 2MB to prevent payload exhaustion)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. OpenAI Domain Verification Endpoint
// Exactly matches requirement: /.well-known/openai-apps-challenge
app.get('/.well-known/openai-apps-challenge', handleOpenAiAppsChallenge);

// 5. Mount API and MCP endpoints
app.use('/api', apiRouter);
// Mount /mcp directly at root path for ChatGPT remote MCP server
app.all('/mcp', handleMcpRequest);

// 6. Frontend Serving (Vite middleware in dev, dist in production)
async function setupFrontend() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[JITC Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[JITC Server] MCP Endpoint available at http://0.0.0.0:${PORT}/mcp`);
    console.log(`[JITC Server] OpenAI Challenge at http://0.0.0.0:${PORT}/.well-known/openai-apps-challenge`);
  });
}

setupFrontend().catch((err) => {
  console.error('[JITC Server] Failed to initialize:', err);
  process.exit(1);
});

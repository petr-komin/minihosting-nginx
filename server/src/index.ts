import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { initializeDatabase } from './db/database';
import authRoutes from './auth/auth.routes';
import sitesRoutes from './sites/sites.routes';
import nginxRoutes from './nginx/nginx.routes';
import sslRoutes from './ssl/ssl.routes';
import settingsRoutes from './settings/settings.routes';
import monitorRoutes from './monitor/monitor.routes';

const app = express();

// Důvěřovat Nginx reverse proxy (pro správné IP v rate-limiteru)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Vypnout pro SPA
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Rate limiting na login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 10,
  message: { error: 'Příliš mnoho pokusů o přihlášení. Zkuste to za 15 minut.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/setup', loginLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/nginx', nginxRoutes);
app.use('/api/ssl', sslRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/monitor', monitorRoutes);

// Servírovat Vue SPA v produkci
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(config.clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(config.clientDistPath, 'index.html'));
  });
}

// Inicializovat DB a spustit server
initializeDatabase();

app.listen(config.port, () => {
  console.log(`[Hostingy] Server běží na portu ${config.port}`);
  console.log(`[Hostingy] Prostředí: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

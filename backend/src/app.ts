import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', service: 'ReconcileAI Express Backend' });
});

// API Routes
app.use('/api', routes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;

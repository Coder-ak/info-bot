import express from 'express';
import dotenv from 'dotenv';

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getResult } from './services/service.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(cors()); // Allow all origins;
app.use(helmet()); // Basic security headers
app.use(
    rateLimit({
        windowMs: 10 * 60 * 1000, // 10 minutes
        max: 1000, // limit each IP to 1000 requests per window
        standardHeaders: true,
        legacyHeaders: false,
    }),
);
app.use(express.json());

// Health check route
app.get('/api/health', (_req, res) => {
    const rss = process.memoryUsage().rss / 1024 / 1024; // in MB
    const heapUsed = process.memoryUsage().heapUsed / 1024 / 1024; // in MB
    res.json({
        status: 'ok',
        rss: rss.toFixed(2) + ' MB',
        heapUsed: heapUsed.toFixed(2) + ' MB',
    });
});

// Query endpoint
app.post('/api/classify', (req, res) => {
    const { query } = req.body ?? {};

    if (typeof query === 'undefined') {
        return res.status(400).json({ error: 'Missing query parameter' });
    }
    if (typeof query !== 'string') {
        return res.status(400).json({ error: 'Query must be a string' });
    }
    if (!query.trim()) {
        return res.status(400).json({ error: 'Query cannot be empty' });
    }

    res.json(getResult(query));
});

app.listen(PORT, () => {
    console.log(`🎧 Info-bot listening on port ${PORT}`);
});

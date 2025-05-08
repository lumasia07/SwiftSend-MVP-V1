// routes/index.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';

import walletRoutes from './wallet.js';
import authRoutes from './auth.js';
import currencyRoutes from './currency.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public auth routes: login and register are handled inside authRoutes
router.use('/auth', authRoutes);

router.use('/currencies', currencyRoutes);

// Public routes
// router.use('/currencies', currencyRoutes);
// router.use('/exchange-rates', exchangeRateRoutes);

// Protected routes - require authentication
router.use('/wallet', walletRoutes);   
export default router;
import express from 'express';
import walletController from '../src/walletController.js';
import { authenticate } from '../middleware/auth.js';
import rateLimiter from '../middleware/rateLimiterWallet.js';

const router = express.Router();

// Apply authentication middleware to all wallet routes
router.use(authenticate);

/**
 * @route   POST /api/create/create-wallet
 * @desc    Create a new wallet
 * @access  Private
 */
router.post('/create-wallet', 
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 3, message: 'Too many wallet creation attempts, please try again later' }),
  walletController.createWallet
);

/**
 * @route   GET /api/my-wallets
 * @desc    Get all user wallets
 * @access  Private
 */
router.get('/my-wallets', walletController.getUserWallets);

/**
 * @route   GET /api/wallets/:walletId
 * @desc    Get specific wallet by ID
 * @access  Private
 */
router.get('/:walletId', walletController.getWalletById);

/**
 * @route   GET /api/wallets/:walletId/transactions
 * @desc    Get wallet transactions
 * @access  Private
 */
router.get('/:walletId/transactions', walletController.getWalletTransactions);

const walletRoutes = router;
export default walletRoutes;
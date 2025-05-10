import { PrismaClient } from '@prisma/client';
import walletService from '../services/walletService.js';

const prisma = new PrismaClient();

/**
 * Create a new wallet for the authenticated user
 */
export const createWallet = async (req, res) => {
  const { currencyCode = 'XLM' } = req.body;
  const userId = req.user.id;

  try {
    // Check if currency exists
    const currency = await prisma.currency.findUnique({
      where: { code: currencyCode }
    });

    if (!currency) {
      return res.status(400).json({ message: `Currency ${currencyCode} not supported` });
    }

    // Check if user already has a wallet for this currency
    const existingWallet = await walletService.getUserWallet(userId, currencyCode);
    
    if (existingWallet) {
      return res.status(409).json({ 
        message: `You already have a ${currencyCode} wallet`,
        walletId: existingWallet.id,
        publicKey: existingWallet.publicKey
      });
    }

    // Create wallet with rate limiting check
    const wallet = await walletService.createWallet(userId, currencyCode);

    return res.status(201).json({
      message: 'Wallet created successfully',
      walletId: wallet.id,
      publicKey: wallet.publicKey,
      currencyCode
    });
  } catch (error) {
    console.error('Wallet creation error:', error);
    
    // Handle specific errors
    if (error.message.includes('already has a')) {
      return res.status(409).json({ message: error.message });
    }
    
    return res.status(500).json({ 
      message: 'Failed to create wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all wallets for the authenticated user
 */
export const getUserWallets = async (req, res) => {
  const userId = req.user.id;

  try {
    const wallets = await walletService.getUserWallets(userId);
    
    const walletsWithBalance = await Promise.all(
      wallets.map(async (wallet) => {
        if (wallet.currency.isCrypto) {
          // For crypto wallets, sync with blockchain
          const updated = await walletService.syncWalletBalance(wallet.id);
          return {
            ...wallet,
            balance: updated.balance
          };
        }
        return wallet;
      })
    );

    return res.status(200).json({
      wallets: walletsWithBalance.map(wallet => ({
        id: wallet.id,
        publicKey: wallet.publicKey,
        currency: wallet.currency.code,
        currencyName: wallet.currency.name,
        balance: wallet.balance.toString(),
        isCrypto: wallet.currency.isCrypto,
        createdAt: wallet.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return res.status(500).json({ message: 'Failed to fetch wallets' });
  }
};

/**
 * Get a specific wallet by ID
 */
export const getWalletById = async (req, res) => {
  const { walletId } = req.params;
  const userId = req.user.id;

  try {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        currency: {
          select: {
            code: true,
            name: true,
            isCrypto: true
          }
        }
      }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Security check - ensure wallet belongs to authenticated user
    if (wallet.userId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // If crypto wallet, sync with blockchain
    if (wallet.currency.isCrypto) {
      const updated = await walletService.syncWalletBalance(wallet.id);
      wallet.balance = updated.balance;
    }

    return res.status(200).json({
      id: wallet.id,
      publicKey: wallet.publicKey,
      currency: wallet.currency.code,
      currencyName: wallet.currency.name,
      balance: wallet.balance.toString(),
      isCrypto: wallet.currency.isCrypto,
      createdAt: wallet.createdAt
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return res.status(500).json({ message: 'Failed to fetch wallet' });
  }
};

/**
 * Get wallet transactions
 */
export const getWalletTransactions = async (req, res) => {
  const { walletId } = req.params;
  const userId = req.user.id;

  try {
    // Verify wallet ownership
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });

    if (!wallet || wallet.userId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get transactions where this wallet is source or destination
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { sourceId: walletId },
          { destId: walletId }
        ]
      },
      include: {
        source: {
          select: {
            publicKey: true,
            currencyCode: true
          }
        },
        destination: {
          select: {
            publicKey: true,
            currencyCode: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.sourceId === walletId ? 'OUTGOING' : 'INCOMING',
        amount: tx.sourceId === walletId ? tx.amountSource.toString() : tx.amountDest.toString(),
        currency: tx.sourceId === walletId ? tx.source.currencyCode : tx.destination.currencyCode,
        counterpartyAddress: tx.sourceId === walletId 
          ? tx.destination.publicKey 
          : tx.source.publicKey,
        status: tx.status,
        stellarTxHash: tx.stellarTxHash || null,
        memo: tx.memo || null,
        fee: tx.fee.toString(),
        timestamp: tx.createdAt,
        completedAt: tx.completedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};

export default {
  createWallet,
  getUserWallets,
  getWalletById,
  getWalletTransactions
};
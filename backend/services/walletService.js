// services/walletService.js
import { Keypair } from '@stellar/stellar-sdk';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/**
 * Generate a new Stellar keypair
 * @returns {Object} Object containing public key and secret key
 */
export const generateStellarKeypair = () => {

  const keypair = Keypair.random();

  return {
    publicKey: keypair.publicKey(),
    secret: keypair.secret()
  };
};

/**
 * Encrypt a secret key using AES encryption
 * @param {String} secret - The secret key to encrypt
 * @returns {String} The encrypted secret
 */
export const encryptSecret = (secret) => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key is not configured');
  }
  return CryptoJS.AES.encrypt(secret, ENCRYPTION_KEY).toString();
};

/**
 * Decrypt an encrypted secret key
 * @param {String} encryptedSecret - The encrypted secret key
 * @returns {String} The decrypted secret key
 */
export const decryptSecret = (encryptedSecret) => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key is not configured');
  }
  const bytes = CryptoJS.AES.decrypt(encryptedSecret, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Fund a Stellar testnet account using Friendbot
 * @param {String} publicKey - The public key of the account to fund
 * @returns {Object} Response from Friendbot
 */
export const fundWithFriendbot = async (publicKey) => {
  try {
    // Validate the public key format
    if (!publicKey || publicKey.length !== 56) {
      throw new Error('Invalid Stellar public key format');
    }
    
    const response = await axios.get(
      `https://friendbot.stellar.org?addr=${publicKey}`
    );
    return response.data;
  } catch (error) {
    console.error('Friendbot funding failed:', error.response?.data || error.message);
    throw new Error('Testnet funding failed');
  }
};

/**
 * Check if a user has an existing wallet for the specified currency
 * @param {String} userId - The user ID
 * @param {String} currencyCode - The currency code
 * @returns {Object|null} The wallet if found, null otherwise
 */
export const getUserWallet = async (userId, currencyCode = 'XLM') => {
  return await prisma.wallet.findFirst({
    where: {
      userId,
      currencyCode
    }
  });
};

/**
 * Create a new wallet for a user
 * @param {String} userId - The user ID
 * @param {String} currencyCode - The currency code (default: XLM)
 * @returns {Object} The created wallet
 */
export const createWallet = async (userId, currencyCode = 'XLM') => {
  try {
    // Check if wallet already exists
    const existingWallet = await getUserWallet(userId, currencyCode);
    if (existingWallet) {
      throw new Error(`User already has a ${currencyCode} wallet`);
    }

    // Check if currency exists
    const currency = await prisma.currency.findUnique({
      where: { code: currencyCode }
    });

    if (!currency) {
      throw new Error(`Currency ${currencyCode} not found`);
    }

    // Generate Stellar keypair
    const { publicKey, secret } = generateStellarKeypair();

    // Create transaction with wallet and secure storage creation
    const wallet = await prisma.$transaction(async (prisma) => {
      // Create wallet record
      const newWallet = await prisma.wallet.create({
        data: {
          userId,
          currencyCode,
          publicKey,
          balance: 0
        }
      });

      // Store encrypted secret
      await prisma.secureStorage.create({
        data: {
          walletId: newWallet.id,
          encryptedSecret: encryptSecret(secret),
          keyVersion: 1
        }
      });

      return newWallet;
    });

    // Fund the wallet if it's a testnet XLM wallet
    if (process.env.NODE_ENV !== 'production' && currencyCode === 'XLM') {
      await fundWithFriendbot(publicKey);
    }

    return wallet;
  } catch (error) {
    console.error('Wallet creation failed:', error);
    throw error;
  }
};

/**
 * Get wallet balance from Stellar network
 * @param {String} publicKey - The public key of the wallet
 * @returns {Object} Balance information
 */
export const getStellarBalance = async (publicKey) => {
  try {
    const response = await axios.get(
      `https://horizon-testnet.stellar.org/accounts/${publicKey}`
    );
    
    const balances = response.data.balances;
    return balances.find(b => b.asset_type === 'native') || { balance: '0' };
  } catch (error) {
    console.error('Error fetching Stellar balance:', error.message);
    return { balance: '0' };
  }
};

/**
 * Sync wallet balance with Stellar network
 * @param {String} walletId - The wallet ID
 * @returns {Object} Updated wallet
 */
export const syncWalletBalance = async (walletId) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const stellarBalance = await getStellarBalance(wallet.publicKey);
    
    return await prisma.wallet.update({
      where: { id: walletId },
      data: { 
        balance: parseFloat(stellarBalance.balance),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Balance sync failed:', error);
    throw error;
  }
};

/**
 * Get all user wallets
 * @param {String} userId - The user ID
 * @returns {Array} List of user wallets
 */
export const getUserWallets = async (userId) => {
  return await prisma.wallet.findMany({
    where: { userId },
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
};

export default {
  generateStellarKeypair,
  createWallet,
  getUserWallet,
  getUserWallets,
  syncWalletBalance,
  encryptSecret,
  decryptSecret,
  fundWithFriendbot
};
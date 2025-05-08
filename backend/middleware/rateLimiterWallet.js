import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Simple in-memory rate limiter
 * In production, you should use Redis or a similar distributed store
 */
const requestCounts = new Map();

/**
 * Rate limiter middleware factory
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests in the time window
 * @param {string} options.message - Error message for rate limit exceeded
 * @returns {Function} Express middleware function
 */
export const rateLimiter = ({ windowMs = 60 * 60 * 1000, max = 100, message = 'Too many requests, please try again later' }) => {
  return (req, res, next) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return next();
    }
    
    const key = `${userId}:${req.originalUrl}`;
    const now = Date.now();
    
    // Get or create entry for this user+endpoint
    let entry = requestCounts.get(key);
    
    if (!entry) {
      entry = {
        count: 0,
        resetTime: now + windowMs
      };
      requestCounts.set(key, entry);
    }
    
    // Clear expired entries
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + windowMs;
    }
    
    // Check rate limit
    if (entry.count >= max) {  
      return res.status(429).json({ 
        message,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    // Increment counter
    entry.count++;
    next();
  };
};

export default rateLimiter;
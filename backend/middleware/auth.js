import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Use environment variable in production
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

export const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found or inactive.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token.' });
    } else if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token expired.' });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Internal server error during authentication.' });
  }
};

export const refreshToken = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = generateToken(user);
  res.locals.newToken = token;
  next();
};

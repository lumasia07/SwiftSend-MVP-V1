import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import emailService from '../middleware/emailService.js';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

export const generateToken = (user) => {
  const payload = { id: user.id, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

export const register = async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body;
  
  // Validate input fields
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }
  
  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already taken' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create new user (initially inactive until verified)
    const newUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        phone,
        isActive: false, // User starts as inactive until email is verified
      },
    });
    
    // Send verification OTP email
    const otpResult = await emailService.sendRegistrationOTP(newUser, req.ip);
    
    if (!otpResult.success) {
      console.error('Failed to send verification email:', otpResult.message);
    }
    
    return res.status(201).json({
      message: "User registered successfully. Please check your email to verify your account.",
      userId: newUser.id,
      email: newUser.email,
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


export const login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Check if user's email is verified
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    
    // Generate token
    const token = generateToken(user);
    
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: { 
        id: user.id, 
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success even if user not found (security best practice)
    if (!user) {
      return res.status(200).json({ 
        message: 'If your email is registered, you will receive a password reset OTP'
      });
    }
    
    // Only verified users can reset password
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Account not verified. Please verify your email first',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // Use email service to send OTP for password reset
    // This would need to be implemented in emailService.js
    /* 
    const result = await emailService.sendPasswordResetOTP(user, req.ip);
    
    // Log password reset request in audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: 'PASSWORD_RESET_REQUEST',
        actionDetails: 'User requested password reset',
        ipAddress: req.ip
      }
    });
    */
    
    return res.status(200).json({ 
      message: 'If your email is registered, you will receive a password reset OTP'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export default {
  register,
  login,
  generateToken,
//   requestPasswordReset
};
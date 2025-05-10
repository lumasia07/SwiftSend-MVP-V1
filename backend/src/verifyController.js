import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import emailService from '../middleware/emailService.js';

const prisma = new PrismaClient();

export const sendVerificationOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is already verified
    if (user.isActive) {
      return res.status(400).json({ 
        message: 'Email is already verified',
        isVerified: true
      });
    }
    
    const result = await emailService.sendRegistrationOTP(email);
    
    if (!result.success) {
      return res.status(500).json({ message: result.message });
    }
    
    return res.status(200).json({ 
      message: `Verification OTP sent successfully to ${user.email}`,
      expiresIn: result.expiresIn
    });
  } catch (error) {
    console.error('Error sending verification OTP:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } 
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const result = await emailService.verifyOTP(email, otp, req.ip);
    
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
      
    return res.status(200).json({
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const resendOTP = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const result = await emailService.resendOTP(email);
    
    if (!result.success) {
      return res.status(404).json({ message: result.message });
    }
    
    return res.status(200).json({ 
      message: 'Verification OTP resent successfully to ',
      expiresIn: result.expiresIn
    });
  } catch (error) {
    console.error('Error resending verification OTP:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const checkVerificationStatus = async (req, res) => {
  const { email } = req.params;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const isVerified = await emailService.isEmailVerified(email);
    
    return res.status(200).json({ 
      email,
      isVerified
    });
  } catch (error) {
    console.error('Error checking verification status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export default {
  sendVerificationOTP,
  verifyOTP,
  resendOTP,
  checkVerificationStatus
};
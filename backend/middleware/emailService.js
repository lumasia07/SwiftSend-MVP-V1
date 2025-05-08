import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OTP_EXPIRATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// Store OTPs temporarily (in production, consider using Redis)
const otpStore = new Map();

// Email configuration - load from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const storeOTP = (email, otp, userId) => {
  const otpData = {
    otp,
    expiresAt: Date.now() + OTP_EXPIRATION,
    userId
  };
  
  otpStore.set(email, otpData);
  return otpData;
};

const sendVerificationEmail = async (user, otp) => {
  return await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Verify Your Email Address',
    html: `
      <h1 style="color:rgb(184, 169, 223)">SwiftSend Email Verification</h1>
      <p>Hello ${user.firstName},</p>
      <p>Thank you for registering with our service. Please use the following OTP to verify your email address:</p>
      <h2 style="font-size: 24px; padding: 10px; background-color:rgb(118, 66, 202); color: white; display: inline-block;">${otp}</h2>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn't request this verification, please ignore this email.</p>
    `
  });
};

export const sendRegistrationOTP = async (user) => {
  try {
    const otp = generateOTP();
    
    // Store the OTP before sending
    storeOTP(user.email, otp, user.id);
    
    await sendVerificationEmail(user, otp);
    
    return {
      success: true,
      message: `Verification OTP sent successfully to ${user.email}`,
      expiresIn: OTP_EXPIRATION / 1000 // in seconds
    };
  } catch (error) {
    console.error('Error sending verification OTP:', error);
    return {
      success: false,
      message: 'Failed to send verification email',
      error: error.message
    };
  }
};

export const resendOTP = async (email) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { email },
      select: { id: true, email: true, firstName: true }
    });
    
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    const otp = generateOTP();
    storeOTP(email, otp, user.id);
    
    await sendVerificationEmail(user, otp);
    
    return {
      success: true,
      message: 'Verification OTP resent successfully',
      expiresIn: OTP_EXPIRATION / 1000 // in seconds
    };
  } catch (error) {
    console.error('Error resending verification OTP:', error);
    return {
      success: false,
      message: 'Failed to resend verification email',
      error: error.message
    };
  }
};

export const verifyOTP = async (email, otp) => {
  try {
    const otpData = otpStore.get(email);
    
    if (!otpData) {
      return {
        success: false,
        message: 'No OTP request found. Please request a new OTP.'
      };
    }
    
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(email);
      return {
        success: false,
        message: 'OTP expired. Please request a new one.'
      };
    }
    
    if (otpData.otp !== otp) {
      return {
        success: false,
        message: 'Invalid OTP'
      };
    }
    
    // OTP is valid - update user status to active
    await prisma.user.update({
      where: { id: otpData.userId },
      data: { isActive: true }
    });
    
    // Clean up OTP from store
    otpStore.delete(email);
    
    // Return verified user
    const user = await prisma.user.findUnique({ 
      where: { id: otpData.userId },
      select: { id: true, email: true }
    });
    
    return {
      success: true,
      message: 'Email verified successfully',
      user
    };
  } catch (error) {
    console.error('OTP verification error:', error);
    return {
      success: false,
      message: 'Verification failed',
      error: error.message
    };
  }
};

export const isEmailVerified = async (email) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { email },
      select: { isActive: true }
    });
    
    return user ? user.isActive : false;
  } catch (error) {
    console.error('Error checking email verification status:', error);
    return false;
  }
};

export default {
  sendRegistrationOTP,
  resendOTP,
  verifyOTP,
  isEmailVerified
};
import express from 'express';
import { register, login } from '../src/authController.js';
import verifyController from '../src/verifyController.js';
 
const router = express.Router();

// Public Auth Routes
router.post('/register', register);
router.post('/login', login);

//Email verification

router.post('/verify/send', verifyController.sendVerificationOTP);
router.post('/verify/confirm', verifyController.verifyOTP);
router.post('/verify/resend', verifyController.resendOTP);
router.get('/verify/status/:email', verifyController.checkVerificationStatus);

const authRoutes = router;
export default authRoutes;

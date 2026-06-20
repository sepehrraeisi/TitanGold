import express from 'express';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

function liveGuard(req, res) {
  const { dry_run = true, confirm_live = false } = req.body || {};
  if (dry_run !== false) {
    return res.json({
      success: true,
      dry_run: true,
      status: 'dry_run',
      message: 'Email dry-run accepted; no SMTP connection or email send was attempted.',
    });
  }
  if (confirm_live !== true) {
    return res.status(400).json({
      success: false,
      code: 'LIVE_CONFIRMATION_REQUIRED',
      error: 'confirm_live must be true for live email operations',
    });
  }
  return res.status(400).json({
    success: false,
    code: 'LIVE_NOT_SUPPORTED_YET',
    error: 'Live email delivery is disabled until secured server-side SMTP configuration is implemented',
  });
}

// Safe dry-run only. Live SMTP verification is frozen for P2.
router.post('/test', authenticate, async (req, res) => {
  return liveGuard(req, res);
});

// Safe dry-run only. Live arbitrary email sends are frozen for P2.
router.post('/send', authenticate, async (req, res) => {
  return liveGuard(req, res);
});

export default router;


import express from 'express';
import nodemailer from 'nodemailer';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Test SMTP connection
router.post('/test', authenticate, async (req, res) => {
  try {
    const { host, port, secure, auth, from, fromName, provider } = req.body;

    // Validate required fields
    if (!host || !port || !auth || !auth.user || !auth.password) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SMTP configuration. Required: host, port, auth.user, auth.password'
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: secure === true || port === 465, // true for 465, false for other ports
      auth: {
        user: auth.user,
        pass: auth.password
      },
      // Add provider-specific settings
      ...(provider === 'gmail' && {
        service: 'gmail',
        auth: {
          user: auth.user,
          pass: auth.password // For Gmail, use App Password
        }
      }),
      ...(provider === 'outlook' && {
        service: 'hotmail'
      })
    });

    // Test connection
    const startTime = Date.now();
    await transporter.verify();
    const latency = Date.now() - startTime;

    res.json({
      success: true,
      latency,
      message: 'SMTP connection successful'
    });
  } catch (error) {
    console.error('SMTP test error:', error);
    
    let errorMessage = 'SMTP connection test failed';
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Please check your username and password.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed. Please check your host and port.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout. Please check your network connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

// Send email
router.post('/send', authenticate, async (req, res) => {
  try {
    const { config, options } = req.body;

    // Validate config
    if (!config || !config.host || !config.port || !config.auth || !config.auth.user || !config.auth.password) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SMTP configuration'
      });
    }

    // Validate options
    if (!options || !options.to || !options.subject || (!options.text && !options.html)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email options. Required: to, subject, text or html'
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port),
      secure: config.secure === true || config.port === 465,
      auth: {
        user: config.auth.user,
        pass: config.auth.password
      },
      ...(config.provider === 'gmail' && {
        service: 'gmail'
      }),
      ...(config.provider === 'outlook' && {
        service: 'hotmail'
      })
    });

    // Prepare mail options
    const mailOptions = {
      from: config.from ? 
        (config.fromName ? `"${config.fromName}" <${config.from}>` : config.from) :
        config.auth.user,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      attachments: options.attachments || []
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Email send error:', error);
    
    let errorMessage = 'Failed to send email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Please check your SMTP credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed. Please check your SMTP server settings.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout. Please try again later.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Recipient address rejected. Please check the recipient email address.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

export default router;


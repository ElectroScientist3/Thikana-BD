const path = require('path');
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Payment = require('../models/Payment');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  if (!token) return res.status(401).json({ msg: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const getBackendUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

const extractGatewayPageUrl = (data) => {
  if (!data) return null;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return extractGatewayPageUrl(parsed);
    } catch (e) {
      // Fall back to raw string parsing below
    }

    const jsonMatch = data.match(/['"]GatewayPageURL['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]gatewayPageURL['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]GatewayPageUrl['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]redirectGatewayURL['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]redirect_url['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (jsonMatch) return jsonMatch[1];

    const formMatch = data.match(/<form[^>]+action=['"]([^'"]+)['"]/i);
    if (formMatch) return formMatch[1];

    const windowMatch = data.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
    if (windowMatch) return windowMatch[1];

    const anchorMatch = data.match(/href=['"]([^'"]+sslcommerz[^'"]+)['"]/i);
    if (anchorMatch) return anchorMatch[1];
  }

  if (typeof data === 'object' && data !== null) {
    return (
      data.GatewayPageURL ||
      data.gatewayPageURL ||
      data.GatewayPageUrl ||
      data.redirectGatewayURL ||
      data.redirect_url ||
      null
    );
  }

  return null;
};

const isLegacySSLCResponse = (data) => {
  if (typeof data !== 'string') return false;
  return /OLD API|EXPIRED|developer\.sslcommerz\.com|404 Not Found|Not Found/i.test(data);
};

const getRequestParam = (req, key) => {
  return req.body?.[key] ?? req.query?.[key];
};

const defaultSessionUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
const legacySessionUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/process.php';

// Initiate a payment session with SSLCOMMERZ
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { amount, purpose, bookingId, plan, tokens } = req.body;
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ msg: 'Invalid amount' });
    }

    const currentUser = await User.findById(req.userId).select('name email phone');
    const tran_id = `T_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payment = new Payment({
      user: req.userId,
      bookingId,
      purpose: purpose || 'other',
      amount: numericAmount,
      tran_id,
      transactionId: tran_id,
      store_order_id: tran_id,
      meta: { plan, tokens: Number(tokens) || null },
    });
    await payment.save();

    const store_id = process.env.SSLC_STORE_ID || 'thika6a7348e57eb32';
    const store_passwd = process.env.SSLC_STORE_PASSWORD || 'thika6a7348e57eb32@ssl';
    const backendBase = getBackendUrl();

    const payload = {
      store_id,
      store_passwd,
      total_amount: String(numericAmount),
      currency: 'BDT',
      tran_id,
      success_url: `${backendBase}/api/payments/success`,
      fail_url: `${backendBase}/api/payments/fail`,
      cancel_url: `${backendBase}/api/payments/cancel`,
      ipn_url: `${backendBase}/api/payments/ipn`,
      product_profile: 'general',
      product_name: purpose === 'tokens' ? 'Tokens' : 'Booking Payment',
      product_category: 'Services',
      shipping_method: 'NO',
      num_of_item: '1',
      cus_name: req.body.name || currentUser?.name || 'Customer',
      cus_email: req.body.email || currentUser?.email || 'no-reply@example.com',
      cus_phone: req.body.phone || currentUser?.phone || '01700000000',
      cus_add1: req.body.address || 'Dhaka',
      cus_city: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      value_a: purpose,
      value_b: bookingId || '',
      value_c: plan || '',
      value_d: tokens ? String(tokens) : '',
    };

    const configuredSessionUrl = defaultSessionUrl;
    const formParams = new URLSearchParams();
    Object.keys(payload).forEach(k => formParams.append(k, payload[k]));

    const sendSessionRequest = async (url) => {
      const response = await axios.post(url, formParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        responseType: 'text',
      });
      return response.data;
    };

    let data = await sendSessionRequest(configuredSessionUrl);
    let redirectUrl = extractGatewayPageUrl(data);

    if (!redirectUrl) {
      const legacyData = await sendSessionRequest(legacySessionUrl);
      if (extractGatewayPageUrl(legacyData)) {
        data = legacyData;
        redirectUrl = extractGatewayPageUrl(legacyData);
      }
    }

    if (redirectUrl) {
      payment.store_order_id = tran_id;
      await payment.save();
      return res.json({ redirectUrl, tran_id });
    }

    console.error('SSLCOMMERZ response did not include a usable redirect URL:', data);
    return res.status(500).json({ msg: 'No GatewayPageURL found in SSLCOMMERZ response', raw: data });
  } catch (err) {
    console.error('Initiate payment error', err.response?.data || err.message);
    res.status(500).json({ msg: 'Unable to initiate payment' });
  }
});

const handleSuccessCallback = async (req, res) => {
  try {
    const val_id = getRequestParam(req, 'val_id');
    const tran_id = getRequestParam(req, 'tran_id');
    if (!val_id || !tran_id) {
      return res.redirect(`${getFrontendUrl()}/payment-result?status=failed`);
    }

    const store_id = process.env.SSLC_STORE_ID || 'thika6a7348e57eb32';
    const store_passwd = process.env.SSLC_STORE_PASSWORD || 'thika6a7348e57eb32@ssl';
    const validationBase = process.env.SSLC_VALIDATION_URL || 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
    const validationUrl = `${validationBase}?val_id=${encodeURIComponent(val_id)}&store_id=${encodeURIComponent(store_id)}&store_passwd=${encodeURIComponent(store_passwd)}&v=1&format=json`;

    const validationResponse = await axios.get(validationUrl, { timeout: 10000 });
    const validationData = validationResponse.data;
    const isSuccessful = ['VALIDATED', 'VALID', 'SUCCESS', 'success'].includes(String(validationData?.status || '').toUpperCase());

    let payment = await Payment.findOne({ tran_id });
    if (!payment) {
      payment = await Payment.create({
        user: null,
        tran_id,
        amount: Number(validationData?.amount || 0),
        status: isSuccessful ? 'Completed' : 'Failed',
        gateway_response: validationData,
      });
    }

    payment.status = isSuccessful ? 'Completed' : 'Failed';
    payment.gateway_response = { ...validationData, callbackData: { ...req.query, ...req.body } };
    if (payment.amount == null || payment.amount === 0) {
      payment.amount = Number(validationData?.amount || payment.amount || 0);
    }
    await payment.save();

    if (isSuccessful && payment.purpose === 'tokens' && payment.user) {
      try {
        const tokensToAdd = Number(payment.meta?.tokens) || Math.round(Number(payment.amount) || 0);
        await User.findByIdAndUpdate(payment.user, { $inc: { tokens: tokensToAdd } });
      } catch (error) {
        console.warn('Failed to update user tokens', error.message);
      }
    }

    return res.redirect(`${getFrontendUrl()}/payment-result?status=${isSuccessful ? 'success' : 'failed'}&tran_id=${encodeURIComponent(tran_id)}`);
  } catch (error) {
    console.error('Success handler error', error.response?.data || error.message);
    res.status(500).send('Payment validation failed');
  }
};

router.get('/success', handleSuccessCallback);
router.post('/success', handleSuccessCallback);

const handleFailCallback = async (req, res) => {
  try {
    const tran_id = getRequestParam(req, 'tran_id');
    if (tran_id) {
      await Payment.findOneAndUpdate({ tran_id }, { status: 'Failed', gateway_response: { ...req.query, ...req.body } }, { new: true });
    }
    res.redirect(`${getFrontendUrl()}/payment-result?status=failed${tran_id ? `&tran_id=${encodeURIComponent(tran_id)}` : ''}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Payment fail handler error');
  }
};

router.get('/fail', handleFailCallback);
router.post('/fail', handleFailCallback);

const handleCancelCallback = async (req, res) => {
  try {
    const tran_id = getRequestParam(req, 'tran_id');
    if (tran_id) {
      await Payment.findOneAndUpdate({ tran_id }, { status: 'Canceled', gateway_response: { ...req.query, ...req.body } }, { new: true });
    }
    res.redirect(`${getFrontendUrl()}/payment-result?status=canceled${tran_id ? `&tran_id=${encodeURIComponent(tran_id)}` : ''}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Payment cancel handler error');
  }
};

router.get('/cancel', handleCancelCallback);
router.post('/cancel', handleCancelCallback);

router.post('/ipn', async (req, res) => {
  try {
    const data = req.body;
    const tran_id = data?.tran_id;
    if (tran_id) {
      const isSuccessful = ['VALIDATED', 'VALID', 'SUCCESS', 'success'].includes(String(data?.status || '').toUpperCase());
      await Payment.findOneAndUpdate({ tran_id }, { status: isSuccessful ? 'Completed' : 'Failed', gateway_response: data }, { new: true });
    }
    res.status(200).send('IPN received');
  } catch (error) {
    console.error('IPN error', error.message);
    res.status(500).send('IPN handling error');
  }
});

// List payments for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.extractGatewayPageUrl = extractGatewayPageUrl;
module.exports = router;

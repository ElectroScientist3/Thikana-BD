const test = require('node:test');
const assert = require('node:assert/strict');
const paymentsRouter = require('../routes/payments');

test('extractGatewayPageUrl prefers GatewayPageURL over redirectGatewayURL', () => {
  const payload = JSON.stringify({
    GatewayPageURL: 'https://sandbox.sslcommerz.com/gwprocess/v4/gateway.php?menu=true',
    redirectGatewayURL: 'https://sandbox.sslcommerz.com/gwprocess/v4/gateway.php?direct=true'
  });

  assert.equal(
    paymentsRouter.extractGatewayPageUrl(payload),
    'https://sandbox.sslcommerz.com/gwprocess/v4/gateway.php?menu=true'
  );
});

test('isValidatedTransaction requires matching transaction and amount', () => {
  const payment = { amount: 1250 };
  const validResponse = { status: 'VALIDATED', tran_id: 'T-1', amount: '1250', currency: 'BDT' };
  const wrongAmount = { ...validResponse, amount: '1249' };
  const wrongTransaction = { ...validResponse, tran_id: 'T-2' };

  assert.equal(paymentsRouter.isValidatedTransaction(validResponse, payment, 'T-1'), true);
  assert.equal(paymentsRouter.isValidatedTransaction(wrongAmount, payment, 'T-1'), false);
  assert.equal(paymentsRouter.isValidatedTransaction(wrongTransaction, payment, 'T-1'), false);
});

test('rent gateway callback carries the ledger entry in value_b', () => {
  const rentLedgerId = '507f1f77bcf86cd799439011';
  assert.equal(
    paymentsRouter.getRentLedgerIdFromCallback({ value_a: 'rent', value_b: rentLedgerId }),
    rentLedgerId,
  );
  assert.equal(
    paymentsRouter.getRentLedgerIdFromCallback({ value_a: 'booking', value_b: rentLedgerId }),
    null,
  );
});

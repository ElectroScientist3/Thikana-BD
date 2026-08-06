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

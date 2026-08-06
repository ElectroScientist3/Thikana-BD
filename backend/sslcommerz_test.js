const axios = require('axios');
const qs = new URLSearchParams();
const data = {
  store_id: 'thika6a7348e57eb32',
  store_passwd: 'thika6a7348e57eb32@ssl',
  total_amount: '10',
  currency: 'BDT',
  tran_id: 'TEST_' + Date.now(),
  success_url: 'http://localhost:5000/api/payments/success',
  fail_url: 'http://localhost:5000/api/payments/fail',
  cancel_url: 'http://localhost:5000/api/payments/cancel',
  ipn_url: 'http://localhost:5000/api/payments/ipn',
  product_profile: 'general',
  product_name: 'Test Product',
  product_category: 'Services',
  shipping_method: 'NO',
  num_of_item: '1',
  cus_name: 'Test User',
  cus_email: 'test@example.com',
  cus_phone: '01700000000',
  cus_add1: 'Dhaka',
  cus_city: 'Dhaka',
  cus_postcode: '1000',
  cus_country: 'Bangladesh',
};
for (const [k,v] of Object.entries(data)) qs.append(k, v);
const endpoints = [
  'https://sandbox.sslcommerz.com/gwprocess/v4/process.php',
  'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
  'https://sandbox.sslcommerz.com/gwprocess/v4/transaction/process.php',
  'https://sandbox.sslcommerz.com/gwprocess/v4/process',
  'https://sandbox.sslcommerz.com/gwprocess/v4/api',
];
(async function() {
  for (const url of endpoints) {
    try {
      const res = await axios.post(url, qs.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        responseType: 'text',
        timeout: 20000,
      });
      console.log('URL:', url);
      console.log('STATUS:', res.status);
      console.log('CONTENT-TYPE:', res.headers['content-type']);
      console.log('BODY START\n', res.data.slice(0, 700), '\n---\n');
    } catch (err) {
      console.log('URL:', url, 'ERROR:');
      if (err.response) {
        console.log('status', err.response.status);
        console.log(err.response.data.slice(0, 500));
      } else {
        console.log(err.message);
      }
      console.log('---');
    }
  }
})();

import https from 'https';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { plan_id } = req.body || {};

  if (!plan_id) {
    res.status(400).json({ error: 'plan_id is required' });
    return;
  }

  const username = 'rzp_live_SI7eJZcqXniZIm';
  const password = 'Jl7W1zrQbIJx8OC6eMBQE8oH';
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');

  const data = JSON.stringify({
    plan_id: plan_id,
    total_count: 60,
    quantity: 1,
    customer_notify: 1
  });

  const options = {
    hostname: 'api.razorpay.com',
    port: 443,
    path: '/v1/subscriptions',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const razorpayReq = https.request(options, (razorpayRes) => {
    let responseBody = '';
    razorpayRes.on('data', (chunk) => {
      responseBody += chunk;
    });

    razorpayRes.on('end', () => {
      try {
        const jsonResponse = JSON.parse(responseBody);
        res.status(razorpayRes.statusCode).json(jsonResponse);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Razorpay response', raw: responseBody });
      }
    });
  });

  razorpayReq.on('error', (error) => {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  });

  razorpayReq.write(data);
  razorpayReq.end();
}

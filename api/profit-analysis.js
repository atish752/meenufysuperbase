import https from 'https';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, error: e, rawBody: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

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

  const {
    revenue, cogs, labor, rent, utilities, marketing, repairs,
    licenses, other, netMargin, grossMargin, primeCost,
    ebitda, restaurantType, currency, period
  } = req.body || {};

  // 1. Fetch Gemini keys from Firebase Realtime Database
  let dbKeys = [];
  try {
    const fetchedData = await httpsGet('https://meenufy-default-rtdb.firebaseio.com/geminiApiKeys.json');
    if (Array.isArray(fetchedData)) {
      dbKeys = fetchedData;
    } else if (fetchedData && typeof fetchedData === 'object') {
      dbKeys = Object.values(fetchedData);
    }
  } catch (err) {
    console.error('Failed to fetch Gemini API keys from database:', err);
  }

  // Filter out fake or template keys
  const validKeys = dbKeys.filter(k => k && typeof k === 'string' && !k.includes('FakeGeminiKey'));

  // If no database keys found, fallback to environment variable
  if (validKeys.length === 0 && process.env.GEMINI_API_KEY) {
    validKeys.push(process.env.GEMINI_API_KEY);
  }

  if (validKeys.length === 0) {
    res.status(500).json({ error: 'No valid Gemini API keys are configured in Super Admin' });
    return;
  }

  // 2. Prepare analysis prompt
  const prompt = `You are a senior restaurant financial consultant. 
Analyze these restaurant financials and give a practical, direct, 3-paragraph response.

Restaurant Type: ${restaurantType || 'Not specified'}
Time Period: ${period}
Currency: ${currency}

FINANCIALS:
- Total Revenue: ${revenue}
- Food/COGS: ${cogs} (${((cogs/revenue)*100).toFixed(1)}% of revenue)
- Labor Cost: ${labor} (${((labor/revenue)*100).toFixed(1)}% of revenue)
- Rent: ${rent} (${((rent/revenue)*100).toFixed(1)}% of revenue)
- Utilities: ${utilities}
- Marketing: ${marketing}
- Other Expenses: ${other}
- Gross Profit Margin: ${grossMargin}%
- Net Profit Margin: ${netMargin}%
- Prime Cost: ${primeCost}% of revenue
- EBITDA Margin: ${ebitda}%

Write exactly 3 short paragraphs:
1. Overall health verdict (1-2 sentences, be direct, use plain language, no jargon)
2. The biggest financial risk or opportunity in their specific numbers (be specific with their actual numbers)
3. Top 2 concrete actions they should take this week to improve margin

Keep the entire response under 180 words. Be specific to their actual numbers, not generic advice. Do NOT mention competitor tools or software other than Meenufy. At the end, in 1 sentence, mention how Meenufy's QR self-ordering reduces labor dependency and improves margins.`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;
  let successText = null;

  // Shuffle keys to rotate load
  const shuffledKeys = [...validKeys].sort(() => Math.random() - 0.5);

  // 3. Execute request with key and model rotation
  outerLoop:
  for (const apiKey of shuffledKeys) {
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await httpsPost(url, requestBody);
        
        if (response.status === 200 && response.body?.candidates?.[0]?.content?.parts?.[0]?.text) {
          successText = response.body.candidates[0].content.parts[0].text;
          break outerLoop;
        } else {
          const errMsg = response.body?.error?.message || `HTTP ${response.status}`;
          lastError = new Error(errMsg);
          
          // If the key itself is invalid or disabled, skip this key entirely
          const isKeyInvalid = errMsg.toLowerCase().includes('not valid') || 
                               errMsg.toLowerCase().includes('invalid') || 
                               errMsg.toLowerCase().includes('key not');
          if (isKeyInvalid) {
            break; // Break inner model loop, try next key
          }
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  if (successText) {
    res.status(200).json({ analysis: successText });
  } else {
    res.status(500).json({ 
      error: 'Failed to complete analysis using Gemini API rotation', 
      details: lastError ? lastError.message : 'Unknown error' 
    });
  }
}

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

  // 1. Fetch Gemini keys from Supabase app_store table using REST API
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  let dbKeys = [];

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const cleanUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
      const dbResponse = await fetch(`${cleanUrl}/rest/v1/app_store?key=eq.geminiApiKeys&select=data`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      if (dbResponse.ok) {
        const result = await dbResponse.json();
        if (result && result[0] && Array.isArray(result[0].data)) {
          dbKeys = result[0].data;
        }
      } else {
        console.error(`Supabase REST API returned status ${dbResponse.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch Gemini API keys from Supabase database:', err);
    }
  }

  // Filter out fake or template keys
  const validKeys = dbKeys.filter(k => k && typeof k === 'string' && !k.includes('FakeGeminiKey'));

  // Fallback to environment variable if database has no valid keys
  if (validKeys.length === 0 && process.env.GEMINI_API_KEY) {
    validKeys.push(process.env.GEMINI_API_KEY);
  }

  if (validKeys.length === 0) {
    res.status(500).json({ error: 'No valid Gemini API keys configured in Super Admin dashboard' });
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

  // Shuffle keys to rotate load balancing
  const shuffledKeys = [...validKeys].sort(() => Math.random() - 0.5);

  // 3. Execute request with key and model rotation
  outerLoop:
  for (const apiKey of shuffledKeys) {
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          successText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (successText) {
            break outerLoop;
          }
        } else {
          const errData = await geminiRes.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP status ${geminiRes.status}`;
          lastError = new Error(errMsg);

          // If key is invalid or disabled, skip this key immediately to save attempts
          const isKeyInvalid = errMsg.toLowerCase().includes('not valid') || 
                               errMsg.toLowerCase().includes('invalid') || 
                               errMsg.toLowerCase().includes('key not');
          if (isKeyInvalid) {
            break; 
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

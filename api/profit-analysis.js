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

  const {
    revenue, cogs, labor, rent, utilities, marketing, repairs,
    licenses, other, netMargin, grossMargin, primeCost,
    ebitda, restaurantType, currency, period
  } = req.body || {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Anthropic API key is not configured' });
    return;
  }

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

  const data = JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 450,
    messages: [{ role: 'user', content: prompt }]
  });

  const options = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const anthropicReq = https.request(options, (anthropicRes) => {
    let responseBody = '';
    anthropicRes.on('data', (chunk) => {
      responseBody += chunk;
    });

    anthropicRes.on('end', () => {
      try {
        const jsonResponse = JSON.parse(responseBody);
        if (anthropicRes.statusCode === 200 && jsonResponse.content && jsonResponse.content[0]) {
          res.status(200).json({ analysis: jsonResponse.content[0].text });
        } else {
          res.status(anthropicRes.statusCode).json({ error: 'Failed to call Anthropic API', raw: jsonResponse });
        }
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Anthropic response', raw: responseBody });
      }
    });
  });

  anthropicReq.on('error', (error) => {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  });

  anthropicReq.write(data);
  anthropicReq.end();
}

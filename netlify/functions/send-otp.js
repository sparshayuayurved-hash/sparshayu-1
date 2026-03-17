
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { phone } = JSON.parse(event.body || '{}');
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid phone number' }) };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const storeRes = await fetch(`${supabaseUrl}/rest/v1/otp_store`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ phone, otp, expiry })
    });

    if (!storeRes.ok) {
      const err = await storeRes.text();
      console.error('Supabase store error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not store OTP. Try again.' }) };
    }

    const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message: 'Your Sparshayu OTP is ' + otp + '. Valid for 5 minutes. Do not share with anyone.',
        numbers: phone,
        flash: 0
      })
    });

    const smsData = await smsRes.json();
    if (!smsData.return) {
      console.error('Fast2SMS error:', smsData);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send OTP. Try again.' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('send-otp error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error. Try again.' }) };
  }
};

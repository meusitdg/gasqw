export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const publicKey = process.env.VIZZIONPAY_PUBLIC_KEY;
  const secretKey = process.env.VIZZIONPAY_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return res.status(503).json({ error: 'Pagamento ainda não configurado no servidor.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const amount = Number(body.amount);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const document = String(body.document || '').replace(/\D/g, '');

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor do pedido inválido.' });
    }
    if (name.length < 3 || !email.includes('@') || phone.length < 8) {
      return res.status(400).json({ error: 'Dados do cliente incompletos.' });
    }

    const identifier = 'gas-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

    const origin = req.headers.origin || '';
    const host = req.headers.host || '';
    const protocol = origin.startsWith('https://') ? 'https' : 'https';
    const baseUrl = origin || (host ? protocol + '://' + host : '');
    const callbackUrl = baseUrl ? baseUrl.replace(/\/$/, '') + '/api/vizzionpay/callback' : undefined;

    const payload = {
      identifier,
      amount: Number(amount.toFixed(2)),
      client: {
        name,
        email,
        phone
      },
      products: Array.isArray(body.products) ? body.products.slice(0, 50) : [{
        id: 'gas-delivery',
        name: 'Gás de cozinha',
        quantity: 1,
        price: Number(amount.toFixed(2)),
        physical: true
      }],
      metadata: {
        provider: 'Gás do Online',
        orderId: identifier
      }
    };

    if (document.length === 11 || document.length === 14) {
      payload.client.document = document;
    }
    if (callbackUrl) payload.callbackUrl = callbackUrl;

    const response = await fetch('https://app.vizzionpay.com.br/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publicKey,
        'x-secret-key': secretKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('VizzionPay create PIX failed:', response.status);
      return res.status(response.status >= 400 && response.status < 500 ? response.status : 502)
        .json({ error: data.message || 'Não foi possível criar o PIX.' });
    }

    return res.status(200).json({
      identifier,
      transactionId: data.transactionId,
      status: data.status,
      transactionStatus: data.transactionStatus || 'PENDING',
      pix: data.pix ? {
        code: data.pix.code,
        image: data.pix.image || null,
        expiresAt: data.pix.expiresAt || null
      } : null
    });
  } catch (error) {
    console.error('VizzionPay create PIX error:', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'Erro interno ao criar o pagamento.' });
  }
}

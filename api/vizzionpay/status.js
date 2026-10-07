export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const publicKey = process.env.VIZZIONPAY_PUBLIC_KEY;
  const secretKey = process.env.VIZZIONPAY_SECRET_KEY;
  const identifier = String(req.query?.identifier || '').trim();

  if (!publicKey || !secretKey) {
    return res.status(503).json({ error: 'Pagamento ainda não configurado no servidor.' });
  }
  if (!identifier || identifier.length > 120) {
    return res.status(400).json({ error: 'Identificador inválido.' });
  }

  try {
    const url = new URL('https://app.vizzionpay.com.br/api/v1/gateway/transactions');
    url.searchParams.set('clientIdentifier', identifier);

    const response = await fetch(url, {
      headers: {
        'x-public-key': publicKey,
        'x-secret-key': secretKey
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('VizzionPay transaction query failed:', response.status);
      return res.status(response.status >= 400 && response.status < 500 ? response.status : 502)
        .json({ error: data.message || 'Não foi possível consultar o pagamento.' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('VizzionPay status error:', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'Erro interno ao consultar o pagamento.' });
  }
}

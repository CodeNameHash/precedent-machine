export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, deal: null, id });
  }
  if (req.method === 'PUT') {
    return res.status(200).json({ ok: true, id });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, provision: null, id });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

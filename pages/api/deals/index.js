export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, deals: [] });
  }
  if (req.method === 'POST') {
    return res.status(201).json({ ok: true, id: null });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

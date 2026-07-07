export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const assignments = req.body.assignments || [];
  const unassigned = assignments.filter((item) => !item.newKey && !item.flagged);
  if (unassigned.length) return res.status(409).json({ error: 'Split assignments incomplete', unassigned });
  return res.status(200).json({ ok: true, assignments });
}

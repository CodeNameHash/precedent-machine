import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data (base64) required' });

  try {
    const buf = Buffer.from(data, 'base64');
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    const text = pages.join('\n\n').trim();
    return res.json({ text, pages: pdf.numPages, chars: text.length });
  } catch (err) {
    return res.status(500).json({ error: 'PDF parse failed: ' + err.message });
  }
}

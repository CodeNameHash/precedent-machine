import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

export const config = {
  api: { bodyParser: false },
};

// Extract text from various file types
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const buf = fs.readFileSync(filePath);

  if (ext === '.txt') {
    return buf.toString('utf-8');
  }

  if (ext === '.html' || ext === '.htm') {
    // Strip HTML tags, keep text
    const html = buf.toString('utf-8');
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (ext === '.zip') {
    const zip = await JSZip.loadAsync(buf);
    const texts = [];
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const entryExt = path.extname(name).toLowerCase();
      if (['.txt', '.html', '.htm'].includes(entryExt)) {
        const content = await entry.async('string');
        if (entryExt === '.html' || entryExt === '.htm') {
          texts.push(content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\n{3,}/g, '\n\n')
            .trim());
        } else {
          texts.push(content);
        }
      }
    }
    if (!texts.length) return '';
    return texts.join('\n\n---\n\n');
  }

  if (ext === '.doc' || ext === '.docx') {
    // For .docx, these are ZIP files with XML inside
    try {
      const zip = await JSZip.loadAsync(buf);
      const docXml = zip.file('word/document.xml');
      if (docXml) {
        const xml = await docXml.async('string');
        // Extract text from Word XML
        return xml
          .replace(/<w:br[^>]*\/>/gi, '\n')
          .replace(/<\/w:p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
    } catch {
      // Fall through
    }
    return '';
  }

  // Fallback: try reading as text
  return buf.toString('utf-8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const formidable = require('formidable');

  const form = formidable({
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 20,
  });

  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploaded = files.files || files.file || [];
    const fileList = Array.isArray(uploaded) ? uploaded : [uploaded];

    if (!fileList.length || !fileList[0]) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    let allText = '';

    for (const file of fileList) {
      const filePath = file.filepath || file.path;
      const originalName = file.originalFilename || file.name || 'unknown';
      try {
        const text = await extractText(filePath, originalName);
        results.push({ name: originalName, chars: text.length, ok: text.length > 0 });
        if (text) allText += text + '\n\n';
      } catch (err) {
        results.push({ name: originalName, chars: 0, ok: false, error: err.message });
      }
      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch {}
    }

    return res.json({
      text: allText.trim(),
      total_chars: allText.trim().length,
      files: results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

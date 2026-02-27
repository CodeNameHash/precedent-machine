const https = require('https');

const PIN = '3357';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  if (req.headers['x-pin'] !== PIN) return res.status(401).send('Invalid PIN');

  const { files, message } = req.body;
  if (!files?.length || !message) return res.status(400).send('Need files[] and message');

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).send('GITHUB_TOKEN env var not set');

  const owner = process.env.GITHUB_OWNER || 'CodeNameHash';
  const repo = process.env.GITHUB_REPO || 'precedent-machine';

  try {
    // Get latest commit SHA on main
    const ref = await ghApi(`/repos/${owner}/${repo}/git/ref/heads/main`, 'GET', null, token);
    const commitSha = ref.object.sha;
    const commit = await ghApi(`/repos/${owner}/${repo}/git/commits/${commitSha}`, 'GET', null, token);
    const treeSha = commit.tree.sha;

    // Create blobs for each file
    const tree = [];
    for (const f of files) {
      const blob = await ghApi(`/repos/${owner}/${repo}/git/blobs`, 'POST', {
        content: f.content, encoding: 'utf-8'
      }, token);
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // Create tree, commit, update ref
    const newTree = await ghApi(`/repos/${owner}/${repo}/git/trees`, 'POST', {
      base_tree: treeSha, tree
    }, token);
    const newCommit = await ghApi(`/repos/${owner}/${repo}/git/commits`, 'POST', {
      message, tree: newTree.sha, parents: [commitSha]
    }, token);
    await ghApi(`/repos/${owner}/${repo}/git/refs/heads/main`, 'PATCH', {
      sha: newCommit.sha
    }, token);

    res.status(200).send(`Deployed: ${newCommit.sha.slice(0,7)} - ${message}`);
  } catch (e) {
    res.status(500).send('Deploy failed: ' + e.message);
  }
};

function ghApi(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com', path, method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'precedent-deploy',
        'Accept': 'application/vnd.github.v3+json',
        ...(data && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) })
      }
    };
    const r = https.request(opts, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => {
        if (resp.statusCode >= 400) reject(new Error(`${resp.statusCode}: ${d}`));
        else resolve(JSON.parse(d));
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

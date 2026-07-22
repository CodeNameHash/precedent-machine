function isVercelRuntime(env = process.env) {
  return Boolean(env.VERCEL);
}

function blockVercelRepositoryArtifactRoute(res, env = process.env) {
  if (!isVercelRuntime(env)) return false;
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(404).json({ error: 'not_found' });
  return true;
}

module.exports = { blockVercelRepositoryArtifactRoute, isVercelRuntime };

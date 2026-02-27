// Returns current build version. Client polls this to detect new deployments.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || '__BUILD_TS__', ts: Date.now() });
};

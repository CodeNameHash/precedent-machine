function designPreviewEnabled(env = process.env) {
  if (env.ENABLE_DESIGN_PREVIEW === '1') return true;
  if (env.ENABLE_DESIGN_PREVIEW === '0') return false;
  if (env.VERCEL_ENV === 'preview') return true;
  return env.NODE_ENV !== 'production';
}

function designPreviewServerSideProps(env = process.env) {
  if (!designPreviewEnabled(env)) return { notFound: true };
  return { props: {} };
}

module.exports = {
  designPreviewEnabled,
  designPreviewServerSideProps,
};

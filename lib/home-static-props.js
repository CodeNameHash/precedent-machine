const { getHomePayload } = require('./home-snapshot');

const REVALIDATE_SECONDS = 300;

function getHomeStaticProps() {
  return {
    props: { initialData: getHomePayload() },
    revalidate: REVALIDATE_SECONDS,
  };
}

module.exports = { getHomeStaticProps, REVALIDATE_SECONDS };

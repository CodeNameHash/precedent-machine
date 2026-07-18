// review-v2 is retired: the Mergertrace design it shipped is now the
// production /review/[id] route. This route only exists so old
// /review-v2/<id> links (bookmarks, saved emails) keep working — it
// redirects straight to /review/<id> and renders nothing itself.

export default function ReviewV2Redirect() {
  return null;
}

export async function getServerSideProps({ params }) {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return {
    redirect: {
      destination: `/review/${id}`,
      permanent: false,
    },
  };
}

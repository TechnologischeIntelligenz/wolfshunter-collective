export const loader = async () => {
  return Response.json([], {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
};

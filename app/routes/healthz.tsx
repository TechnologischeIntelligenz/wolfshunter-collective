export const loader = async () => {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "wolfshunter-collective",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
};
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const sessions = await prisma.session.findMany({
    select: {
      id: true,
      shop: true,
      isOnline: true,
      expires: true,
      refreshTokenExpires: true,
      scope: true,
      accessToken: true,
      refreshToken: true,
    },
    orderBy: [{ shop: "asc" }, { isOnline: "asc" }],
  });

  console.log(
    JSON.stringify(
      sessions.map(({ accessToken, refreshToken, ...session }) => ({
        ...session,
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
      })),
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({datasourceUrl: 'file:C:/Users/gdjes/IdeaProjects/wolfshunter-collective-recovered-20260821/prisma/dev.sqlite'});
try {
 const result = await db.$queryRawUnsafe('PRAGMA integrity_check');
 if (JSON.stringify(result) !== '[{"integrity_check":"ok"}]') throw new Error('Database integrity check failed');
 await db.$executeRawUnsafe("VACUUM INTO '" + process.argv[2].replaceAll('\\','/').replaceAll("'", "''") + "'");
 console.log('Consistent SQLite backup created; integrity_check: ok');
} finally {await db.$disconnect();}

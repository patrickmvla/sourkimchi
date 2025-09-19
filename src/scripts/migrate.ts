import 'dotenv/config';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from '../db/client'; // or '../src/lib/db/client' if your code lives under src/

async function main() {
  console.log('Applying migrations from ./drizzle …');
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('✅ Migrations applied');
}
main().catch((e) => {
  console.error('❌ Migration failed', e);
  process.exit(1);
});
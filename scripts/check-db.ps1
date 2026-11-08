$ErrorActionPreference = 'Stop'
$exitCode = 0

Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\api')
try {
    @'
import 'dotenv/config';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

let sql;
try {
  sql = postgres(process.env.DATABASE_URL, {
    ssl: 'require',
    connect_timeout: 10,
  });
  const [row] = await sql`select 1 as ok`;
  if (row.ok !== 1) {
    throw new Error('Unexpected query result');
  }
  console.log('PostgreSQL connection OK');
} catch (error) {
  const code = typeof error?.code === 'string' &&
    /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN';
  console.error(`PostgreSQL connection check failed (${code}). Check DATABASE_URL and database availability.`);
  process.exitCode = 1;
} finally {
  if (sql) {
    await sql.end({ timeout: 5 });
  }
}
'@ | & node --input-type=module
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $exitCode

const { Client } = require('pg');

async function testConnection(url) {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log(`Success: Connected to ${url}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed for password: ${url.split(':')[3].split('@')[0]} - ${err.message}`);
    return false;
  }
}

async function run() {
  const passwords = [
    'ankit', 'ankit123', 'Ankit', 'Ankit123', 'admin123', 'password',
    '12345678', '12345', 'postgres', 'root', '123', '1234', '123456'
  ];
  for (const pw of passwords) {
    const url = `postgresql://postgres:${pw}@localhost:5432/postgres`;
    const success = await testConnection(url);
    if (success) {
      console.log(`Use this password: ${pw}`);
      process.exit(0);
    }
  }
  console.log('All connection attempts failed.');
  process.exit(1);
}

run();

const { Client } = require('pg');

const regions = [
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'sa-east-1', 'ca-central-1'
];

async function probe() {
  for (const r of regions) {
    const host = 'aws-0-' + r + '.pooler.supabase.com';
    const client = new Client({
      host,
      port: 5432,
      user: 'postgres.qrrzrtkijadxzyiekale',
      password: 'Thuthuy0604',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3500
    });
    try {
      await client.connect();
      console.log('SUCCESS! FOUND REGION:', r, 'HOST:', host);
      await client.end();
      return host;
    } catch (e) {
      if (!e.message.includes('not found') && !e.message.includes('ENOTFOUND')) {
        console.log(r, 'response:', e.message);
      }
    }
  }
  console.log('Probe finished.');
}

probe();

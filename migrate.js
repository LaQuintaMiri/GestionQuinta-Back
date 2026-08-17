const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  user: 'postgres.qogdlysfqlndpuwfecsk',
  password: 'Angygiuli74',
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('Conectando a Supabase vía Pooler (puerto 6543) con contraseña corregida...');
    await client.connect();
    console.log('¡Conectado exitosamente!');

    const sqlPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Ejecutando script schema.sql...');
    await client.query(sql);
    console.log('¡Migración exitosa! Las tablas fueron creadas e inicializadas.');
  } catch (error) {
    console.error('Error ejecutando migración:', error);
  } finally {
    await client.end();
  }
}

runMigration();

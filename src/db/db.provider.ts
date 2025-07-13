import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DB_PROVIDER = 'DB_PROVIDER';

export const dbProvider = {
  provide: DB_PROVIDER,
  useFactory: async (configService: ConfigService) => {
    const dbHost = configService.get<string>('DB_HOST');
    const dbPort = configService.get<number>('DB_PORT');
    const dbUser = configService.get<string>('DB_USER');
    const dbPassword = configService.get<string>('DB_PASSWORD');
    const dbName = configService.get<string>('DB_NAME');

    if (!dbHost || !dbPort || !dbUser || !dbPassword || !dbName) {
      throw new Error('Database environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) are not set');
    }

    console.log('Creating new Pool...');
    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });
    console.log('Pool created.');

    try {
      await pool.query('SELECT NOW()');
      console.log('Database connection successful.');
    } catch (error) {
      console.error('Failed to connect to the database:', error);
      throw error;
    }

    console.log('Initializing drizzle...');
    const db = drizzle(pool, { schema });
    console.log('Drizzle initialized.');

    return db;
  },
  inject: [ConfigService],
};

@Injectable()
export class DbService {}
import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DB_PROVIDER = 'DB_PROVIDER';

export const dbProvider = {
  provide: DB_PROVIDER,
  useFactory: (configService: ConfigService) => {
    const dbHost = configService.get<string>('DB_HOST');
    const dbPort = configService.get<string>('DB_PORT');
    const dbUser = configService.get<string>('DB_USER');
    const dbPassword = configService.get<string>('DB_PASSWORD');
    const dbName = configService.get<string>('DB_NAME');

    if (!dbHost || !dbPort || !dbUser || !dbPassword || !dbName) {
      throw new Error('Database environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) are not set');
    }

    console.log('DB_HOST:', dbHost);
    console.log('DB_PORT:', dbPort);
    console.log('DB_USER:', dbUser);
    console.log('DB_NAME:', dbName);

    console.log('Creating new Pool...');
    const pool = new Pool({
      host: dbHost,
      port: parseInt(dbPort, 10),
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });
    console.log('Pool created.');

    console.log('Initializing drizzle...');
    const db = drizzle(pool, { schema });
    console.log('Drizzle initialized.');

    return db;
  },
  inject: [ConfigService],
};

@Injectable()
export class DbService {}
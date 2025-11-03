import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import { User, Account, Category, Email, UnsubscribeJob } from './models';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for Sequelize');
}

const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  models: [User, Account, Category, Email, UnsubscribeJob],
  logging: false,
  dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : undefined,
});

export default sequelize;

export async function initSequelize(opts?: { sync?: boolean }) {
  await sequelize.authenticate();
  if (opts?.sync) {
    await sequelize.sync({ alter: true });
  }
}

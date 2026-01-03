import { Express } from 'express';

export function readSqlFile(file: Express.Multer.File): string {
  return file.buffer.toString('utf-8');
}

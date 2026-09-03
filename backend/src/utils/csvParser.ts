import csvParser from 'csv-parser';
import { Readable } from 'stream';

export const parseCSVBuffer = <T = any>(buffer: Buffer): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    const stream = Readable.from(buffer);
    stream
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

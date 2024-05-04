import fs from 'fs';
import { parse } from 'csv-parse';
import { finished } from 'stream/promises';
import assert from 'node:assert';

export async function processFile<T>(filename: string, action: (record: string[]) => void) {
  const parser = fs
    .createReadStream(filename)
    .pipe(parse({
      delimiter: ',',
      from_line: 2,
      bom: true
    }));
  parser.on('readable', function(){
    let record; while ((record = parser.read()) !== null) {
      action(record);
    }
  });
  await finished(parser);
};

const casPattern = /^\d{2,7}-\d{2}-\d{1,2}$/;
export const checkCAS = (cas: string) => {
  if (!casPattern.test(cas)) {
    return `CAS number ${cas} is invalid`;
  }
  const parts = cas.split('-');
  const checkDigit = Number(parts[2]);
  const digits = parts[0] + parts[1];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (digits.length - i);
  }
  if (sum % 10 !== checkDigit) {
    return `Check digit of CAS number ${cas} is invalid`;
  }
  return true;
}

export const removeBrackets = (name: string) => {
  return name.replace(/-?\[\d+\]/g, '');
}

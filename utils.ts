import fs from 'fs';
import { parse } from 'csv-parse';
import { finished } from 'stream/promises';

export class CAS {
  parts: [number, number,number];

  constructor(public cas: string) {
    if (!checkCAS(cas)) {
      throw new Error(`Invalid CAS number: ${cas}`);
    }
    this.parts = CAS.parseCas(cas);
  }

  static parseCas(cas: string): [number, number, number] {
    const parts = cas.split('-');
    return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  }

  toString() {
    return this.parts[0].toString() + '-' + this.parts[1].toString().padStart(2, '0') + '-' + this.parts[2].toString();
  }

  equals(cas: CAS) {
    return this.parts[0] === cas.parts[0] && this.parts[1] === cas.parts[1];
  }
}

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
    return `CAS number "${cas}" is invalid`;
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

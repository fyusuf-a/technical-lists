import fs from 'fs';
import { parse } from 'csv-parse';
import { finished } from 'stream/promises';
import { distance } from 'fastest-levenshtein';

export class EC {
  parts: [number, number,number];

  constructor(public ec: string) {
    if (!checkEC(ec)) {
      throw new Error(`Invalid EC number: ${ec}`);
    }
    this.parts = EC.parseEc(ec);
  }

  static parseEc(cas: string): [number, number, number] {
    const parts = cas.split('-');
    return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  }

  toString() {
    return this.parts[0].toString() + '-' + this.parts[1].toString().padStart(2, '0') + '-' + this.parts[2].toString();
  }

  equals(ec: EC): boolean {
    return this.parts[0] === ec.parts[0] && this.parts[1] === ec.parts[1];
  }
}

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

  equals(cas: CAS): boolean {
    return this.parts[0] === cas.parts[0] && this.parts[1] === cas.parts[1];
  }
}

export class Matter {
  // merged properties
  cas?: CAS;
  ec?: EC;
  name: string;
  otherNames: string[];
  ncs?: string;

  // not merged
  forbiddenInEU: boolean;
  euTypeRestriction?: string;
  euEndocrinianDisruptor: boolean;
  deductEndocrinianDisruptor: boolean;
  euCorapConcern?: string;
  euClpClassification?: string;
  reachIntentionConcern: string;
  circ?: string;
  ifraRestriction?: string;
  ifraAmendment: string;
  ifraAutoclassified: boolean;

  constructor(name: string) {
    this.name = name;
    this.otherNames = [];
    this.forbiddenInEU = false;
    this.euEndocrinianDisruptor = false;
    this.deductEndocrinianDisruptor = false;
    this.reachIntentionConcern = '';
    this.ifraAmendment = '';
    this.ifraAutoclassified = false;
  }

  equals(matter: Matter) {
    let areCasEqual = false;
    if (this.cas && matter.cas) {
      areCasEqual = this.cas.equals(matter.cas);
    }
    let areEcEqual = false;
    if (this.ec && matter.ec) {
      areEcEqual = this.ec === matter.ec;
    }
    return areCasEqual || areEcEqual;
  }

  merge(matter: Matter): void {
    const newMatter = new Matter(this.name);
    addName(this.name, newMatter);
    if (this.cas && matter.cas && !this.cas.equals(matter.cas)) {
      throw new Error('Cannot merge two matters with different numbers');
    }
    if (this.ec && matter.ec && !this.ec.equals(matter.ec)) {
      throw new Error('Cannot merge two matters with different numbers');
    }
    this.cas = this.cas || matter.cas;
    this.ec = this.ec || matter.ec;
    this.ncs = this.ncs || matter.ncs;
  }
    

}

const CMR_REGEX = /carc|muta|repr|lact|CMR/i;
export const isCMR = (matter: Matter) => {
    return (
        (matter.euClpClassification && matter.euClpClassification?.match(CMR_REGEX) !== null)
        || (matter.euCorapConcern && matter.euCorapConcern?.match(CMR_REGEX) !== null)
        || matter.reachIntentionConcern.match(CMR_REGEX) !== null
        || (matter.circ && matter.circ?.match(/1|2A|2B|3/) !== null)
        || matter.ifraAutoclassified
    );
  }
export const isPE = (matter: Matter) => {
  return matter.euEndocrinianDisruptor
 || matter.deductEndocrinianDisruptor
 || (matter.euCorapConcern && matter.euCorapConcern?.match(/endocrin/i) !== null)
 || matter.reachIntentionConcern.match(/endocrin/i) !== null;
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

const ecPattern = /^\d{3}-\d{3}-\d{1}$/;
export const checkEC = (ec: string) => {
  if (!ecPattern.test(ec)) {
    return `EC number "${ec}" is invalid`;
  }
  return true;
}

export const removeBrackets = (name: string) => {
  return name.replace(/-?\[\d+\]/g, '');
}

export const shouldBeIncluded = (matter: Matter) => {
  return !matter.forbiddenInEU
        && matter?.ifraRestriction !== 'P'
        && !matter.cas?.equals(new CAS('64-17-5')) // remove ethanol
        && !matter.ncs;
}
const isNameSimilar = (a: string, b: string) => {
  let a_ = a.toLowerCase();
  let b_ = b.toLowerCase();
  if (a_ === b_) {
    return true;
  }
  const distanceValue = distance(a_, b_);
  if (distanceValue < 3) {
    return true;
  }
  return false;
}

const isNameNew = (newName: string, matter: Matter) => {
  if (isNameSimilar(newName, matter.name)) {
    return false;
  }
  const names = matter.otherNames;
  for (let i = 0; i < names.length; i++) {
    if (isNameSimilar(newName, names[i])) {
      return false;
    }
  }
  return true;
}

export const addName = (newName: string, matter: Matter) => {
  if (isNameNew(newName, matter)) {
    if (newName.length < matter.name.length) {
      matter.otherNames.push(matter.name);
      matter.name = newName;
    } else {
      matter.otherNames.push(newName);
    }
  }
}

export const appendIfNotUndefined = (a: string, b?: string) => {
  if (b) {
    return `${b} / ${a}`;
  }
  return a;
}

import { processFile } from './utils';
import { promises as fs } from 'fs';
import { stringify } from 'csv-stringify';

type Matter = {
  cas: string;
  name: string;
  ncs?: string;
  forbiddenInEU?: string;
  euTypeRestriction?: string;
  euMaximum?: string;
  euOther?: string;
  euComments?: string;
  cmr?: string;
  circ?: string;
}

const appendIfNotUndefined = (a: string, b?: string) => {
  if (b) {
    return `${b} / ${a}`;
  }
  return a;
}

const main = async () => {
  const allMatters: Set<Matter> = new Set();
  await processFile('./sources/ifra.csv', (record) => {
    const [cas, name, ncs] = record;
    const matter: Matter = { cas: cas ? cas.trim() : cas, name: name.trim() };
    if (ncs.trim() !== '') {
      matter.ncs = ncs.trim();
    }
    allMatters.add(matter);
  });

  await processFile('./treated/forbidden-eu-treated.csv', (record) => {
    const cas = record[1].trim();
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas === cas) {
        matter.value.forbiddenInEU = 'yes';
      }
    }
  });

  await processFile('./treated/restricted-eu-treated.csv', (record) => {
    const cas = record[1].trim();
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas === cas) {
        matter.value.euTypeRestriction = appendIfNotUndefined(record[2], matter.value.euTypeRestriction);
        matter.value.euMaximum = appendIfNotUndefined(record[3], matter.value.euMaximum);
        matter.value.euOther = appendIfNotUndefined(record[4], matter.value.euOther);
        matter.value.euComments = appendIfNotUndefined(record[5], matter.value.euComments);
      }
    }
  });

  await processFile('./treated/cmr-treated.csv', (record) => {
    const cas = record[1].trim();
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas === cas) {
        matter.value.cmr = 'yes';
      }
    }
  });

  await processFile('./treated/circ-treated.csv', (record) => {
    const cas = record[1].trim();
    const standard = record[2] ? record[2].trim() : '';
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas === cas) {
        matter.value.circ = standard;
      }
    }
  });

  const compiledCsv = [];
  compiledCsv.push(['Name', 'CAS', 'NCS', 'Forbidden in EU?', 'EU Type Restriction', 'EU Maximum', 'EU Other', 'EU Comments','CMR', 'CIRC']);
  allMatters.forEach((matter) => {
    compiledCsv.push([matter.name, matter.cas, matter.ncs, matter.forbiddenInEU, matter.euTypeRestriction, matter.euMaximum, matter.euOther, matter.euComments,matter.cmr,matter.circ]);
  });

  stringify(compiledCsv, {
    delimiter: ','
  }, (err, output) => {
    if (err) {
      console.error(err);
    } else {
      fs.writeFile('./compiled.csv', output, 'utf8');
    }
  });
}

main();

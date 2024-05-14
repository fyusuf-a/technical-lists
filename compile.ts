import { processFile, CAS } from './utils';
import { promises as fs } from 'fs';
import { stringify } from 'csv-stringify';

type Matter = {
  cas?: CAS;
  name: string;
  ncs?: string;
  forbiddenInEU?: string;
  euTypeRestriction?: string;
  euMaximum?: string;
  euOther?: string;
  euComments?: string;
  euEndocrinianDisruptor?: string;
  deductEndocrinianDisruptor?: string;
  euCorapConcern?: string;
  euClpClassification?: string;
  cmr?: string;
  circ?: string;
  ifraRestriction?: string;
  ifraAmendment?: string;
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
    const matter: Matter = { cas: new CAS(cas), name: name.trim() };
    if (ncs.trim() !== '') {
      matter.ncs = ncs.trim();
    }
    allMatters.add(matter);
  });

  await processFile('./treated/restricted-ifra-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const [name,, type, amendment] = record;
    const iterator = allMatters.values();
    let found = false;
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        found = true;
        matter.value.ifraRestriction = type;
        matter.value.ifraAmendment = amendment;
      }
    }
    if (!found) {
      const newMatter: Matter = { cas, name, ifraRestriction: type, ifraAmendment: amendment };
      allMatters.add(newMatter);
    }
  });

  await processFile('./treated/forbidden-eu-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.forbiddenInEU = 'yes';
      }
    }
  });

  await processFile('./treated/restricted-eu-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euTypeRestriction = appendIfNotUndefined(record[2], matter.value.euTypeRestriction);
        matter.value.euMaximum = appendIfNotUndefined(record[3], matter.value.euMaximum);
        matter.value.euOther = appendIfNotUndefined(record[4], matter.value.euOther);
        matter.value.euComments = appendIfNotUndefined(record[5], matter.value.euComments);
      }
    }
  });

  await processFile('./treated/cmr-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.cmr = 'yes';
      }
    }
  });

  await processFile('./treated/circ-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const standard = record[2] ? record[2].trim() : '';
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.circ = standard;
      }
    }
  });

  await processFile('./treated/endocrinian-disruptor-eu-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euEndocrinianDisruptor = 'yes';
      }
    }
  });

  for (let i = 2; i <= 4; i++) {
  await processFile(`./treated/endocrinian-disruptor-eu-${i}-treated.csv`, (record) => {
    // console.log(record[1]);
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas) && matter.value.euEndocrinianDisruptor !== 'yes') {
        matter.value.euEndocrinianDisruptor = 'yes';
      }
    }
  });
  }

  await processFile('./treated/endocrinian-disruptor-deduct-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas) && matter.value.euEndocrinianDisruptor !== 'yes') {
        matter.value.deductEndocrinianDisruptor = 'yes';
      }
    }
  });

  await processFile('./treated/corap-treated.csv', (record) => {
    if (record[3].trim() === 'Concluded' || record[3].trim() === 'Withdrawn') {
      return;
    }
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euCorapConcern = record[2];
      }
    }
  });

  await processFile('./treated/clp-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euClpClassification = record[2];
      }
    }
  });

  const compiledCsv = [];
  compiledCsv.push([
    'Name',
    'CAS',
    'NCS',
    'Forbidden in EU?',
    'EU Type Restriction',
    'EU Maximum',
    'EU Other',
    'EU Comments','CMR',
    'CIRC',
    'EU Endocrinian disruptor',
    'Deduct Endocrinian disruptor',
    'EU CoRAP',
    'EU CLP Classification',
    'IFRA Restriction',
    'IFRA Amendment'
  ]);
  allMatters.forEach((matter) => {
    compiledCsv.push([
      matter.name,
      matter.cas ? matter.cas.toString() : '',
      matter.ncs,
      matter.forbiddenInEU,
      matter.euTypeRestriction,
      matter.euMaximum,
      matter.euOther,
      matter.euComments,matter.cmr,matter.circ,
      matter.euEndocrinianDisruptor,
      matter.deductEndocrinianDisruptor,
      matter.euCorapConcern,
      matter.euClpClassification,
      matter.ifraRestriction,
      matter.ifraAmendment
    ]);
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

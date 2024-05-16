import {
  processFile,
  CAS,
  Matter,
  addName,
  shouldBeIncluded,
  isPE,
  isCMR,
  appendIfNotUndefined
} from './utils';
import { promises as fs } from 'fs';
import { stringify } from 'csv-stringify';


const main = async () => {
  const allMatters: Set<Matter> = new Set();

  // CREATE LIST
  await processFile('./sources/ifra.csv', (record) => {
    const [cas, name, ncs] = record;
    const matter: Matter = {
      cas: new CAS(cas),
      name: name.trim(),
      otherNames: [],
      forbiddenInEU: false,
      euEndocrinianDisruptor: false,
      deductEndocrinianDisruptor: false,
      cmr: false,
      reachIntentionConcern: '',
    };
    if (ncs.trim() !== '') {
      matter.ncs = ncs.trim();
    }
    allMatters.add(matter);
  });

  // COSMETIC REGULATION
  await processFile('./treated/eu-annex-ii-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.forbiddenInEU = true;
      }
    }
  });

  await processFile('./treated/eu-annex-iii-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euTypeRestriction = appendIfNotUndefined(record[2], matter.value.euTypeRestriction);
      }
    }
  });

  await processFile('./treated/clp-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const name = record[0].trim();
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euClpClassification = record[2];
        addName(name, matter.value);
      }
    }
  });


  await processFile('./treated/circ-treated.csv', (record) => {
    const cas = new CAS(record[1]);
    const name = record[0].trim();
    const standard = record[2] ? record[2].trim() : '';
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas) && standard !== '') {
        matter.value.circ = standard;
        addName(name, matter.value);
      }
    }
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
        addName(name, matter.value);
      }
    }
    if (!found) {
      const newMatter: Matter = {
        cas,
        name,
        otherNames: [],
        ifraRestriction: type,
        ifraAmendment: amendment,
        forbiddenInEU: false,
        euEndocrinianDisruptor: false,
        deductEndocrinianDisruptor: false,
        cmr: false,
        reachIntentionConcern: '',
      };
      allMatters.add(newMatter);
    }
  });


  await processFile('./treated/endocrinian-disruptor-eu-treated.csv', (record) => {
    if (record[2].match(/development|inconclusive|ED HH|postponed/i) === null) {
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
        matter.value.euEndocrinianDisruptor = true;
      }
    }
  });

  for (let i = 2; i <= 4; i++) {
  await processFile(`./treated/endocrinian-disruptor-eu-${i}-treated.csv`, (record) => {
    const cas = new CAS(record[1]);
    const healthEffect = record[2];
    if (healthEffect !== 'Yes') {
      return;
    }
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euEndocrinianDisruptor = true;
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
      if (matter.value.cas?.equals(cas)) {
        matter.value.deductEndocrinianDisruptor = true;
      }
    }
  });

  // REACH
  await processFile('./treated/reach-corap-treated.csv', (record) => {
    if (record[3]?.match(/concluded|withdrawn/i) !== null) {
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

  await processFile('./treated/reach-svhc-intentions-until-outcome-treated.csv', (record) => {
    if (record[3].match(/not identified|withdrawn/i) !== null) {
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
          matter.value.reachIntentionConcern = record[2];
      }
    }
  });

  const compiledCsv = [];
  compiledCsv.push([
    'Name',
    'Other names',
    'CAS',
    'NCS',
    'CMR',
    'PE',
  ]);
  allMatters.forEach((matter) => {
    const matterIsCMR = isCMR(matter);
    const matterIsPE = isPE(matter);
    if (
      shouldBeIncluded(matter)
      && (matterIsCMR || matterIsPE)
    ) {
      compiledCsv.push([
        matter.name,
        matter.otherNames.join(' / '),
        matter.cas ? matter.cas.toString() : '',
        matter.ncs,
        matterIsCMR ? 'yes' : '',
        matterIsPE ? 'yes' : '',
      ]);
    }
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

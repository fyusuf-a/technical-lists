import { processFile, CAS } from './utils';
import { promises as fs } from 'fs';
import { stringify } from 'csv-stringify';
import { distance } from 'fastest-levenshtein';

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

const addName = (newName: string, matter: Matter) => {
  if (isNameNew(newName, matter)) {
    if (newName.length < matter.name.length) {
      matter.otherNames.push(matter.name);
      matter.name = newName;
    } else {
      matter.otherNames.push(newName);
    }
  }
}

type Matter = {
  cas?: CAS;
  name: string;
  otherNames: string[];
  ncs?: string;
  forbiddenInEU: boolean;
  euTypeRestriction?: string;
  euMaximum?: string;
  euOther?: string;
  euComments?: string;
  euEndocrinianDisruptor: boolean;
  deductEndocrinianDisruptor: boolean;
  euCorapConcern?: string;
  euClpClassification?: string;
  reachIntentionConcern: string;
  cmr: boolean;
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

  // FORBIDDEN IN EU
  await processFile('./treated/forbidden-eu-treated.csv', (record) => {
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

  await processFile('./treated/cmr-treated.csv', (record) => { const cas = new CAS(record[1]);
    const iterator = allMatters.values();
    while (true) {
      const matter = iterator.next();
      if (matter.done) {
        break;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.cmr = true;
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

  await processFile('./treated/endocrinian-disruptor-eu-treated.csv', (record) => {
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
      if (record[3]?.match(/Concluded|Withdrawn/) !== null) {
        continue;
      }
      if (matter.value.cas?.equals(cas)) {
        matter.value.euCorapConcern = record[2];
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
  // ALL MATTERS
  // compiledCsv.push([
  //   'Name',
  //   'CAS',
  //   'NCS',
  //   'Forbidden in EU?',
  //   'EU Type Restriction',
  //   'EU Maximum',
  //   'EU Other',
  //   'EU Comments','CMR',
  //   'CIRC',
  //   'EU Endocrinian disruptor',
  //   'Deduct Endocrinian disruptor',
  //   'EU CoRAP',
  //   'EU CLP Classification',
  //   'IFRA Restriction',
  //   'IFRA Amendment'
  // ]);
  // allMatters.forEach((matter) => {
  //   compiledCsv.push([
  //     matter.name,
  //     matter.cas ? matter.cas.toString() : '',
  //     matter.ncs,
  //     matter.forbiddenInEU ? 'yes' : '',
  //     matter.euTypeRestriction,
  //     matter.euMaximum,
  //     matter.euOther,
  //     matter.euComments,
  //     matter.cmr ? 'yes' : '',
  //     matter.circ,
  //     matter.euEndocrinianDisruptor ? 'yes' : '',
  //     matter.deductEndocrinianDisruptor ? 'yes' : '',
  //     matter.euCorapConcern,
  //     matter.euClpClassification,
  //     matter.ifraRestriction,
  //     matter.ifraAmendment
  //   ]);
  // });

  compiledCsv.push([
    'Name',
    'Other names',
    'CAS',
    'NCS',
    'CMR',
    'PE',
  ]);

  const CMR_REGEX = /carcinogenic|mutagenic|reprot|reprod|CMR/i;

  allMatters.forEach((matter) => {
    const isCMR =
      (matter.euClpClassification && matter.euClpClassification?.match(CMR_REGEX) !== null)
      || (matter.euCorapConcern && matter.euCorapConcern?.match(CMR_REGEX) !== null)
      || (matter.circ && matter.circ?.match(/1|2A|2B|3/) !== null)
      || matter.cmr;

    const isPE = matter.euEndocrinianDisruptor
     || matter.deductEndocrinianDisruptor
     || (matter.euCorapConcern && matter.euCorapConcern?.match(/endocrin/i) !== null)
     || matter.reachIntentionConcern.match(/endocrin/i) !== null;

    if (!matter.forbiddenInEU
        && (!matter.euTypeRestriction || matter.euTypeRestriction.match("Autres produits|Produits sans rin(c|ç)age|Tous (les )?produits cosmétiques|Compositions parfumantes|Parfums fins") !== null)
        && matter.euTypeRestriction !== 'P'
        && matter?.ifraRestriction !== 'P'
        && !matter.cas?.equals(new CAS('64-17-5')) // remove ethanol

        && (isCMR|| isPE)
    ) {
      compiledCsv.push([
        matter.name,
        matter.otherNames.join(' / '),
        matter.cas ? matter.cas.toString() : '',
        matter.ncs,
        isCMR ? 'yes' : '',
        isPE ? 'yes' : '',
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

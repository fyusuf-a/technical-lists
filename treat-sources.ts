import {promises as fs} from 'fs';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { checkCAS, checkEC, removeBrackets } from './utils';
import { finished } from 'stream/promises';

const unidentifiedSubstances: string[] = [];

const isEchaCasEmpty = (cas: string) => {
  return cas === '' || cas === '-';
}

const treatEchaCas = (cas: string) => {
  return cas
    .trim()
    .split('\n').flatMap((cas) => cas.split('/'))
    .flatMap((cas) => cas.split(';'))
    .flatMap((cas) => cas.split(','))
    .flatMap((cas) => cas.split('/r'))
    .map(removeBrackets)
    .map((cas) => cas.replace(/ /g, ''))
    .map((cas) => cas.replace(/\([a-zA-Z]+\)/g, ''));
}

const treatCircCas = (cas: string) => {
  return cas
    .split('\n')
    .flatMap((cas) => cas.split('/'))
    .flatMap((cas) => cas.split(','))
    .flatMap((cas) => cas.split('/r'))
    .map(removeBrackets)
    .map((cas) => cas.replace(/ /g, ''))
    .map((cas) => cas.replace(/\([a-zA-Z]+\)/g, ''))
    .filter((cas) => cas !== '');
}

const treatEdListCas = (cas: string) => {
  return cas
    .replace(/^-$/, '')
    .split(',')
    .flatMap((cas) => cas.trim());
}

const treatRestrictedIfraCas = (cas: string) => {
  return cas
    .replace(/e.g.: /, '')
    .replace(/\(mixed isomers\)/, '')
    .replace(/Restriction and Specification of.*?: /g, '')
    .replace(/(Prohibition|Specification) of.*?: /g, '')
    .replace('Not applicable.', '')
    .split(' ')
    .flatMap((cas) => cas.split('/'))
    .flatMap((cas) => cas.split(','))
    .flatMap((cas) => cas.split('/r'))
    .map(removeBrackets)
    .map((cas) => cas.replace(/\([a-zA-Z]+\)/g, ''))
    .filter((cas) => cas !== '');
}

export const treatCorapCas = (cas: string) => {
  return [cas.replace(/^-/, '')];
}


type TreatOptions = {
  delimiter?: string,
  fromLine?: number,
  ecIndex?: number,
  hideErrors?: boolean
  treatEc?: (ec: string) => string[]
  addToUnidentifiedSubstances?: boolean
  isEcEmpty?: (ec: string) => boolean
}

let nonEmptyName: string = '';
let nonEmptyCas: string = '';
const treatDirtyCSV = async (
  filepath: string,
  nameIndex: number,
  casIndex: number,
  headers: string[],
  orderRecord: (nonEmptyName: string, newCas: string, record: string[], newEc: string) => (string[]),
  treatCas: (cas:string) => string[],
  isCasEmpty: (cas: string) => boolean = (cas) => cas === '',
  options: TreatOptions = {}
) => {
  const delimiter = options.delimiter ?? ',';
  const fromLine = options.fromLine ?? 2;
  const ecIndex = options.ecIndex;
  const hideErrors = options.hideErrors ?? false;
  const treatEc = options.treatEc;
  const addToUnidentifiedSubstances = options.addToUnidentifiedSubstances ?? true;
  const isEcEmpty = options.isEcEmpty ?? ((ec) => ec === '');

  const content = await fs.readFile(filepath, 'utf8');
  const records = parse(content, {
    delimiter,
    from_line: fromLine,
    bom: true
  });

  let treatedCsv: string[][] = [];
  treatedCsv.push(headers);

  records.on('data', (record) => {
    // nonEmptyName = record[nameIndex] ? record[nameIndex] : nonEmptyName;
    // const cas = record[casIndex] ? record[casIndex] : nonEmptyCas;
    // nonEmptyCas = cas;
    const nonEmptyName = record[nameIndex];
    const cas = record[casIndex];
    const casIsEmpty = isCasEmpty(cas);

    let unlinedEc: string[] = [];
    let ec: string = '';
    let ecIsEmpty = true;
    if (ecIndex) {
      ec = record[ecIndex];
      if (!isEcEmpty!(ec)) {
        ecIsEmpty = false;
      }
      unlinedEc = treatEc ? treatEc(ec!) : treatCas(ec!);
    } else {
      unlinedEc = [''];
    }

    if (casIsEmpty && ecIsEmpty) {
      if (addToUnidentifiedSubstances) {
        unidentifiedSubstances.push(nonEmptyName);
      }
      return;
    }
      
    const unlinedCas = treatCas(cas);
    unlinedCas.forEach((newCas: string) => {
      const checkCasResult = checkCAS(newCas);
      const newCasIsEmpty = isCasEmpty(newCas);
      if (checkCasResult !== true && !newCasIsEmpty) {
        console.error('Problem with CAS: ', record);
      }
      unlinedEc.forEach((newEc: string) => {
        let newEcIsEmpty = true;
        let checkEcResult = true as string | true;
        if (ecIndex) {
          if (!isEcEmpty!(newEc)) {
            newEcIsEmpty = false;
          }
          checkEcResult = checkEC(newEc);
        }
        if (checkEcResult !== true && !newEcIsEmpty) {
          console.error('Problem with EC: ', record);
        }
        treatedCsv.push(orderRecord(nonEmptyName, newCasIsEmpty ? '' : newCas, record, newEcIsEmpty ? '' : newEc));
      });
    });
  });

  records.on('end', () => {
    console.info(`${filepath} successfully processed`);
    stringify(treatedCsv, {
      delimiter: ','
    }, async(err, output) => {
      if (err) {
        console.error(err);
      } else {
        const filename = filepath.split('/').slice(-1)[0];
        const filenameWithoutExtension = filename.split('.').slice(0, -1).join('.');
        await fs.writeFile('./treated/' + filenameWithoutExtension + '-treated.csv', output, 'utf8');
      }
    });
  });
  await finished(records);
}

const main = async () => {
  await treatDirtyCSV('./sources/eu-annex-ii.csv', 0, 2, ['Name', 'CAS', 'EC'], (name, newCas, _, newEc) => {
    return [name, newCas, newEc];
  }, treatEchaCas, isEchaCasEmpty, {
    delimiter: '\t',
    fromLine: 12,
    ecIndex: 1,
    isEcEmpty: isEchaCasEmpty,
    addToUnidentifiedSubstances: false
  });

  // CLP
  await treatDirtyCSV('./sources/clp.csv', 1, 3, ['Name', 'CAS', 'Classification', 'EC'], (name, newCas, record, newEc) => {
    return [name, newCas, record[4], newEc];
  }, treatEchaCas, isEchaCasEmpty, {
    fromLine: 9,
    ecIndex: 2,
    isEcEmpty: isEchaCasEmpty,
    treatEc: (ec: string) => treatEchaCas(ec).flatMap((ec) => ec.replace(/^_$|^—$/, ''))
  }); 

  await treatDirtyCSV('./sources/circ.csv', 1, 0, ['Name', 'CAS', 'Standard'], (name, newCas, record) => {
    // TODO
    if (!['1', '2A', '2B', '3', ''].includes(record[2])) {
      console.error(`Invalid CIRC standard ${record[2]} for ${name}`);
    }
    return [name, newCas, record[2]];
  }, treatCircCas);

  await treatDirtyCSV('./sources/restricted-ifra.csv', 1, 0, ['Name', 'CAS', 'Type', 'Amendment'], (name, newCas, record) => {
    return [name, newCas, record[2],record[4]];
  }, treatRestrictedIfraCas, (cas) => cas === '',
    {
      addToUnidentifiedSubstances: false
    });

  // REACH
  await treatDirtyCSV('./sources/reach-corap.csv', 0, 3, ['Name', 'CAS', 'Concern', 'Status', 'EC'], (name, newCas, record, newEc) => {
    return [name, newCas, record[7], record[8], newEc];
  }, treatEchaCas, isEchaCasEmpty, {
    delimiter: '\t',
    fromLine: 15,
    ecIndex: 2,
    isEcEmpty: isEchaCasEmpty,
  });
  await treatDirtyCSV('./sources/reach-svhc-intentions-until-outcome.csv', 0, 3, ['Name', 'CAS', 'Concern', 'Status', 'EC'], (name, newCas, record, newEc) => {
    return [name, newCas, record[13], record[6], newEc];
  }, treatEchaCas, isEchaCasEmpty, {
    delimiter: '\t',
    fromLine: 27,
    ecIndex: 2,
    isEcEmpty: isEchaCasEmpty,
  });

  // ED
  await treatDirtyCSV('./sources/endocrinian-disruptor-eu.csv', 0, 3, ['Name', 'CAS', 'Conclusion', 'EC'], (name, newCas, record, newEc) => {
    return [name, newCas, record[6], newEc];
  }, treatEchaCas, isEchaCasEmpty, {
    delimiter: '\t',
    fromLine: 20,
    ecIndex: 2,
    isEcEmpty: isEchaCasEmpty,
  });

  for (let i = 2; i <= 4; i++) {
    await treatDirtyCSV(`./sources/endocrinian-disruptor-eu-${i}.csv`, 0, 1, ['Name', 'CAS', 'Health effect', 'Environmental effect', 'EC'], (name, newCas, record, newEc) => {
      return [name, newCas, record[3], record[4], newEc];
    }, treatEdListCas, (cas) => cas === '', {
      delimiter: ',',
      fromLine: 2,
      ecIndex: 2,
    });
  }
  await treatDirtyCSV('./sources/endocrinian-disruptor-deduct.csv', 3, 1, ['Name', 'CAS'], (name, newCas) => {
    return [name, newCas];
  }, (cas) => [cas]);

  // Autoclassified
  await treatDirtyCSV('./sources/afdm.csv', 1, 4, ['Name', 'CAS'], (name, newCas) => {
    return [name, newCas];
  }, (cas) => [cas]);
  
  console.log(unidentifiedSubstances);
}

main();

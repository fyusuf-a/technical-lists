import {promises as fs} from 'fs';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { checkCAS, removeBrackets } from './utils';
import { finished } from 'stream/promises';

export const treatEuClpCas = (cas: string) => {
  return cas
    .trim()
    .replace(/^-$/, '')
    .split('\n').flatMap((cas) => cas.split('/'))
    .flatMap((cas) => cas.split(';'))
    .flatMap((cas) => cas.split('/r'))
    .map(removeBrackets)
    .map((cas) => cas.replace(/ /g, ''))
    .map((cas) => cas.replace(/\([a-zA-Z]+\)/g, ''))
    .filter((cas) => cas !== '');
}

export const treatEuCas = (cas: string) => {
  return cas
    .split('\n').flatMap((cas) => cas.split('/'))
    .flatMap((cas) => cas.split('/r'))
    .map(removeBrackets)
    .map((cas) => cas.replace(/ /g, ''))
    .map((cas) => cas.replace(/\([a-zA-Z]+\)/g, ''))
    .filter((cas) => cas !== '');
}

export const treatCmrCas = (cas: string) => {
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

export const treatEdListCas = (cas: string) => {
  return cas
    .replace(/^-$/, '')
    .split(',')
    .flatMap((cas) => cas.trim());
}

export const treatRestrictedIfraCas = (cas: string) => {
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

let nonEmptyName: string = '';
let nonEmptyCas: string = '';
const treatDirtyCSV = async (
  filepath: string,
  nameIndex: number,
  casIndex: number, headers: string[],
  orderRecord: (nonEmptyName: string, newCas: string, record: string[]) => (string[]),
  treatCas: (cas:string) => string[],
  delimiter: string = ',',
  fromLine: number = 2
) => {
  const content = await fs.readFile(filepath, 'utf8');
  const records = parse(content, {
    delimiter,
    from_line: fromLine,
    bom: true
  });

  let treatedCsv: string[][] = [];
  treatedCsv.push(headers);

  records.on('data', (record) => {
    nonEmptyName = record[nameIndex] ? record[nameIndex] : nonEmptyName;
    const cas = record[casIndex] ? record[casIndex] : nonEmptyCas;
    nonEmptyCas = cas;
    const unlinedCas = treatCas(cas);
      
    unlinedCas.forEach((newCas: string) => {
      const checkCasResult = checkCAS(newCas);
      if (checkCasResult !== true) {
        console.error(checkCasResult);
      } else {
        treatedCsv.push(orderRecord(nonEmptyName, newCas, record));
      }
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
  await treatDirtyCSV('./sources/forbidden-eu.csv', 0, 1, ['Name', 'CAS'], (name, newCas) => {
    return [name, newCas];
  }, treatEuCas);
  await treatDirtyCSV('./sources/restricted-eu.csv', 0, 2, ['Name', 'CAS', 'Type', 'Maximum', 'Other', 'Dangers'], (name, newCas, record) => {
    return [name, newCas, record[4], record[5], record[6], record[7]];
  }, treatEuCas);
  await treatDirtyCSV('./sources/cmr.csv', 0, 2, ['Name', 'CAS'], (name, newCas) => {
    return [name, newCas];
  }, treatCmrCas);
  await treatDirtyCSV('./sources/circ.csv', 1, 0, ['Name', 'CAS', 'Standard'], (name, newCas, record) => {
    if (!['1', '2A', '2B', '3', ''].includes(record[2])) {
      console.error(`Invalid CIRC standard ${record[2]} for ${name}`);
    }
    return [name, newCas, record[2]];
  }, treatCmrCas);
  await treatDirtyCSV('./sources/restricted-ifra.csv', 1, 0, ['Name', 'CAS', 'Type', 'Amendment'], (name, newCas, record) => {
    return [name, newCas, record[2],record[4]];
  }, treatRestrictedIfraCas);

  // REACH
  await treatDirtyCSV('./sources/reach-corap.csv', 0, 3, ['Name', 'CAS', 'Concern', 'Status'], (name, newCas, record) => {
    return [name, newCas, record[7], record[8]];
  }, treatCorapCas, '\t', 15);
  await treatDirtyCSV('./sources/reach-svhc-intentions-until-outcome.csv', 0, 3, ['Name', 'CAS', 'Concern', 'Status'], (name, newCas, record) => {
    return [name, newCas, record[13], record[6]];
  }, treatCorapCas, '\t', 27);

  // ED
  await treatDirtyCSV('./sources/endocrinian-disruptor-eu.csv', 0, 3, ['Name', 'CAS'], (name, newCas) => {
    return [name, newCas];
  }, treatCorapCas, '\t', 20);
  for (let i = 2; i <= 4; i++) {
    await treatDirtyCSV(`./sources/endocrinian-disruptor-eu-${i}.csv`, 0, 1, ['Name', 'CAS'], (name, newCas) => {
      return [name, newCas];
    }, treatEdListCas);
  }
  await treatDirtyCSV('./sources/endocrinian-disruptor-deduct.csv', 3, 1, ['Name', 'CAS'], (name, newCas) => {
    return [name, newCas];
  }, treatCorapCas, ',');

  // CLP
  await treatDirtyCSV('./sources/clp.csv', 1, 3, ['Name', 'CAS', 'Classification'], (name, newCas, record) => {
    return [name, newCas, record[4]];
  }, treatEuClpCas, ',', 9);
}

main();

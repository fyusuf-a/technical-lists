import {promises as fs} from 'fs';
import { parse } from 'csv-parse';

const main = async() => {
  const content = await fs.readFile('./sources/ifra.csv', 'utf8');
  // Parse the CSV content
  const records = parse(content, {
    delimiter: ',',
    from_line: 2,
    bom: true
  });

  const casPattern = /^\d{2,7}-\d{2}-\d{1,2}$/;

  records.on('data', (record) => {
    const cas = record[0];
    if (!casPattern.test(cas)) {
      console.log(record);
      console.error(`CAS number '${cas}' is malformed`);
    }
  });
}

main()

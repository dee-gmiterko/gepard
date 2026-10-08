import yauzl from 'yauzl';

export type ZipEntry = yauzl.Entry;

function openZip(file: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, zip) => (err ? reject(err) : resolve(zip)));
  });
}

function entryStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => (err ? reject(err) : resolve(stream)));
  });
}

// Entries are visited one at a time; a rejected visit aborts the walk.
export async function forEachZipEntry(
  archive: string,
  visit: (entry: ZipEntry, open: () => Promise<NodeJS.ReadableStream>) => Promise<void>,
): Promise<void> {
  const zip = await openZip(archive);
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry: yauzl.Entry) => {
        void visit(entry, () => entryStream(zip, entry)).then(() => zip.readEntry(), reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

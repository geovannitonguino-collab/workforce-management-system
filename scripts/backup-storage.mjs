// Downloads every object of the private `medical-proofs` bucket into a directory.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.mjs <outDir>
// The service-role key is read from the environment only and is never printed.
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const outDir = process.argv[2];
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !outDir) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or output directory');
  process.exit(2);
}
const BUCKET = 'medical-proofs';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function listAll(prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw error;
    if (!data.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listAll(full))); // folder
      else files.push(full);
    }
    if (data.length < 100) break;
  }
  return files;
}

const files = await listAll();
let bytes = 0;
for (const f of files) {
  const { data, error } = await supabase.storage.from(BUCKET).download(f);
  if (error) throw error;
  const buf = Buffer.from(await data.arrayBuffer());
  const dest = path.join(outDir, f);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  bytes += buf.length;
}
console.log(`Backed up ${files.length} file(s), ${bytes} bytes`);

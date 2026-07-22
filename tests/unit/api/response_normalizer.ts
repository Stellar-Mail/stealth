export function normalizeResponse(response: any) {
  // Remove or replace dynamic fields that can change between runs
  const cloned = JSON.parse(JSON.stringify(response));
  if (cloned.headers && cloned.headers['date']) {
    cloned.headers['date'] = '<DATE>';
  }
  if (cloned.body) {
    // Replace timestamps, ids, hashes etc.
    const replaceDynamic = (obj: any) => {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string') {
          // ISO date format
          if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(val)) {
            obj[key] = '<TIMESTAMP>';
          }
          // 64‑char hex strings (e.g., ids, hashes)
          if (/^[a-f0-9]{64}$/.test(val)) {
            obj[key] = '<HASH>';
          }
        } else if (typeof val === 'object' && val !== null) {
          replaceDynamic(val);
        }
      }
    };
    replaceDynamic(cloned.body);
  }
  return cloned;
}

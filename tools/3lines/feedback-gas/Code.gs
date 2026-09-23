const SCHEMA_VERSION = '1';
const DAILY_CAP = 5000;
const HEADERS = [
  'schema_version', 'server_timestamp', 'event_id', 'rating', 'style', 'bad_reason',
  'app_version', 'engine', 'model_id', 'latency_bucket',
];

function doGet() {
  return json({ ok: true, service: '3lines-feedback', schema_version: SCHEMA_VERSION });
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const body = JSON.parse(event?.postData?.contents || '{}');
    const payload = sanitize(body);
    if (!payload) return json({ ok: false, error: 'invalid_payload' });
    const props = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd');
    const key = `accepted:${day}`;
    const count = Number(props.getProperty(key) || 0);
    if (count >= DAILY_CAP) return json({ ok: false, error: 'daily_cap' });
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    ensureHeaders(sheet);
    sheet.appendRow(HEADERS.map((header) => header === 'server_timestamp' ? new Date() : payload[header]));
    props.setProperty(key, String(count + 1));
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}

function sanitize(body) {
  const allowed = {
    schema_version: String(body.schema_version || ''),
    event_id: String(body.event_id || '').slice(0, 80),
    rating: String(body.rating || ''),
    style: String(body.style || ''),
    bad_reason: String(body.bad_reason || 'empty'),
    app_version: String(body.app_version || '').slice(0, 40),
    engine: String(body.engine || ''),
    model_id: String(body.model_id || '').slice(0, 120),
    latency_bucket: String(body.latency_bucket || ''),
  };
  const ratings = ['good', 'bad'];
  const styles = ['gist', 'points', 'easy', 'faithful'];
  const reasons = ['wrong', 'missing', 'unclear', 'too_short', 'other', 'empty'];
  const engines = ['local-qwen', 'extractive-fallback'];
  const buckets = ['<1s', '1-5s', '5-15s', '15-30s', '>=30s'];
  if (allowed.schema_version !== SCHEMA_VERSION || !allowed.event_id || !ratings.includes(allowed.rating) || !styles.includes(allowed.style)) return null;
  if (!reasons.includes(allowed.bad_reason) || !engines.includes(allowed.engine) || !buckets.includes(allowed.latency_bucket)) return null;
  if (allowed.engine === 'extractive-fallback') allowed.model_id = '';
  return allowed;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

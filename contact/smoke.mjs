import fs from 'node:fs';

let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`FAIL: ${message}`);
};

const required = [
  'contact/index.html',
  'contact/thanks/index.html',
  'privacy/index.html',
  'assets/js/contact.js'
];

for (const file of required) {
  if (!fs.existsSync(file)) fail(`missing ${file}`);
}

if (!failed) {
  const contact = fs.readFileSync('contact/index.html', 'utf8');
  const script = fs.readFileSync('assets/js/contact.js', 'utf8');
  const privacy = fs.readFileSync('privacy/index.html', 'utf8');

  if (!contact.includes("form-action https://formsubmit.co")) fail('contact CSP must restrict form submissions to FormSubmit');
  if (!contact.includes('name="_honey"')) fail('contact form must keep the honeypot field');
  if (!contact.includes('type="email"')) fail('contact form must validate reply email addresses');
  if (!contact.includes('maxlength="5000"')) fail('contact message must keep a length limit');
  if (!contact.includes('../privacy/')) fail('contact form must link to the privacy notice');
  if (contact.includes('type="file"')) fail('contact form must not accept file uploads');
  if (/@naojun\.jp/i.test(contact) || /@naojun\.jp/i.test(script)) fail('NaoJun recipient address must not be exposed as plaintext');
  if (!script.includes('https://formsubmit.co/')) fail('contact submission handler must target FormSubmit');
  if (!privacy.includes('FormSubmit')) fail('privacy notice must disclose the form processor');
}

if (failed) process.exit(1);
console.log('Contact form smoke checks passed.');

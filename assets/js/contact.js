(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const recipientCodes = [104, 101, 108, 108, 111, 64, 110, 97, 111, 106, 117, 110, 46, 106, 112];

  form.addEventListener('submit', (event) => {
    if (form.dataset.submitting === 'true') {
      event.preventDefault();
      return;
    }

    const recipient = String.fromCharCode(...recipientCodes);
    form.action = `https://formsubmit.co/${recipient}`;
    form.dataset.submitting = 'true';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = '送信中…';
    }
  });
})();

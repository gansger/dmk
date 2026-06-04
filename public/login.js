const form = document.querySelector('#loginForm');
const status = document.querySelector('#loginStatus');
const next = new URLSearchParams(window.location.search).get('next');

function destination() {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/admin';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = '';

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.querySelector('#loginUsername').value,
      password: document.querySelector('#loginPassword').value
    })
  });
  const payload = await response.json();

  if (!response.ok) {
    status.textContent = payload.error || 'Не удалось войти.';
    return;
  }

  window.location.href = destination();
});

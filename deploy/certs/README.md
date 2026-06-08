# TLS certificates

Place the production TLS certificate files in this directory before starting Nginx:

- `fullchain.pem`
- `privkey.pem`

For Let's Encrypt, copy or symlink the matching files from `/etc/letsencrypt/live/<domain>/`.

Private certificate files are excluded from Git and the Docker build context.

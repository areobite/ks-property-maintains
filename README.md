# K&S Property Maintenance site

This is a small local website with a file-backed customer review system. It uses Node.js built-in modules and has no package dependencies.

## Run locally

From this directory, run:

```sh
node server.js
```

Then open a open private link . Reviews are saved to `reviews.json` in this directory, so they remain available after the server restarts. The complete review list is at open private link .

The server listens on this computer only. To put the site on the public internet, it needs hosting that can run a server and preserve its data file; a static file host alone cannot accept and save reviews.

## Website admin

While the local server is running, open private link and sign in with admin code that is only for aerobite and k&spm to view. The admin page can edit homepage text and contact links, edit or reply to reviews, and replace the six gallery photos with JPG files. Add Facebook, Instagram, or another website URL to show those links in the footer. Changes are saved in `site-content.json`, `reviews.json`, and the existing photo files.

For a server that is reachable from the internet, set a private `KSPM_ADMIN_CODE` environment variable before starting the server. Do not publish the Node server with the default code. GitHub Pages cannot run the admin API or save these changes.

## Free GitHub Pages address

If you create a public GitHub repository named `KSPM` under the `areobite` account and publish the contents of this folder to its `main` branch, enable **Settings → Pages → Deploy from a branch → `main` → `/ (root)`**. GitHub Pages will then serve the static site at:

<https://areobite.github.io/KSPM/>

GitHub Pages does not run `server.js`, so review posting and live review data will only work while using the local server. A true `www.KSPM.com` address requires registering/owning that domain, then adding it as a custom domain in the repository's Pages settings and configuring its DNS.

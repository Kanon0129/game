# Top Three Live

## What it now does
- Real-time room codes and waiting room
- Separate phones/computers can join simultaneously
- Everyone answers at the same time
- Reveal only happens once every active player has submitted
- Main player rotates each round
- Live scoring
- 100 built-in questions
- Host can add, remove, import and export custom cards

## Setup
1. Create a Supabase project.
2. Run `supabase.sql` in Supabase → SQL Editor.
3. Copy the Project URL and anon public key into `config.js`.
4. Upload the folder to Netlify, Vercel, GitHub Pages or Cloudflare Pages.

For local testing:
`python3 -m http.server 8000`

Then open `http://localhost:8000`.

## Security
The supplied database policies are deliberately open for quick private testing. Before a public launch, game-control operations should be moved into authenticated database functions or a server backend.

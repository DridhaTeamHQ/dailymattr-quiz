# dailymattr Quiz (News IQ)

The News IQ quiz page from the dailymattr site, as its own Next.js app: pick a story, answer
its questions, and get your report. It has the same banner, navbar, footer and cookie notice
as the main site.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (add -- -p 3002 to use another port)
npm run build && npm start
```

## Where things are

- `app/quizz/page.tsx`: the story picker ("Pick a story to start").
- `app/quizz/[slug]/page.tsx`: one story's quiz and report.
- `components/quizz/content.ts`: the stories, questions and answers. Edit the quiz here.
- `components/navbar`, `components/footer`, `components/shared`: copied from the main site.

`/` opens the picker. Nav and footer links to other dailymattr pages (News, About, Pix…) go to
the live site, `https://www.dailymattr.com` by default; set `NEXT_PUBLIC_SITE_URL` to change it
(see `next.config.ts`).

Copied from `DridhaTeamHQ/dailymattr-official` (`dailymattr/`). Changes made there are not
picked up here automatically.

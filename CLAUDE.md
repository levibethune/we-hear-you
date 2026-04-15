# We Hear You

Video-to-persona pipeline: VideoAsk → Claude analysis → Supabase.

## Architecture
- **Webflow** — front-end site (managed externally)
- **VideoAsk** — collects video responses with name + email
- **Vercel serverless function** — receives webhook, runs Claude analysis
- **Claude API** — extracts themes, mood, sentiment from transcriptions
- **Supabase** — stores people and their responses

## Data Model
- `people` — one row per person, email as unique key
- `responses` — one row per video submission, linked to person

## Key Decisions
- Email is the primary identifier for people
- VideoAsk built-in transcription (may upgrade later)
- Personas are TBD — classification will be added to the analysis step
- Collect everything: full transcription, themes, mood, sentiment

## Environment Variables
See `.env.example` for required keys.

## Development
```
npm install
vercel dev
```

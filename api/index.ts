// Vercel auto-detects any file under /api as a serverless function.
// This just re-exports the shared Express app — no Vite, no static
// file serving, no app.listen() here. Vercel calls this as a request
// handler directly.
import { app } from "../apiApp";

export default app;

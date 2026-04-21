# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Real-time web search setup (Cloudflare Worker)

This project now sends chat requests through a Cloudflare Worker so the AI can use real-time web search and return source links.

1. Create a Cloudflare Worker and paste in [cloudflare-worker.js](cloudflare-worker.js).
2. In Worker Settings > Variables, add:
   - `OPENAI_API_KEY` = your OpenAI key
   - Optional: `OPENAI_MODEL` = `gpt-4.1`
3. Deploy the Worker.
4. Copy your Worker URL, for example: `https://your-worker-name.your-subdomain.workers.dev`
5. Open [secrets.js](secrets.js) and set:

```js
const WORKER_URL = "https://your-worker-name.your-subdomain.workers.dev";
```

After this, routine generation and follow-up chat will include current web-informed answers and source links when available.

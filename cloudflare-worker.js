export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/chat") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    if (!env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY in worker env" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    try {
      const body = await request.json();
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const webSearch = Boolean(body.webSearch);

      if (messages.length === 0) {
        return new Response(
          JSON.stringify({ error: "messages array is required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      const input = messages.map((message) => ({
        role: message.role,
        content: [
          {
            type: "input_text",
            text: String(message.content || ""),
          },
        ],
      }));

      const openAiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.OPENAI_MODEL || "gpt-4.1",
            input,
            tools: webSearch ? [{ type: "web_search_preview" }] : [],
            tool_choice: webSearch ? "auto" : "none",
          }),
        },
      );

      if (!openAiResponse.ok) {
        const errorText = await openAiResponse.text();
        return new Response(JSON.stringify({ error: errorText }), {
          status: openAiResponse.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      const data = await openAiResponse.json();

      let text = data.output_text || "";
      if (!text && Array.isArray(data.output)) {
        const outputTextParts = [];

        data.output.forEach((item) => {
          if (!Array.isArray(item.content)) {
            return;
          }

          item.content.forEach((contentPart) => {
            if (contentPart.type === "output_text" && contentPart.text) {
              outputTextParts.push(contentPart.text);
            }
          });
        });

        text = outputTextParts.join("\n\n");
      }

      const citationMap = new Map();

      if (Array.isArray(data.output)) {
        data.output.forEach((item) => {
          if (!Array.isArray(item.content)) {
            return;
          }

          item.content.forEach((contentPart) => {
            if (!Array.isArray(contentPart.annotations)) {
              return;
            }

            contentPart.annotations.forEach((annotation) => {
              if (annotation.type === "url_citation" && annotation.url) {
                citationMap.set(annotation.url, {
                  title: annotation.title || annotation.url,
                  url: annotation.url,
                });
              }
            });
          });
        });
      }

      return new Response(
        JSON.stringify({
          text,
          citations: Array.from(citationMap.values()),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: String(error.message || error) }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }
  },
};

// Ask-the-Knowledge-Base chat endpoint.
// Non-streaming for simplicity; returns { reply: string }.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface ChatBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  kb: Array<{ id: string; title: string; category: string; description: string; content: string }>;
  propertyContext?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ChatBody;
    if (!body?.messages?.length) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build compact KB context. Cap size to stay within model limits.
    const kbText = (body.kb ?? [])
      .map(
        (a) =>
          `### [${a.id}] ${a.title} (${a.category})\n${a.description}\n\n${a.content}`
      )
      .join('\n\n---\n\n')
      .slice(0, 120_000);

    const ctxText = body.propertyContext
      ? `\n\nCURRENT PROPERTY CONTEXT (JSON):\n${JSON.stringify(body.propertyContext).slice(0, 6000)}`
      : '';

    const systemPrompt = `You are the Trailblazer Campground PMS knowledge-base assistant.
Answer using ONLY the knowledge-base articles and property context provided below.
- Be concise but complete. Use short headings and bullet points where helpful.
- When you cite an article, put its title in **bold**.
- If the answer is not in the KB, say so and suggest the closest article or the Onboarding Agent step.
- Never invent settings paths, GL account numbers, or table names.
- All answers are for campgrounds only.

KNOWLEDGE BASE:
${kbText}${ctxText}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...body.messages,
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      const status = resp.status === 402 || resp.status === 429 ? resp.status : 500;
      return new Response(JSON.stringify({ error: `AI gateway ${resp.status}: ${text.slice(0, 300)}` }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('kb-chat error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

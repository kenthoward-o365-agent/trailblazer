// Speech-to-text proxy using Lovable AI Gateway (openai/gpt-4o-transcribe).
// Client uploads audio as multipart/form-data field "file"; returns { text }.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return json({ error: 'LOVABLE_API_KEY not configured' }, 500);
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return json({ error: 'file required' }, 400);
    }

    const upstream = new FormData();
    // Preserve filename/type so the model can decode the container.
    const filename = (file as File).name || 'recording.webm';
    upstream.append('file', file, filename);
    upstream.append('model', 'openai/gpt-4o-transcribe');

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });
    if (!resp.ok) {
      const txt = await resp.text();
      const status = resp.status === 429 || resp.status === 402 ? resp.status : 500;
      return json({ error: `Transcription failed ${resp.status}: ${txt.slice(0, 300)}` }, status);
    }
    const data = await resp.json();
    return json({ text: data.text ?? '' });
  } catch (e: any) {
    return json({ error: e?.message || 'Internal error' }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

export const prerender = false;

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_PROMPT = `أنت خبير تربوي ومعلم أول في وزارة التربية والتعليم للثانوية العامة والبكالوريا المصرية. مهمتك هي إنشاء واستخراج أسئلة الاختيار من متعدد (MCQs) التفاعلية من ملف الـ PDF المرفق بدقة علمية وتربوية عالية، مع توليد إجابات دقيقة وشرح وتفسير نموذجي شامل لكل سؤال.

القواعد والضوابط الصارمة:
1. الالتزام التام بالمنهج ومنع الخروج عنه: استخرج واعتمد حصراً على المفاهيم والقوانين والدروس الواردة في ملف الـ PDF المرفوع. يُمنع منعاً باتاً إدخال أسئلة أو مواضيع من مناهج أخرى أو معلومات خارجية خارج حدود هذا الملف.
2. مستوى الأسئلة وجودتها: صغ أسئلة تقيس الفهم والتطبيق والتحليل الشامل للطلاب بناءً على محتوى الملف؛ ابتعد عن البصمجية والنقل الحرفي السطحي، وفي نفس الوقت لا تخرج عن نطاق المادة.
3. التوزيع العشوائي لموقع الإجابة الصحيحة: قم بتوزيع موقع الإجابة الصحيحة (correct_option_index) بشكل عشوائي ومتوازن بين الخيارات الأربعة (0, 1, 2, 3)، ويُمنع منعاً باتاً جعل الإجابة الصحيحة دائماً في الخيار الأول (0).
4. الخيارات الأربعة: لكل سؤال، وفر 4 خيارات واضحة ومتمايزة ومكتوبة بدقة.
5. التفسير والشرح النموذجي: اكتب في حقل explanation شرحاً علمياً تفصيلياً مقنعاً وواضحاً يوضح للطالب خطوات الحل الرياضي أو التعليل العلمي والقاعدة المتبعة وسبب صحة الخيار المختار.
6. الإخراج الإجباري: يجب أن تكون النتيجة حصراً بصيغة JSON المحددة.`;

interface ExtractedQuestion {
  question_number: number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    let base64Data = '';
    let mimeType = 'application/pdf';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return new Response(
          JSON.stringify({ success: false, error: 'يرجى إرفاق ملف PDF صالح (file field).' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      mimeType = file.type || 'application/pdf';
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Data = buffer.toString('base64');
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      base64Data = body.base64_data || '';
      mimeType = body.mime_type || 'application/pdf';

      if (!base64Data) {
        return new Response(
          JSON.stringify({ success: false, error: 'يرجى تقديم بيانات الملف المشفرة بـ base64 (base64_data).' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'نوع المحتوى غير مدعوم. استخدم multipart/form-data أو application/json.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch dynamic AI settings from Supabase
    let modelName = DEFAULT_MODEL;
    let systemPrompt = DEFAULT_PROMPT;
    let geminiApiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY || '';

    if (isSupabaseConfigured) {
      try {
        const { data } = await (supabase.from('system_settings') as any).select('*');
        const settings = data as Array<{ key: string; value: string; description?: string }> | null;
        if (settings && settings.length > 0) {
          const modelRow = settings.find((s) => s.key === 'gemini_model_name');
          const promptRow = settings.find((s) => s.key === 'gemini_exam_prompt');
          const apiKeyRow = settings.find((s) => s.key === 'gemini_api_key');

          if (modelRow?.value) modelName = modelRow.value.trim();
          if (promptRow?.value) systemPrompt = promptRow.value.trim();
          if (apiKeyRow?.value && !geminiApiKey) geminiApiKey = apiKeyRow.value.trim();
        }
      } catch (err) {
        console.warn('Could not load system_settings from Supabase, using defaults:', err);
      }
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'مفتاح Gemini API غير مهيأ (GEMINI_API_KEY). يرجى تعيين المفتاح في متغيرات البيئة أو في إعدادات النظام.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call Google Gemini REST API with Structured JSON Schema
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: 'استخرج جميع أسئلة الاختيار من متعدد من هذا الملف واكتب شرحاً وتفسيراً وافياً للإجابة الصحيحة لكل سؤال بصيغة JSON المحددة.',
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            questions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  question_number: { type: 'INTEGER' },
                  question_text: { type: 'STRING' },
                  options: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                  },
                  correct_option_index: { type: 'INTEGER' },
                  explanation: { type: 'STRING' },
                },
                required: ['question_number', 'question_text', 'options', 'correct_option_index', 'explanation'],
              },
            },
          },
          required: ['questions'],
        },
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);
      let parsedMessage = `خطأ من مزود الذكاء الاصطناعي (${response.status}): ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          parsedMessage = `خطأ Gemini API: ${errorJson.error.message}`;
        }
      } catch {
        // use statusText
      }
      return new Response(JSON.stringify({ success: false, error: parsedMessage }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return new Response(
        JSON.stringify({ success: false, error: 'لم يُرجع الذكاء الاصطناعي أي استجابة نصية للأسئلة.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let parsedResult: { questions: ExtractedQuestion[] };
    try {
      parsedResult = JSON.parse(candidateText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response text as JSON:', candidateText);
      return new Response(
        JSON.stringify({ success: false, error: 'فشل تحليل الاستجابة كبنية JSON صالحة.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(parsedResult.questions)) {
      return new Response(
        JSON.stringify({ success: false, error: 'صيغة الاستجابة غير صحيحة (questions ليست مصفوفة).' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize and ensure format
    const sanitizedQuestions = parsedResult.questions.map((q, idx) => ({
      question_number: typeof q.question_number === 'number' ? q.question_number : idx + 1,
      question_text: String(q.question_text || '').trim(),
      options: Array.isArray(q.options) ? q.options.map((opt) => String(opt).trim()) : [],
      correct_option_index:
        typeof q.correct_option_index === 'number' && q.correct_option_index >= 0 && q.correct_option_index <= 3
          ? q.correct_option_index
          : 0,
      explanation: String(q.explanation || '').trim(),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        model_used: modelName,
        total_questions: sanitizedQuestions.length,
        questions: sanitizedQuestions,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Exception in extract-exam API:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'حدث خطأ غير متوقع في الخادم.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

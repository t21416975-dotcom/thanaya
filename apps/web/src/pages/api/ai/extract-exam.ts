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

// Sliding window rate limiter for extract-exam
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. IP Rate Limiting Check
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'تم تجاوز معدل الطلبات المسموح به. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    // 2. Authentication and Authorization Check
    if (!isSupabaseConfigured) {
      return new Response(
        JSON.stringify({ success: false, error: 'خدمة التحقق من الهوية غير مهيأة على الخادم.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'غير مصرح: يجب تسجيل الدخول كمسؤول لاستخدام هذه الخدمة.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'جلسة تسجيل الدخول غير صالحة أو منتهية الصلاحية.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminRow, error: adminError } = await (supabase.from('admins') as any)
      .select('id')
      .eq('id', userData.user.id)
      .single();

    if (adminError || !adminRow) {
      return new Response(
        JSON.stringify({ success: false, error: 'مرفوض: ليس لديك صلاحية مسؤول للنظام.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let base64Data = '';
    let mimeType = 'application/pdf';

    const contentType = request.headers.get('content-type') || '';

    let reqModelName: string | null = null;
    let reqSystemPrompt: string | null = null;
    let reqQuestionsCount: number | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return new Response(
          JSON.stringify({ success: false, error: 'يرجى إرفاق ملف PDF صالح (file field).' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const promptField = formData.get('system_prompt');
      const modelField = formData.get('model_name');
      const countField = formData.get('questions_count');
      if (typeof promptField === 'string' && promptField.trim()) reqSystemPrompt = promptField.trim();
      if (typeof modelField === 'string' && modelField.trim()) reqModelName = modelField.trim();
      if (countField) {
        const parsed = parseInt(String(countField), 10);
        if (!isNaN(parsed) && parsed > 0) reqQuestionsCount = parsed;
      }

      mimeType = file.type || 'application/pdf';
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Data = buffer.toString('base64');
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      base64Data = body.base64_data || '';
      mimeType = body.mime_type || 'application/pdf';
      if (body.system_prompt) reqSystemPrompt = String(body.system_prompt).trim();
      if (body.model_name) reqModelName = String(body.model_name).trim();
      if (body.questions_count) {
        const parsed = parseInt(String(body.questions_count), 10);
        if (!isNaN(parsed) && parsed > 0) reqQuestionsCount = parsed;
      }

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

    // Dynamic AI settings priority: 1. Request payload -> 2. Supabase system_settings -> 3. Defaults / Env
    let modelName = reqModelName || DEFAULT_MODEL;
    let systemPrompt = reqSystemPrompt || DEFAULT_PROMPT;
    // Security: Only read Gemini API Key from server environment variables
    const geminiApiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY || '';

    if (isSupabaseConfigured && (!reqSystemPrompt || !reqModelName)) {
      try {
        const { data } = await (supabase.from('system_settings') as any).select('*');
        const settings = data as Array<{ key: string; value: string; description?: string }> | null;
        if (settings && settings.length > 0) {
          const modelRow = settings.find((s) => s.key === 'gemini_model_name');
          const promptRow = settings.find((s) => s.key === 'gemini_exam_prompt');

          if (!reqModelName && modelRow?.value) modelName = modelRow.value.trim();
          if (!reqSystemPrompt && promptRow?.value) systemPrompt = promptRow.value.trim();
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('Could not load system_settings from Supabase, using defaults:', err);
        }
      }
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'مفتاح Gemini API غير مهيأ في متغيرات بيئة السيرفر (GEMINI_API_KEY).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (reqQuestionsCount) {
      systemPrompt += `\n\nتنبيه إلزامي ومحدد: العدد الإجمالي للأسئلة في مصفوفة questions يجب أن يكون بالضبط ${reqQuestionsCount} سؤالاً. إذا كان عدد الأسئلة المكتوبة في الملف أقل من ${reqQuestionsCount}، يجب عليك صياغة وتوليد أسئلة جديدة إضافية بنفس نمط البكالوريا ومبنية بالكامل وبدقة على شرح وقوانين ومعلومات الملف حتى يكتمل العدد المطلوب (${reqQuestionsCount} سؤالاً) بدقة متناهية.`;
    }

    const userPromptText = reqQuestionsCount
      ? `المهمة: إنشاء وإخراج بالضبط ${reqQuestionsCount} سؤال اختيار من متعدد (MCQ) متوافقة مع نظام البكالوريا بناءً على هذا الملف:
1. استخرج أولاً كافة الأسئلة الموجودة بالفعل في ملف الـ PDF.
2. إذا كان عدد الأسئلة المكتوبة بالملف أقل من ${reqQuestionsCount} سؤال، قم فوراً بتوليد وصياغة أسئلة جديدة إضافية تغطي كافة موضوعات ودروس ومفاهيم الملف حتى يكتمل العدد المطلوب وهو ${reqQuestionsCount} سؤالاً بالضبط لا أقل ولا أكثر.
3. لكل سؤال: 4 خيارات واضحة، تحديد الإجابة الصحيحة، وشرح تفسيري وافٍ.`
      : 'استخرج كافة أسئلة الاختيار من متعدد من هذا الملف واكتب شرحاً وتفسيراً وافياً للإجابة الصحيحة لكل سؤال بصيغة JSON المحددة.';

    // Call Google Gemini REST API securely using x-goog-api-key header (no key in URL)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;

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
              text: userPromptText,
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
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify(geminiPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (import.meta.env.DEV) {
        console.error('Gemini API error response:', errorText);
      }
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
      if (import.meta.env.DEV) {
        console.error('Failed to parse Gemini response text as JSON:', candidateText);
      }
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

    let candidateQuestions = parsedResult.questions;
    if (reqQuestionsCount && candidateQuestions.length > reqQuestionsCount) {
      candidateQuestions = candidateQuestions.slice(0, reqQuestionsCount);
    }

    // Sanitize and ensure format
    const sanitizedQuestions = candidateQuestions.map((q, idx) => ({
      question_number: idx + 1,
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
    if (import.meta.env.DEV) {
      console.error('Exception in extract-exam API:', err);
    }
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'حدث خطأ غير متوقع في الخادم.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

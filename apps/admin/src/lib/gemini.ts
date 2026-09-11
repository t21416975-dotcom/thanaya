import type { ExamQuestion } from '@thanaya/types';
import { supabase } from './supabase';

export interface ExtractionResult {
  success: boolean;
  model_used?: string;
  total_questions?: number;
  questions: Omit<ExamQuestion, 'id' | 'exam_id' | 'created_at'>[];
  error?: string;
}

/**
 * Converts a File object to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data url prefix (e.g. "data:application/pdf;base64,")
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Mock questions for offline preview / development test mode
 */
export function generateMockQuestions(_examTitle?: string, count: number = 5): Omit<ExamQuestion, 'id' | 'exam_id' | 'created_at'>[] {
  const bank = [
    {
      question_text: `في الدائرة الكهربية الموضحة، إذا كانت قراءة الفولتميتر 12 فولت والمقاومة الداخلية للمصدر مهملة، فإن شدة التيار المار في المقاومة R تساوي:`,
      options: ['2 أمبير', '4 أمبير', '6 أمبير', '8 أمبير'],
      correct_option_index: 0,
      explanation: 'بتطبيق قانون أوم للدوائر المغلقة: I = V / R = 12 / 6 = 2 A. المقاومة الكلية للفرع تساوي 6 أوم وفرق الجهد 12V.',
    },
    {
      question_text: `أي من المركبات العضوية التالية يتفاعل بالاستبدال في ضوء الشمس المباشر أو غير المباشر؟`,
      options: ['الإيثان (Alkane)', 'الإيثين (Alkene)', 'الإيثاين (Alkyne)', 'البروبين (Alkene)'],
      correct_option_index: 0,
      explanation: 'الألكانات مركبات مشبعة بروابط سيجما القوية، لذا تتفاعل بالاستبدال (الهلجنة) في وجود الأشعة فوق البنفسجية UV.',
    },
    {
      question_text: `إذا كانت د(س) = س³ + 3س² - 9س + 5، فإن النقطة الحرجة التي تمثل نهاية عظمى محلية هي:`,
      options: ['(-3, 32)', '(1, 0)', '(0, 5)', '(3, 32)'],
      correct_option_index: 0,
      explanation: "د'(س) = 3س² + 6س - 9 = 0 => س² + 2س - 3 = 0 => (س+3)(س-1) = 0. باختبار الإشارة حول س = -3 نجد أنها تتغير من موجب لسالب، إذن توجد نهاية عظمى محلية عند س = -3 وقيمتها 32.",
    },
    {
      question_text: `أي الهرمونات التالية يزداد إفرازه عند انخفاض ضغط الدم أو زيادة تركيز الأملاح في الدم للحفاظ على الاتزان الأسموزي؟`,
      options: ['الهرمون المضاد لإدرار البول (ADH / الفازوبريسين)', 'هرمون الأنسولين', 'هرمون الثيروكسين', 'هرمون النمو (GH)'],
      correct_option_index: 0,
      explanation: 'يقوم هرمون ADH بإعادة امتصاص الماء من النيفرونات في الكلى إلى الدم، مما يرفع ضغط الدم ويقلل أسموزية البلازما.',
    },
    {
      question_text: `ما هو الغرض البلاغي من الاستفهام في قول الشاعر: "هل يرجع الماضي إذا ما انقضى؟"`,
      options: ['النفي والاستبعاد', 'التقرير والتأكيد', 'التعجب والحيرة', 'التحسر والرجاء'],
      correct_option_index: 0,
      explanation: 'الاستفهام هنا غرضه البلاغي النفي، حيث يصح استبدال أداة الاستفهام بأداة نفي (لا يرجع الماضي).',
    },
    {
      question_text: `النسبة بين المقاومة المكافئة لعدة مقاومات متماثلة متصلة على التوالي إلى مقاومتها المكافئة عند توصيلها على التوازي (عددها n) تساوي:`,
      options: ['n²', 'n', '1 / n', '2n'],
      correct_option_index: 0,
      explanation: 'في التوالي R_eq1 = n * R، وفي التوازي R_eq2 = R / n. بقسمة المقاومتين: R_eq1 / R_eq2 = (n*R) / (R/n) = n².',
    },
    {
      question_text: `الغاز الناتج من تفاعل فلز الصوديوم مع الإيثانول هو غاز:`,
      options: ['الهيدروجين (يشتعل بفرقعة)', 'الأكسجين', 'ثاني أكسيد الكربون', 'النيتروجين'],
      correct_option_index: 0,
      explanation: 'يتفاعل فلز الصوديوم النشط مع الهيدروجين الحمضي الضعيف في مجموعة الهيدروكسيل بالإيثانول مكوناً إيثوكسيد الصوديوم ويتصاعد غاز الهيدروجين.',
    },
    {
      question_text: `تكامل ∫ (2س + 3)⁴ ءس بالنسبة لـ س يساوي:`,
      options: ['(1/10) (2س + 3)⁵ + ث', '(1/5) (2س + 3)⁵ + ث', '(2/5) (2س + 3)⁵ + ث', '(2س + 3)⁵ + ث'],
      correct_option_index: 0,
      explanation: 'تكامل دالة خطية مرفوعة لأس: نقسم على معامل س ونزيد الأس بمقدار 1 ونقسم على الأس الجديد: (1/2) * (1/5) (2س + 3)⁵ + ث = (1/10) (2س + 3)⁵ + ث.',
    },
    {
      question_text: `تتكون الرابطة الببتيدية بين الأحماض الأمينية عند بناء البروتين بتفاعل نزع جزيء:`,
      options: ['ماء (H₂O)', 'أمونيا (NH₃)', 'ثاني أكسيد كربون (CO₂)', 'هيدروجين (H₂)'],
      correct_option_index: 0,
      explanation: 'تتكون الرابطة الببتيدية بتفاعل نازع للماء بين مجموعة الكربوكسيل لأحد الأحماض الأمينية ومجموعة الأمين للحمض الأميني المجاور.',
    },
    {
      question_text: `نوع "لا" في جملة: "لا طالبَ علمٍ مهملٌ لواجبه" هي:`,
      options: ['نافية للجنس عاملة', 'نافية للفعل', 'ناهية جازمة', 'عاطفة'],
      correct_option_index: 0,
      explanation: 'لا هنا نافية للجنس تعمل عمل إنّ؛ واسمها مضاف (طالب علم) منصوب بالفتحة ومهمل خبرها مرفوع.',
    },
  ];

  const targetCount = Math.max(1, count);
  const result: Omit<ExamQuestion, 'id' | 'exam_id' | 'created_at'>[] = [];

  for (let i = 0; i < targetCount; i++) {
    const base = bank[i % bank.length];
    const cycle = Math.floor(i / bank.length);
    const suffix = cycle > 0 ? ` (نموذج مكرر - تدريب ${cycle + 1})` : '';
    result.push({
      question_number: i + 1,
      question_text: `${base.question_text}${suffix}`,
      options: [...base.options],
      correct_option_index: (base.correct_option_index + i) % 4, // تنويع موقع الإجابة الصحيحة
      explanation: base.explanation,
    });
  }

  return result;
}

/**
 * Extracts MCQ questions from a PDF file using either the server API or direct Gemini REST call
 */
export async function extractExamQuestionsFromPdf({
  file,
  modelName = 'gemini-2.5-flash',
  systemPrompt,
  apiKey,
  questionsCount,
}: {
  file: File;
  modelName?: string;
  systemPrompt?: string;
  apiKey?: string;
  questionsCount?: number;
}): Promise<ExtractionResult> {
  const base64Data = await fileToBase64(file);

  // 1. Try calling the backend /api/ai/extract-exam endpoint first with admin auth token
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (systemPrompt) formData.append('system_prompt', systemPrompt);
    if (modelName) formData.append('model_name', modelName);
    if (questionsCount && questionsCount > 0) {
      formData.append('questions_count', String(questionsCount));
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const apiBaseUrl = (import.meta as any).env?.VITE_PUBLIC_API_URL || '';
    const endpointsToTry = [
      `${apiBaseUrl}/api/ai/extract-exam`,
      ...(apiBaseUrl ? [] : ['https://thanaya-web.vercel.app/api/ai/extract-exam']),
    ];

    for (const url of endpointsToTry) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
            let finalQs = data.questions;
            if (questionsCount && questionsCount > 0 && finalQs.length > questionsCount) {
              finalQs = finalQs.slice(0, questionsCount);
            }
            return {
              success: true,
              model_used: data.model_used || modelName,
              total_questions: finalQs.length,
              questions: finalQs,
            };
          }
        }
      } catch {
        // try next endpoint
      }
    }
  } catch (err) {
    console.warn('Server route /api/ai/extract-exam not reachable, trying direct client Gemini API...', err);
  }

  // 2. Direct Gemini REST API call if apiKey is provided
  const activeKey = apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (activeKey && activeKey.trim()) {
    try {
      let prompt =
        systemPrompt ||
        `أنت خبير تربوي ومعلم أول في وزارة التربية والتعليم للثانوية العامة والبكالوريا المصرية. مهمتك هي إنشاء واستخراج أسئلة الاختيار من متعدد (MCQs) التفاعلية من ملف الـ PDF المرفق بدقة علمية وتربوية عالية، مع توليد إجابات دقيقة وشرح وتفسير نموذجي شامل لكل سؤال.

القواعد والضوابط الصارمة:
1. الالتزام التام بالمنهج ومنع الخروج عنه: استخرج واعتمد حصراً على المفاهيم والقوانين والدروس الواردة في ملف الـ PDF المرفوع. يُمنع منعاً باتاً إدخال أسئلة أو مواضيع من مناهج أخرى أو معلومات خارجية خارج حدود هذا الملف.
2. مستوى الأسئلة وجودتها: صغ أسئلة تقيس الفهم والتطبيق والتحليل الشامل للطلاب بناءً على محتوى الملف؛ ابتعد عن البصمجية والنقل الحرفي السطحي، وفي نفس الوقت لا تخرج عن نطاق المادة.
3. التوزيع العشوائي لموقع الإجابة الصحيحة: قم بتوزيع موقع الإجابة الصحيحة (correct_option_index) بشكل عشوائي ومتوازن بين الخيارات الأربعة (0, 1, 2, 3)، ويُمنع منعاً باتاً جعل الإجابة الصحيحة دائماً في الخيار الأول (0).
4. الخيارات الأربعة: لكل سؤال، وفر 4 خيارات واضحة ومتمايزة ومكتوبة بدقة.
5. التفسير والشرح النموذجي: اكتب في حقل explanation شرحاً علمياً تفصيلياً مقنعاً وواضحاً يوضح للطالب خطوات الحل الرياضي أو التعليل العلمي والقاعدة المتبعة وسبب صحة الخيار المختار.
6. الإخراج الإجباري: يجب أن تكون النتيجة حصراً بصيغة JSON المحددة.`;

      if (questionsCount && questionsCount > 0) {
        prompt += `\n\nتنبيه إلزامي ومحدد: العدد الإجمالي للأسئلة في مصفوفة questions يجب أن يكون بالضبط ${questionsCount} سؤالاً. إذا كان عدد الأسئلة المكتوبة بالملف أقل من ${questionsCount}، يجب عليك صياغة وتوليد أسئلة جديدة إضافية بنفس نمط البكالوريا ومبنية بالكامل وبدقة على شرح وقوانين ومعلومات الملف حتى يكتمل العدد المطلوب (${questionsCount} سؤالاً) بدقة متناهية.`;
      }

      const promptUserText = questionsCount && questionsCount > 0
        ? `المهمة: إنشاء وإخراج بالضبط ${questionsCount} سؤال اختيار من متعدد (MCQ) متوافقة مع نظام البكالوريا بناءً على هذا الملف:
1. استخرج أولاً كافة الأسئلة الموجودة بالفعل في ملف الـ PDF.
2. إذا كان عدد الأسئلة المكتوبة بالملف أقل من ${questionsCount} سؤال، قم فوراً بتوليد وصياغة أسئلة جديدة إضافية تغطي كافة موضوعات ودروس ومفاهيم الملف حتى يكتمل العدد المطلوب وهو ${questionsCount} سؤالاً بالضبط لا أقل ولا أكثر.
3. لكل سؤال: 4 خيارات واضحة، تحديد الإجابة الصحيحة، وشرح تفسيري وافٍ.`
        : 'استخرج كافة أسئلة الاختيار من متعدد من هذا الملف واكتب شرحاً وتفسيراً وافياً للإجابة الصحيحة لكل سؤال بصيغة JSON المحددة.';

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelName.trim() || 'gemini-2.5-flash'
      )}:generateContent`;

      const body = {
        systemInstruction: {
          parts: [{ text: prompt }],
        },
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: file.type || 'application/pdf',
                  data: base64Data,
                },
              },
              {
                text: promptUserText,
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

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': activeKey.trim(),
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        let errMsg = `Gemini API Error (${resp.status}): ${resp.statusText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) errMsg = errJson.error.message;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const jsonResp = await resp.json();
      const textOutput = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) throw new Error('لم يتم استلام نص استجابة من Gemini.');

      const parsed = JSON.parse(textOutput);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        let qs = parsed.questions;
        if (questionsCount && questionsCount > 0 && qs.length > questionsCount) {
          qs = qs.slice(0, questionsCount);
        }
        const sanitized = qs.map((q: any, idx: number) => ({
          ...q,
          question_number: idx + 1,
        }));
        return {
          success: true,
          model_used: modelName,
          total_questions: sanitized.length,
          questions: sanitized,
        };
      }
    } catch (directErr: any) {
      if (import.meta.env.DEV) {
        console.error('Direct Gemini extraction failed:', directErr);
      }
      return {
        success: false,
        error: directErr.message || 'فشل الاتصال بـ Gemini API.',
        questions: [],
      };
    }
  }

  // 3. Fallback for demo/development when no API key is configured yet
  const targetMockCount = questionsCount && questionsCount > 0 ? questionsCount : 5;
  const mock = generateMockQuestions(file.name.replace(/\.pdf$/i, ''), targetMockCount);
  return {
    success: true,
    model_used: `${modelName} (بيئة معاينة تجريبية - بدون مفتاح API)`,
    total_questions: mock.length,
    questions: mock,
  };
}

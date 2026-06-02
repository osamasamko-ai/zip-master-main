const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const userEmail = process.env.E2E_USER_EMAIL || 'user@example.com';
const userPassword = process.env.E2E_USER_PASSWORD || 'password123';
const lawyerEmail = process.env.E2E_LAWYER_EMAIL || 'lawyer@example.com';
const lawyerPassword = process.env.E2E_LAWYER_PASSWORD || 'password123';

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const results = [];

async function request(label, method, path, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  results.push({
    label,
    status: response.status,
    ok: response.ok,
    message: json.message || json.error || 'OK',
  });

  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return json;
}

async function login(label, email, password) {
  const response = await request(label, 'POST', '/api/auth/login', null, { email, password });
  return response.data;
}

function formData(values) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.append(key, value));
  return data;
}

try {
  const userLogin = await login('تسجيل دخول العميل', userEmail, userPassword);
  const lawyerLogin = await login('تسجيل دخول المحامي', lawyerEmail, lawyerPassword);
  const userToken = userLogin.token;
  const lawyerToken = lawyerLogin.token;
  const lawyerId = lawyerLogin.user.id;

  await request('تجهيز رصيد العميل للاختبار', 'POST', '/api/app/billing/top-up', userToken, {
    amount: 300000,
    paymentMethod: 'زين كاش',
    note: `E2E top-up ${stamp}`,
  });

  const createdCase = await request('إنشاء قضية', 'POST', '/api/app/workspace/cases', userToken, {
    title: `E2E UX قضية كاملة ${stamp}`,
    matter: 'مدنية',
    lawyerId,
    totalAgreedFee: 100000,
    caseType: 'مدنية',
  });
  const caseId = createdCase.data.id;

  await request('إضافة بيانات للقضية', 'POST', `/api/app/workspace/cases/${caseId}/custom-fields`, userToken, {
    label: 'رقم السيناريو',
    value: `E2E-${stamp}`,
  });

  const documentCase = await request('إنشاء وكالة للتوقيع', 'POST', `/api/app/workspace/cases/${caseId}/documents`, userToken, {
    name: `وكالة اختبار E2E ${stamp}`,
    size: 'نموذج اختبار',
    type: 'pdf',
    actionRequired: 'بانتظار توقيعك',
    tags: ['agency', 'power_of_attorney'],
  });
  const documentId = documentCase.data.documents.find((doc) => doc.name.includes(stamp))?.id;
  if (!documentId) throw new Error('لم يتم العثور على الوثيقة المنشأة.');

  await request('توقيع الوكالة', 'POST', `/api/app/workspace/cases/${caseId}/documents/${documentId}/sign`, userToken);
  await request('دفع القضية', 'POST', `/api/app/workspace/cases/${caseId}/payments`, userToken, { installments: 1 });
  await request('رسالة العميل في القضية', 'POST', `/api/app/workspace/cases/${caseId}/messages`, userToken, {
    text: 'تم فتح القضية ورفع الوكالة وتوقيعها وسداد الأتعاب كاملة.',
  });
  await request('رد المحامي في القضية', 'POST', `/api/app/workspace/cases/${caseId}/messages`, lawyerToken, {
    text: 'تمت مراجعة الملف، سنكمل الإجراءات ثم نغلق القضية.',
  });
  await request('إغلاق القضية', 'POST', `/api/app/workspace/cases/${caseId}/close`, lawyerToken, {
    summary: 'تم إغلاق القضية عبر اختبار E2E بعد اكتمال الوثائق والدفع.',
  });
  await request('تقييم المحامي بعد القضية', 'POST', `/api/app/workspace/cases/${caseId}/review`, userToken, {
    rating: 5,
    text: 'تجربة اختبارية ناجحة: الرد واضح والإجراءات مكتملة.',
  });

  const consultation = await request('إنشاء استشارة', 'POST', `/api/app/lawyers/${lawyerId}/consultation`, userToken, {
    paymentMethod: 'زين كاش',
    note: `E2E UX استشارة كاملة ${stamp}: أحتاج رأياً قانونياً مختصراً ثم إغلاق الاستشارة.`,
  });
  const consultationId = consultation.data.caseData.id;

  await request('رد المحامي على الاستشارة', 'POST', `/api/app/workspace/cases/${consultationId}/messages`, lawyerToken, {
    text: 'تمت مراجعة الاستشارة: الرأي الأولي واضح ويمكن اعتماد الخطوة المقترحة.',
  });
  await request('رد العميل على الاستشارة', 'POST', `/api/app/workspace/cases/${consultationId}/messages`, userToken, {
    text: 'شكراً، أعتمد الرأي ويمكن إغلاق الاستشارة.',
  });
  await request('إغلاق الاستشارة', 'POST', `/api/app/workspace/cases/${consultationId}/close`, lawyerToken, {
    summary: 'تم إغلاق الاستشارة عبر اختبار E2E بعد اعتماد الرأي القانوني.',
  });
  await request('تقييم المحامي بعد الاستشارة', 'POST', `/api/app/workspace/cases/${consultationId}/review`, userToken, {
    rating: 5,
    text: 'استشارة واضحة ومباشرة.',
  });

  const deniedPost = await fetch(`${baseUrl}/api/app/feed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: formData({ content: `E2E محاولة نشر عميل ${stamp}`, category: 'تجربة النظام' }),
  });
  results.push({
    label: 'منع نشر العميل العادي',
    status: deniedPost.status,
    ok: deniedPost.status === 403,
    message: deniedPost.status === 403 ? 'تم المنع كما هو متوقع' : 'لم يتم المنع',
  });
  if (deniedPost.status !== 403) throw new Error('كان يجب منع العميل العادي من نشر منشور.');

  const post = await request('إنشاء منشور من المحامي', 'POST', '/api/app/feed', lawyerToken, formData({
    content: `E2E UX منشور محامٍ موثق ${stamp}: اختبار تجربة المجتمع والتفاعل.`,
    category: 'تجربة النظام',
  }));
  const postId = post.data.id;
  await request('إعجاب العميل بالمنشور', 'POST', `/api/app/feed/${postId}/like`, userToken);
  await request('حفظ العميل للمنشور', 'POST', `/api/app/feed/${postId}/save`, userToken);
  await request('مشاركة العميل للمنشور', 'POST', `/api/app/feed/${postId}/share`, userToken);
  await request('تعليق العميل على المنشور', 'POST', `/api/app/feed/${postId}/comments`, userToken, {
    content: 'تعليق اختبار من العميل: التفاعل يعمل.',
  });

  const story = await request('إنشاء ستوري من المحامي', 'POST', '/api/app/feed/stories', lawyerToken, formData({
    text: `E2E UX ستوري محامٍ ${stamp}: اختبار عرض ومشاهدة الستوري.`,
  }));
  const storyId = story.data.id;
  await request('مشاهدة العميل للستوري', 'POST', `/api/app/feed/stories/${storyId}/view`, userToken);

  const cases = await request('تحقق القضايا', 'GET', '/api/app/workspace/cases', userToken);
  const closedCase = cases.data.find((item) => item.id === caseId);
  const closedConsultation = cases.data.find((item) => item.id === consultationId);
  if (closedCase?.status !== 'closed' || closedConsultation?.status !== 'closed') {
    throw new Error('لم تصل القضية أو الاستشارة إلى حالة الإغلاق.');
  }

  const feed = await request('تحقق المنشور', 'GET', '/api/app/feed', userToken);
  const stories = await request('تحقق الستوري', 'GET', '/api/app/feed/stories?mode=all', userToken);
  if (!feed.data.some((item) => item.id === postId)) throw new Error('المنشور غير ظاهر في الخلاصة.');
  if (!stories.data.some((item) => item.id === storyId)) throw new Error('الستوري غير ظاهر.');

  console.log(JSON.stringify({
    ok: true,
    stamp,
    caseId,
    consultationId,
    postId,
    storyId,
    results,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
    results,
  }, null, 2));
  process.exit(1);
}

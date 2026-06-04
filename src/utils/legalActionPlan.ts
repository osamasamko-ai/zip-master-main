export type LegalPlan = {
  category: string;
  urgency: 'critical' | 'high' | 'medium';
  urgencyLabel: string;
  summary: string;
  estimatedCost: string;
  requiredDocuments: string[];
  nextSteps: string[];
  matchingSpecialties: string[];
  shareText: string;
};

type CategoryRule = {
  category: string;
  specialty: string;
  keywords: string[];
  documents: string[];
  steps: string[];
  cost: string;
};

const categoryRules: CategoryRule[] = [
  {
    category: 'نزاع إيجار أو عقار',
    specialty: 'عقارات',
    keywords: ['ايجار', 'إيجار', 'مالك', 'مؤجر', 'مستأجر', 'طرد', 'عقار', 'بيت', 'شقة', 'ارض', 'أرض'],
    documents: ['عقد الإيجار أو سند الملكية', 'إيصالات الدفع', 'صور أو رسائل تثبت الواقعة', 'هوية الأطراف'],
    steps: ['ثبّت الوقائع والتواريخ كتابة', 'اجمع إثباتات الدفع أو الإشعارات', 'اطلب إنذاراً قانونياً قبل التصعيد', 'احجز استشارة مع محام عقاري'],
    cost: 'منخفض إلى متوسط حسب قيمة النزاع',
  },
  {
    category: 'مطالبة مالية أو دين',
    specialty: 'قضايا تجارية',
    keywords: ['دين', 'فلوس', 'مال', 'مبلغ', 'فاتورة', 'قرض', 'سلفة', 'شيك', 'وصل', 'يدين', 'استرداد'],
    documents: ['وصل أو عقد الدين', 'محادثات أو رسائل الاعتراف', 'كشف تحويل أو إيصال دفع', 'بيانات الطرف الآخر'],
    steps: ['احسب المبلغ والتواريخ بدقة', 'جهز إنذار مطالبة رسمي', 'حاول تسوية موثقة قبل الدعوى', 'افتح ملف مطالبة مع محام تجاري'],
    cost: 'متوسط ويرتبط بقيمة المطالبة',
  },
  {
    category: 'أحوال شخصية',
    specialty: 'أحوال شخصية',
    keywords: ['طلاق', 'زواج', 'نفقة', 'حضانة', 'ميراث', 'وصية', 'زوج', 'زوجة', 'اطفال', 'أطفال'],
    documents: ['عقد الزواج أو القسام الشرعي', 'هويات الأطراف', 'شهادات ميلاد الأطفال إن وجدت', 'أي أحكام أو اتفاقات سابقة'],
    steps: ['حدد الطلب الأساسي: نفقة، حضانة، طلاق أو ميراث', 'اجمع مستندات العائلة والهوية', 'اكتب تسلسل الأحداث دون مبالغة', 'تواصل مع محام أحوال شخصية'],
    cost: 'منخفض إلى متوسط حسب عدد الطلبات',
  },
  {
    category: 'عمل أو شركة',
    specialty: 'قضايا تجارية',
    keywords: ['شركة', 'شريك', 'وظيفة', 'راتب', 'فصل', 'موظف', 'عمل', 'عقد عمل', 'حصة', 'اسهم', 'أسهم'],
    documents: ['عقد العمل أو عقد الشركة', 'كشوف الرواتب أو التحويلات', 'مراسلات الإدارة أو الشركاء', 'سجل تجاري إن وجد'],
    steps: ['راجع العقد والالتزامات المكتوبة', 'وثق المخالفة أو الضرر', 'جهز خطاب مطالبة أو تسوية', 'اعرض الملف على محام تجاري'],
    cost: 'متوسط وقد يرتفع مع تعقيد الشركة',
  },
  {
    category: 'جنائي أو طارئ',
    specialty: 'قضايا جنائية',
    keywords: ['شرطة', 'توقيف', 'اعتقال', 'تهديد', 'ابتزاز', 'سرقة', 'ضرب', 'جريمة', 'شكوى', 'محضر'],
    documents: ['رقم المحضر أو مركز الشرطة', 'هوية الشخص المعني', 'أسماء الشهود', 'أي صور أو تسجيلات أو رسائل'],
    steps: ['لا توقع على شيء لا تفهمه', 'اطلب محامياً فوراً إذا كان هناك توقيف', 'احفظ أسماء الشهود والأوقات', 'اتصل بمحام جنائي بشكل عاجل'],
    cost: 'مرتفع نسبياً إذا كان هناك توقيف أو جلسات عاجلة',
  },
];

const criticalWords = ['توقيف', 'اعتقال', 'شرطة', 'طرد', 'تهديد', 'ابتزاز', 'ضرب', 'اليوم', 'الان', 'الآن', 'عاجل'];
const highWords = ['موعد', 'جلسة', 'انذار', 'إنذار', 'شكوى', 'فصل', 'دين', 'حضانة', 'نفقة'];

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word.toLowerCase()));
}

export function buildLegalActionPlan(problem: string): LegalPlan {
  const text = problem.trim().toLowerCase();
  const matched =
    categoryRules.find((rule) => includesAny(text, rule.keywords)) ||
    {
      category: 'استشارة قانونية عامة',
      specialty: 'استشارة عامة',
      documents: ['هوية صاحب الطلب', 'أي عقد أو رسالة مرتبطة بالمشكلة', 'تسلسل زمني مختصر للأحداث', 'بيانات الطرف الآخر إن وجدت'],
      steps: ['اكتب الوقائع حسب التاريخ', 'حدد النتيجة التي تريدها بوضوح', 'اجمع الأدلة قبل التواصل مع الطرف الآخر', 'ابدأ باستشارة قصيرة لتحديد المسار'],
      cost: 'منخفض في البداية ثم يتحدد بعد تقييم الملف',
      keywords: [],
    };

  const urgency: LegalPlan['urgency'] = includesAny(text, criticalWords) ? 'critical' : includesAny(text, highWords) ? 'high' : 'medium';
  const urgencyLabel = urgency === 'critical' ? 'عاجل جداً' : urgency === 'high' ? 'مرتفع' : 'متوسط';
  const shortProblem = problem.trim().slice(0, 110);

  return {
    category: matched.category,
    urgency,
    urgencyLabel,
    estimatedCost: matched.cost,
    requiredDocuments: matched.documents,
    nextSteps: matched.steps,
    matchingSpecialties: [matched.specialty, 'محام موثق', 'مراجعة مستندات'],
    summary: `يبدو أن المسألة أقرب إلى ${matched.category}. الأولوية الآن هي تثبيت الوقائع، تجهيز الأدلة، ثم اختيار مسار تفاوض أو إنذار أو دعوى حسب رد الطرف الآخر.`,
    shareText: `مشكلتي: ${shortProblem}\nالتصنيف: ${matched.category}\nالأولوية: ${urgencyLabel}\nالخطوة التالية: ${matched.steps[0]}`,
  };
}

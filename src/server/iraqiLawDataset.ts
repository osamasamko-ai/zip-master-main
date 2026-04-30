export interface IraqiLawDoc {
    id: string;
    title: string;
    law: string;
    article: string;
    category: string;
    summary: string;
    content: string;
    source: string;
}

export const IRAQI_LAW_DATASET: IraqiLawDoc[] = [
    {
        id: 'law-001',
        title: 'قانون العقوبات العراقي رقم 111 لسنة 1969',
        law: 'قانون العقوبات',
        article: '1-450',
        category: 'جنائي',
        summary: 'ينظم الجرائم والعقوبات في العراق مع أحكام عن القتل، السرقة، الغش، والجرائم الاقتصادية.',
        content: 'قانون العقوبات رقم 111 لسنة 1969 هو الإطار الأساسي للمسؤولية الجنائية في العراق، ويحدد العقوبات المناسبة لكل جريمة ونظامها في المحكمة الجزائية.',
        source: 'https://example.com/iraqi-criminal-code'
    },
    {
        id: 'law-002',
        title: 'قانون الأحوال الشخصية العراقي رقم 188 لسنة 1959',
        law: 'قانون الأحوال الشخصية',
        article: '1-414',
        category: 'أسرة',
        summary: 'ينظم الزواج، الطلاق، النفقة، حق الحضانة، الإرث، والمواريث وفقاً للشريعة الإسلامية والقانون المدني في العراق.',
        content: 'قانون الأحوال الشخصية رقم 188 لسنة 1959 يحدد قواعد الإنعقاد الشرعي للزواج، حقوق الزوجين، أحكام النفقة وحضانة الأطفال، وكذلك مواريث الورثة بحسب الفئات الشرعية.',
        source: 'https://example.com/iraqi-personal-status-law'
    },
    {
        id: 'law-003',
        title: 'قانون الشركات العراقي رقم 21 لسنة 1997',
        law: 'قانون الشركات',
        article: '1-120',
        category: 'تجاري',
        summary: 'يغطي تنظيم الشركات، أنواعها، إجراءات التأسيس، حقوق الشركاء، والإجراءات القانونية لحل الشركات.',
        content: 'قانون الشركات رقم 21 لسنة 1997 ينظم الشركات ذات المسؤولية المحدودة، الشركات التضامنية، الشركة القابضة، ويضع إطاراً لتسجيل رؤوس الأموال والعقود الأساسية.',
        source: 'https://example.com/iraqi-companies-law'
    },
    {
        id: 'law-004',
        title: 'قانون العلامات والبيانات التجارية رقم 21 لسنة 1957',
        law: 'قانون العلامات التجارية',
        article: '1-29',
        category: 'ملكية فكرية',
        summary: 'ينظم تسجيل العلامات التجارية، الشروط، معارضة التسجيل، ومدة الحماية والتجديد في العراق.',
        content: 'قانون العلامات التجارية رقم 21 لسنة 1957 يحدد الإجراءات القانونية لحماية العلامات لدى وزارة الصناعة والمعادن، بما في ذلك مدة التسجيل وتجديد الحماية لمدة عشر سنوات.',
        source: 'https://example.com/iraqi-trademarks-law'
    },
    {
        id: 'law-005',
        title: 'قانون المرافعات المدنية رقم 83 لسنة 1969',
        law: 'قانون المرافعات المدنية',
        article: '1-501',
        category: 'مدني',
        summary: 'ينظم كيفية إقامة الدعاوى المدنية أمام المحاكم، قواعد الدعوى، وأحكام التنفيذ والتحكيم المدني.',
        content: 'قانون المرافعات المدنية رقم 83 لسنة 1969 يضع الإجراءات المطلوبة لإثبات الحق في المحكمة، وكيفية تقديم الأدلة، وإجراءات الاستئناف.',
        source: 'https://example.com/iraqi-civil-procedure-law'
    },
    {
        id: 'law-006',
        title: 'قانون أصول المحاكمات الجزائية رقم 23 لسنة 1971',
        law: 'قانون أصول المحاكمات الجزائية',
        article: '1-454',
        category: 'جنائي',
        summary: 'ينظم إجراءات التحقيق والمحاكمة الجنائية، حقوق المتهم، النيابة العامة، وخطة المحاكمة في العراق.',
        content: 'قانون أصول المحاكمات الجزائية رقم 23 لسنة 1971 يضمن إجراءات قانونية للتحقيق والمحاكمة، بما في ذلك القبول بالتهم وإفادات الشهود وحقوق الدفاع.',
        source: 'https://example.com/iraqi-criminal-procedure-law'
    },
    {
        id: 'law-007',
        title: 'قانون التنفيذ المدني رقم 107 لسنة 1976',
        law: 'قانون التنفيذ المدني',
        article: '1-86',
        category: 'مدني',
        summary: 'ينظم طرق تنفيذ الأحكام المدنية، إجراءات الحجز، بيع المنازل، وتنفيذ الديون في العراق.',
        content: 'قانون التنفيذ المدني رقم 107 لسنة 1976 يساعد الدائنين في تنفيذ الأحكام النهائية عبر الحجز على أموال المدين وبيعها وفقاً للإجراءات القانونية.',
        source: 'https://example.com/iraqi-execution-law'
    },
    {
        id: 'law-008',
        title: 'قانون العمل العراقي رقم 37 لسنة 2015',
        law: 'قانون العمل',
        article: '1-135',
        category: 'عمالي',
        summary: 'يغطي حقوق العمال وأصحاب العمل، ساعات العمل، الإجازات، التعويضات، وطرد العاملين.',
        content: 'قانون العمل رقم 37 لسنة 2015 ينظم العلاقة التعاقدية بين العامل وصاحب العمل، بما في ذلك الحد الأدنى للأجور والإجازات السنوية والتعويضات عن الفصل الظالم.',
        source: 'https://example.com/iraqi-labor-law'
    },
    {
        id: 'law-009',
        title: 'قانون التأمينات الاجتماعية رقم 39 لسنة 1971',
        law: 'قانون التأمينات الاجتماعية',
        article: '1-90',
        category: 'اجتماعي',
        summary: 'يحدد حقوق المؤمن عليهم، المعاشات التقاعدية، إعانات العجز، والتأمين ضد الحوادث المهنية.',
        content: 'قانون التأمينات الاجتماعية رقم 39 لسنة 1971 ينظم تغطية العاملين، شروط الاستحقاق، ومعدلات الاشتراكات والتعويضات للعاملين في العراق.',
        source: 'https://example.com/iraqi-social-security-law'
    },
    {
        id: 'law-010',
        title: 'قانون المحكمة الاتحادية العليا رقم 30 لسنة 2005',
        law: 'قانون المحكمة الاتحادية العليا',
        article: '1-40',
        category: 'دستوري',
        summary: 'ينظم اختصاصات المحكمة الاتحادية العليا، الطعون بالدستور، وتسوية النزاعات بين السلطات الاتحادية والمحافظات.',
        content: 'قانون المحكمة الاتحادية العليا رقم 30 لسنة 2005 يحدد اختصاص المحكمة في تفسير الدستور والفصل في القوانين المتنازع عليها والمنازعات الدستورية الأخرى.',
        source: 'https://example.com/iraqi-federal-court-law'
    },
    {
        id: 'law-011',
        title: 'قانون الاستثمار رقم 13 لسنة 2006',
        law: 'قانون الاستثمار',
        article: '1-60',
        category: 'تجاري',
        summary: 'يوفر حوافز قانونية للمستثمرين، ويحدد حماية الأموال الأجنبية، وشروط تسجيل المشاريع الاستثمارية في العراق.',
        content: 'قانون الاستثمار رقم 13 لسنة 2006 يشجع المشاريع الاستثمارية المحلية والأجنبية عبر تسهيلات ضريبية وحماية للأصول والاستثمار في المناطق الصناعية.',
        source: 'https://example.com/iraqi-investment-law'
    },
    {
        id: 'law-012',
        title: 'قانون الشركات ذات المسؤولية المحدودة رقم 21 لسنة 1997',
        law: 'قانون الشركات',
        article: '1-36',
        category: 'تجاري',
        summary: 'أحكام إضافية تنظم الشركات ذات المسؤولية المحدودة وأساليب الانسحاب والتوزيع في العراق.',
        content: 'يتناول هذا القانون إجراءات تأسيس الشركات ذات المسؤولية المحدودة وكيفية التعامل مع حقوق الشركاء ومسؤولياتهم أمام الغير.',
        source: 'https://example.com/iraqi-llc-law'
    },
    {
        id: 'law-013',
        title: 'القانون المدني العراقي رقم 40 لسنة 1951 - أحكام البيع',
        law: 'القانون المدني',
        article: '506-610',
        category: 'مدني',
        summary: 'ينظم عقد البيع، التزامات البائع والمشتري، انتقال الملكية، وضمان العيوب الخفية في المنقولات.',
        content: 'عقد البيع هو تمليك مال أو حق مالي لقاء ثمن نقدي. يلتزم البائع بنقل الملكية للمشتري وضمان عدم التعرض والعيوب.',
        source: 'https://example.com/iraqi-civil-law-sales'
    }
];

const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .replace(/[\u064B-\u0652]/g, '')
        .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const tokenize = (value: string) => {
    return Array.from(new Set(normalizeText(value).split(' ').filter(Boolean)));
};

const scoreDocument = (question: string, doc: IraqiLawDoc) => {
    const queryTokens = tokenize(question);
    const title = normalizeText(doc.title);
    const summary = normalizeText(doc.summary);
    const content = normalizeText(doc.content);
    const category = normalizeText(doc.category);
    let score = 0;

    for (const token of queryTokens) {
        if (!token) continue;
        if (title.includes(token)) score += 10;
        if (summary.includes(token)) score += 6;
        if (content.includes(token)) score += 3;
        if (category.includes(token)) score += 2;
        if (doc.law.toLowerCase().includes(token)) score += 4;
        if (doc.article.toLowerCase().includes(token)) score += 1;
    }

    return score;
};

export const getTopRelevantDocuments = (question: string, topK: number) => {
    return IRAQI_LAW_DATASET
        .map((doc) => ({ doc, score: scoreDocument(question, doc) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((item) => item.doc);
};

export const buildLocalAnswer = (question: string, docs: IraqiLawDoc[]) => {
    if (!docs.length) {
        return 'لم يتم العثور على نص تشريعي مباشر ضمن قاعدة البيانات الحالية. يُنصح بمراجعة المحامي المختص أو تقديم تفاصيل إضافية لنتمكن من توجيهك نحو المادة المناسبة.';
    }

    const references = docs
        .map((doc, index) => `${index + 1}. ${doc.title} (${doc.law}) - ${doc.summary}`)
        .join('\n');

    return `بناءً على التشريعات العراقية ذات الصلة، إليك أهم المراجع:
${references}

الإجابة: استناداً إلى ما سبق، ينصح بالتمسك بالإطار القانوني الخاص بـ${docs[0].law} والتأكد من المواد ذات الصلة في ${docs[0].category}. إذا كنت تنوي متابعة إجراء رسمي، فحاول الرجوع مباشرة إلى نص القانون المذكور أو استشارة محامٍ مختص.`;
};

export const makePrompt = (question: string, docs: IraqiLawDoc[]) => {
    const documentSummaries = docs
        .map((doc, index) => `${index + 1}. ${doc.title} - ${doc.summary} [المصدر: ${doc.source}]`)
        .join('\n');

    return `أنت مساعد قانوني عراقي. أجب عن السؤال التالي مستفيداً من المراجع المدرجة أدناه. اذكر المصادر التي تم استخدامها.

السؤال: ${question}

المراجع:
${documentSummaries}

أجب بالعربية الفصحى المختصرة.
`;
};

export const getAllLawDocs = () => IRAQI_LAW_DATASET.map(({ id, title, law, article, category, summary, source }) => ({ id, title, law, article, category, summary, source }));

export interface RAGAnswer {
    question: string;
    answer: string;
    sources: IraqiLawDoc[];
}

export const answerQuestion = async (question: string, topK = 3): Promise<RAGAnswer> => {
    const sources = getTopRelevantDocuments(question, topK);
    const answer = buildLocalAnswer(question, sources);
    return { question, answer, sources };
};

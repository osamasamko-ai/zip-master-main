export interface LawyerDirectoryItem {
  id: string;
  name: string;
  specialty: 'أحوال شخصية' | 'قضايا تجارية' | 'عقارات' | 'ملكية فكرية';
  location: string;
  experience: string;
  experienceYears: number;
  availability: string;
  isOnline: boolean;
  rating: number;
  reviews: string;
  reviewCount: number;
  casesHandled: string;
  consultationFee: string;
  verified: boolean;
  accent: string;
  avatar: string;
  tagline: string;
  followers: number;
  responseTime: string;
  bio: string;
  highlights: string[];
  license: string;
  attachments: string[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt?: string;
  profileScore?: number;
}

export const LAWYER_DIRECTORY: LawyerDirectoryItem[] = [
  {
    id: 'lawyer-1',
    name: 'د. عمر النعيمي',
    specialty: 'قضايا تجارية',
    location: 'بغداد',
    experience: '12 سنة خبرة',
    experienceYears: 12,
    availability: 'متاح اليوم',
    isOnline: true,
    rating: 4.9,
    reviews: '128 مراجعة',
    reviewCount: 128,
    casesHandled: '+180 قضية',
    consultationFee: '50,000 د.ع',
    verified: true,
    accent: 'from-slate-950 via-brand-dark to-brand-navy',
    avatar: 'https://ui-avatars.com/api/?name=%D8%AF.%20%D8%B9%D9%85%D8%B1%20%D8%A7%D9%84%D9%86%D8%B9%D9%8A%D9%85%D9%8A&background=0d2a59&color=ffffff&rounded=true&font-size=0.4',
    tagline: 'مرافعات دقيقة واستشارات للشركات والعقود المعقدة',
    followers: 1248,
    responseTime: 'يرد خلال 20 دقيقة',
    bio: 'يركز على قضايا الشركات والعقود والنزاعات التجارية، مع خبرة واسعة في التفاوض وإدارة ملفات الأعمال الحساسة.',
    highlights: ['محامي معتمد', 'خبرة بالنزاعات التجارية', 'استشارات للشركات الناشئة'],
    license: 'IRQ-2024-001',
    attachments: ['هوية نقابية', 'رخصة ممارسة', 'شهادة مهنية'],
    status: 'approved',
    submittedAt: '12 يناير 2026',
    profileScore: 96,
  },
  {
    id: 'lawyer-2',
    name: 'سجا كاظم',
    specialty: 'ملكية فكرية',
    location: 'بغداد',
    experience: '8 سنوات خبرة',
    experienceYears: 8,
    availability: 'متاحة غداً',
    isOnline: false,
    rating: 4.8,
    reviews: '96 مراجعة',
    reviewCount: 96,
    casesHandled: '+130 قضية',
    consultationFee: '40,000 د.ع',
    verified: true,
    accent: 'from-indigo-900 via-indigo-700 to-fuchsia-600',
    avatar: 'https://ui-avatars.com/api/?name=%D8%B3%D8%AC%D8%A7+%D9%83%D8%A7%D8%B8%D9%85&background=1f3c88&color=ffffff&rounded=true&font-size=0.4',
    tagline: 'حماية العلامات التجارية وحقوق الابتكار بخطوات واضحة',
    followers: 986,
    responseTime: 'يرد خلال ساعة',
    bio: 'متخصصة في العلامات التجارية وحقوق النشر والتراخيص، وتساعد الشركات والأفراد على حماية أصولهم الفكرية.',
    highlights: ['فحص تشابه العلامات', 'متابعة التسجيل', 'دعم الاعتراضات القانونية'],
    license: 'IRQ-2024-014',
    attachments: ['هوية نقابية', 'رخصة ممارسة', 'اعتماد اختصاص'],
    status: 'approved',
    submittedAt: '03 فبراير 2026',
    profileScore: 93,
  },
  {
    id: 'lawyer-3',
    name: 'علي الجبوري',
    specialty: 'عقارات',
    location: 'البصرة',
    experience: '10 سنوات خبرة',
    experienceYears: 10,
    availability: 'متاح هذا المساء',
    isOnline: false,
    rating: 4.7,
    reviews: '84 مراجعة',
    reviewCount: 84,
    casesHandled: '+145 قضية',
    consultationFee: '35,000 د.ع',
    verified: true,
    accent: 'from-[#3f2b1d] via-[#8b5a3c] to-[#d7a36a]',
    avatar: 'https://ui-avatars.com/api/?name=Ali+Jubouri&background=3f2b1d&color=ffffff&rounded=true&font-size=0.4',
    tagline: 'صياغة عقود عقارية وتسوية نزاعات الملكية بثقة',
    followers: 742,
    responseTime: 'يرد خلال 45 دقيقة',
    bio: 'يتابع ملفات التسجيل العقاري ونقل الملكية وعقود البيع والإيجار، مع اهتمام كبير بدقة المستندات وسلامة الإجراءات.',
    highlights: ['توثيق العقود', 'نزاعات الملكية', 'مراجعة سندات العقار'],
    license: 'IRQ-2024-023',
    attachments: ['هوية نقابية', 'رخصة ممارسة'],
    status: 'approved',
    submittedAt: '17 فبراير 2026',
    profileScore: 88,
  },
  {
    id: 'lawyer-4',
    name: 'رنا السامرائي',
    specialty: 'أحوال شخصية',
    location: 'أربيل',
    experience: '9 سنوات خبرة',
    experienceYears: 9,
    availability: 'متاحة الآن',
    isOnline: true,
    rating: 4.9,
    reviews: '104 مراجعة',
    reviewCount: 104,
    casesHandled: '+110 قضية',
    consultationFee: '45,000 د.ع',
    verified: true,
    accent: 'from-[#4a1d5e] via-[#7c2d92] to-[#db2777]',
    avatar: 'https://ui-avatars.com/api/?name=%D8%B1%D9%86%D8%A7%20%D8%A7%D9%84%D8%B3%D8%A7%D9%85%D8%B1%D8%A7%D8%A6%D9%8A&background=4a1d5e&color=ffffff&rounded=true&font-size=0.4',
    tagline: 'تعامل هادئ وسري مع قضايا الأسرة والأحوال الشخصية',
    followers: 1102,
    responseTime: 'يرد خلال 30 دقيقة',
    bio: 'تعمل على قضايا الأسرة والنفقة والحضانة وصياغة الاتفاقات الأسرية بنبرة مهنية مطمئنة وسرية عالية.',
    highlights: ['استشارات أسرية', 'قضايا الحضانة', 'إجراءات النفقة والطلاق'],
    license: 'IRQ-2024-031',
    attachments: ['هوية نقابية', 'رخصة ممارسة', 'اعتماد اختصاص'],
    status: 'approved',
    submittedAt: '26 فبراير 2026',
    profileScore: 94,
  },
];

export function getLawyerById(id?: string | null) {
  return LAWYER_DIRECTORY.find((lawyer) => lawyer.id === id) ?? LAWYER_DIRECTORY[0];
}

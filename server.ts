import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { answerQuestion, buildLocalAnswer, getTopRelevantDocuments } from './src/server/iraqiLawDataset';
import { hashPassword, verifyPassword, generateToken, verifyToken, getTokenFromHeader } from './src/server/auth';
import { Server } from 'socket.io';
import { createServer } from 'http';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import { prisma } from './src/server/prisma';
import {
  getAdminMetrics,
  getAuditLogs,
  getExportCsv,
  getKycApplications,
  getSecurityAlerts,
  getTransactionRecords,
  updateKycApplication,
  getUsers,
  getUserById,
  updateUserProfile,
  updateUserRole,
  toggleUserBlock,
  getFeatureFlags,
  updateFeatureFlag,
  getSupportTickets,
  updateSupportTicket,
  getPolicies,
  updatePolicySetting,
  getSystemSettings,
  updateSystemSettings,
  getAiSettings,
  updateAiSettings,
  getPaymentGateways,
  updatePaymentGateway,
  getWorkflowSettings,
  updateWorkflowSettings,
  getNotificationTemplates,
  updateNotificationTemplate,
  getModerationRules,
  updateModerationRule,
  addModerationRule,
  deleteModerationRule,
  getLegalDocs,
  createUser, // Import the new createUser function
  addLegalDoc,
  updateLegalDoc,
  deleteLegalDoc,
} from './src/server/adminData';
import {
  changeCurrentUserPassword,
  followLawyer,
  getCurrentUserProfile,
  getFollowingLawyers,
  getLawyerProfile,
  getLawyers,
  getUserDashboard,
  getUserSettingsBundle,
  addCreditBalance,
  revokeSession,
  unfollowLawyer,
  updateCurrentUserPreferences,
  updateCurrentUserProfile,
  deductFromWalletForService,
} from './src/server/appData';
import {
  addCaseCollaborator,
  addCaseCustomField,
  addCaseDocument,
  addCaseFolder,
  addCaseMessage,
  createClientCase,
  createProAppointment,
  createProCase,
  deleteCaseWorkspace,
  deleteProCases,
  getClientWorkspace,
  getLawyerWorkspace,
  getProWorkspace,
  moveCaseDocuments,
  removeCaseCollaborator,
  signCaseDocument,
  reviewCaseDocument,
  clearDocumentAction,
  finalizeContract,
  startLawyerConsultation,
  toggleCaseArchive,
  updateCaseProgress,
  markCaseMessagesAsRead,
  // ... other imports
  mapWorkspaceCase,
  updateProCaseStatuses,
  updateProMessageState,
  uploadProVaultDocument,
} from './src/server/workspaceData';

// Constants for Legal Fees
const CONTRACT_CREATION_FEE = 25000;
const LAWYER_REVIEW_FEE = 15000;
const PROMO_CODE_DISCOUNT = 10000; // خصم ثابت لكود الخصم

dotenv.config({ path: '.env.local' });
dotenv.config();

type ToneMode = 'formal' | 'simple' | 'friendly';

type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const TONE_INSTRUCTIONS: Record<ToneMode, string> = {
  formal: 'اعتمد أسلوباً رسمياً كلاسيكياً، دقيقاً، ومناسباً للمحامين والباحثين القانونيين.',
  simple: 'اعتمد أسلوباً مبسطاً موجهاً لعامة الناس، مع شرح المصطلحات الصعبة بلغة مباشرة.',
  friendly: 'اعتمد أسلوباً ودوداً ومهنياً في الوقت نفسه، مع نبرة داعمة وواضحة.',
};

const buildGeminiSystemPrompt = (tone: ToneMode, referenceSummary: string) => `أنت خبير في القانون العراقي، ومساعد قانوني متخصص في التشريعات والإجراءات العراقية. تعمل ضمن منصة "القسطاس الذكي".

التعليمات الأساسية:
- أجب دائماً بالعربية الفصحى.
- اعتبر نفسك مرشداً قانونياً معلوماتياً، وليس بديلاً عن المحامي أو الاستشارة القانونية النهائية.
- استند قدر الإمكان إلى المراجع العراقية المتاحة في السؤال الحالي.
- **مهم جداً**: استخدم الأرقام بين أقواس مربعة مثل [1]، [2] للإشارة إلى المرجع القانوني الذي استقيت منه المعلومة في سياق النص.
- إذا كانت المراجع غير كافية، صرّح بذلك بوضوح ولا تختلق مواد قانونية غير موجودة.
- نظّم الإجابة بصيغة Markdown احترافية مع عناوين واضحة (Headings) ونقاط (Bullet points).
- اختم عند الاقتضاء بتنبيه قصير يوضح أن الجواب معلوماتي عام.
- ${TONE_INSTRUCTIONS[tone]}

المراجع القانونية المتاحة لهذه الإجابة:
${referenceSummary || 'لا توجد مراجع مطابقة بشكل مباشر في قاعدة البيانات الحالية.'}`;

const mapHistoryToGeminiContents = (history: ChatHistoryItem[], latestQuestion: string) => {
  const recentTurns = (history || []).slice(-10);
  const processedHistory: any[] = [];

  recentTurns.forEach((item) => {
    const role = item.role === 'assistant' ? 'model' : 'user';
    // Gemini requires alternating roles (user -> model -> user)
    if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === role) {
      processedHistory[processedHistory.length - 1].parts[0].text += `\n${item.content}`;
    } else {
      processedHistory.push({ role, parts: [{ text: item.content }] });
    }
  });

  // Ensure the chain doesn't end with a user message before we add the latest question
  if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === 'user') {
    processedHistory[processedHistory.length - 1].parts[0].text += `\n${latestQuestion}`;
    return processedHistory;
  }

  return [
    ...processedHistory,
    {
      role: 'user',
      parts: [{ text: latestQuestion }],
    },
  ];
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  // Diagnostic: List available Gemini models on startup
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
      const data = await response.json() as any;
      if (data.models) {
        console.log('🤖 [AI-Discovery] Available Models for your API Key:');
        data.models.forEach((m: any) => console.log(`   - ${m.name}`));
      } else {
        console.warn('⚠️ [AI-Discovery] Could not retrieve models. Check your API key permissions.', data);
      }
    } catch (err) {
      console.error('❌ [AI-Discovery] Failed to connect to Gemini discovery service:', err);
    }
  }

  const PORT = Number(process.env.PORT || 3000);
  const adminBootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  // Setup uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure multer for document uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('نوع الملف غير مدعوم. استخدم JPG, PNG, أو PDF فقط.'));
    }

    cb(null, true);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // Socket.io Connection Logic
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string;
    if (userId) {
      socket.join(userId);
      console.log(`📡 User connected & joined room: ${userId}`);
    }

    socket.on('disconnect', () => {
      console.log('📡 User disconnected');
    });
  });

  app.use(express.json());
  app.use(cors());

  // Authentication Middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = getTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    (req as any).user = decoded;
    next();
  };

  // Optional Authentication Middleware (doesn't block if no token)
  const optionalAuthenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = getTokenFromHeader(authHeader);

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        (req as any).user = decoded;
      }
    }

    next();
  };

  const adminOnly = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // ============================================
  // Authentication Routes
  // ============================================

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name, role = 'user' } = req.body;
      const requestedRole = role as 'user' | 'pro' | 'admin';
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const normalizedName = typeof name === 'string' ? name.trim() : '';

      if (!normalizedEmail || !password || !normalizedName) {
        return res.status(400).json({ error: 'البريد الإلكتروني والاسم وكلمة المرور مطلوبة.' });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
      }

      if (!['user', 'pro', 'admin'].includes(requestedRole)) {
        return res.status(400).json({ error: 'نوع الحساب غير صالح.' });
      }

      if (requestedRole === 'admin') {
        const existingAdminCount = await prisma.user.count({
          where: { role: 'admin' },
        });

        if (existingAdminCount > 0) {
          return res.status(403).json({ error: 'تسجيل حسابات الإدارة غير متاح.' });
        }

        if (!adminBootstrapSecret) {
          return res.status(500).json({ error: 'تهيئة حساب الإدارة غير مكتملة.' });
        }

        if (req.body.adminBootstrapSecret !== adminBootstrapSecret) {
          return res.status(403).json({ error: 'بيانات إنشاء حساب الإدارة غير صحيحة.' });
        }
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return res.status(409).json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل.' });
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash: hashedPassword,
            name: normalizedName,
            role: requestedRole as any,
            verified: false,
            blocked: false,
          },
        });

        if (requestedRole === 'pro') {
          await tx.lawyerProfile.create({
            data: {
              userId: createdUser.id,
              licenseStatus: 'pending',
              submittedAt: 'اليوم',
              profileScore: 15,
            },
          });
        }

        return createdUser;
      });

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role as any,
      });

      res.status(201).json({
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            verified: user.verified,
            accountBalance: user.accountBalance,
            licenseStatus: requestedRole === 'pro' ? 'pending' : undefined,
          },
        },
        message: 'تم إنشاء الحساب بنجاح.',
      });
    } catch (error: any) {
      console.error('Registration error:', error);

      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل.' });
      }

      res.status(500).json({ error: 'تعذر إنشاء الحساب. حاول مرة أخرى.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { lawyerProfile: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const passwordValid = await verifyPassword(password, user.passwordHash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.blocked) {
        return res.status(403).json({ error: 'Account is blocked' });
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role as any,
      });

      res.json({
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            verified: user.verified,
            accountBalance: user.accountBalance,
            licenseStatus: user.lawyerProfile?.licenseStatus || 'pending',
          },
        },
        message: 'Login successful',
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // ============================================
  // Protected Routes - User Management
  // ============================================

  app.get('/api/users', authenticateToken, async (req, res) => {
    try {
      const users = await getUsers();
      res.json({ data: users });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get('/api/users/:id', authenticateToken, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ data: user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = (req as any).user;

      // Users can only update their own profile unless they're admin
      if (currentUser.userId !== id && currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to update this user' });
      }

      const updated = await updateUserProfile(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ data: updated, message: 'Profile updated successfully' });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // ============================================
  // App Routes - User/Profile/Following/Settings
  // ============================================

  app.get('/api/me', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const profile = await getCurrentUserProfile(currentUser.userId);
      if (!profile) return res.status(404).json({ error: 'User not found' });
      res.json({ data: profile });
    } catch (error) {
      console.error('Fetch current user error:', error);
      res.status(500).json({ error: 'Failed to fetch current user' });
    }
  });

  app.get('/api/app/dashboard', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await getUserDashboard(currentUser.userId) });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });

  app.post('/api/app/billing/top-up', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const data = await addCreditBalance(currentUser.userId, {
        amount: Number(req.body.amount),
        paymentMethod: req.body.paymentMethod,
        note: req.body.note,
      });
      res.status(201).json({ data, message: 'تمت إضافة الرصيد بنجاح.' });
    } catch (error) {
      console.error('Billing top-up error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'فشل إضافة الرصيد.' });
    }
  });

  app.get('/api/app/settings', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await getUserSettingsBundle(currentUser.userId) });
    } catch (error) {
      console.error('Settings load error:', error);
      res.status(500).json({ error: 'Failed to load settings' });
    }
  });

  app.put('/api/app/settings/profile', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await updateCurrentUserProfile(currentUser.userId, req.body) });
    } catch (error) {
      console.error('Settings profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.put('/api/app/settings/preferences', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await updateCurrentUserPreferences(currentUser.userId, req.body) });
    } catch (error) {
      console.error('Settings preferences update error:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  app.post('/api/app/settings/password', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      const result = await changeCurrentUserPassword(currentUser.userId, currentPassword, newPassword);
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  app.post('/api/support/request', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const { name, phone, subject, message } = req.body;

      if (!name || !phone || !subject || !message) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة.' });
      }

      const normalizedPhone = phone.toString().replace(/\D/g, '');
      if (!/^[0-9]{10}$/.test(normalizedPhone)) {
        return res.status(400).json({ error: 'يرجى إدخال رقم جوال عراقي صحيح بدون رمز الدولة.' });
      }

      const ticket = await prisma.supportTicket.create({
        data: {
          userId: currentUser.userId,
          subject: `${subject} • +964${normalizedPhone}`,
          priority: 'medium',
        },
      });

      console.log(`New support request from ${name} (+964${normalizedPhone}): ${subject}`);
      res.status(201).json({ data: ticket, message: 'تم إرسال طلب الدعم بنجاح.' });
    } catch (error) {
      console.error('Support request error:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء إرسال طلب الدعم. حاول مرة أخرى.' });
    }
  });

  app.delete('/api/app/settings/sessions/:id', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      await revokeSession(currentUser.userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Session revoke error:', error);
      res.status(500).json({ error: 'Failed to revoke session' });
    }
  });

  app.get('/api/app/lawyers', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      res.json({ data: await getLawyers(currentUser.userId, search) });
    } catch (error) {
      console.error('Lawyers listing error:', error);
      res.status(500).json({ error: 'Failed to fetch lawyers' });
    }
  });

  app.get('/api/app/following', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await getFollowingLawyers(currentUser.userId) });
    } catch (error) {
      console.error('Following listing error:', error);
      res.status(500).json({ error: 'Failed to fetch following list' });
    }
  });

  app.get('/api/app/lawyers/:id', optionalAuthenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const profile = await getLawyerProfile(req.params.id, currentUser?.userId);
      if (!profile) return res.status(404).json({ error: 'Lawyer not found' });
      res.json({ data: profile });
    } catch (error) {
      console.error('Lawyer profile error:', error);
      res.status(500).json({ error: 'Failed to fetch lawyer profile' });
    }
  });

  app.post('/api/app/lawyers/:id/follow', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const data = await followLawyer(currentUser.userId, req.params.id);
      res.json({ data, success: true });
    } catch (error) {
      console.error('Follow lawyer error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to follow lawyer' });
    }
  });

  app.delete('/api/app/lawyers/:id/follow', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const data = await unfollowLawyer(currentUser.userId, req.params.id);
      res.json({ data, success: true });
    } catch (error) {
      console.error('Unfollow lawyer error:', error);
      res.status(500).json({ error: 'Failed to unfollow lawyer' });
    }
  });

  app.post('/api/app/lawyers/:id/consultation', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (currentUser.role !== 'user') {
        return res.status(403).json({ error: 'بدء الاستشارة متاح لحسابات العملاء فقط.' });
      }

      const { paymentMethod, note } = req.body;
      if (!paymentMethod) {
        return res.status(400).json({ error: 'يرجى اختيار طريقة الدفع أولاً.' });
      }

      const data = await startLawyerConsultation(currentUser.userId, {
        lawyerId: req.params.id,
        paymentMethod,
        note,
      });

      const notification = await prisma.notification.create({
        data: {
          userId: data.caseData.lawyerId,
          title: 'استشارة جديدة مدفوعة',
          message: `قام عميل بحجز استشارة جديدة بعنوان: ${data.caseData.title}`,
          type: 'success',
          link: '/messages',
        },
      });

      io.to(data.caseData.lawyerId).emit('notification', notification);
      res.status(201).json({ data });
    } catch (error) {
      console.error('Start consultation error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to start consultation' });
    }
  });

  app.get('/api/app/workspace/cases', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const data = currentUser.role === 'pro' || currentUser.role === 'admin'
        ? await getLawyerWorkspace(currentUser.userId)
        : await getClientWorkspace(currentUser.userId);
      res.json({ data });
    } catch (error) {
      console.error('Workspace cases error:', error);
      res.status(500).json({ error: 'Failed to fetch workspace cases' });
    }
  });

  app.post('/api/app/workspace/cases', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const { title, matter, lawyerId, totalAgreedFee, caseType } = req.body;

      if (!title || !matter || !lawyerId) {
        return res.status(400).json({ error: 'عنوان القضية ونوعها والمحامي المسؤول مطلوبة.' });
      }

      const data = await createClientCase(currentUser.userId, { title, matter, lawyerId, totalAgreedFee, caseType });
      res.status(201).json({ data });
    } catch (error) {
      console.error('Create workspace case error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'تعذر إنشاء القضية.' });
    }
  });

  // Persist Private Notes for Lawyers
  app.patch('/api/app/workspace/cases/:id/private-note', authenticateToken, async (req, res) => {
    try {
      const { note } = req.body;
      const updated = await prisma.case.update({
        where: { id: req.params.id },
        data: { privateNote: note }
      });
      res.json({ data: updated });
    } catch (error) {
      console.error('Update private note error:', error);
      res.status(500).json({ error: 'Failed to update private note' });
    }
  });

  // Persist Case Progress
  app.patch('/api/app/workspace/cases/:id/progress', authenticateToken, async (req, res) => {
    try {
      const { progress } = req.body;
      const updated = await updateCaseProgress(req.params.id, Number(progress));
      res.json({ data: updated });
    } catch (error) {
      console.error('Update progress error:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  });

  app.post('/api/app/workspace/cases/:id/archive', authenticateToken, async (req, res) => {
    try {
      res.json({ data: await toggleCaseArchive(req.params.id) });
    } catch (error) {
      console.error('Archive case error:', error);
      res.status(500).json({ error: 'Failed to archive case' });
    }
  });

  app.delete('/api/app/workspace/cases/:id', authenticateToken, async (req, res) => {
    try {
      await deleteCaseWorkspace(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete case error:', error);
      res.status(500).json({ error: 'Failed to delete case' });
    }
  });

  app.post('/api/app/workspace/cases/:id/collaborators', authenticateToken, async (req, res) => {
    try {
      const { email, role, permissions } = req.body;
      res.json({ data: await addCaseCollaborator(req.params.id, { email, role, permissions }) });
    } catch (error) {
      console.error('Add collaborator error:', error);
      res.status(500).json({ error: 'Failed to add collaborator' });
    }
  });

  app.delete('/api/app/workspace/cases/:caseId/collaborators/:collaboratorId', authenticateToken, async (req, res) => {
    try {
      res.json({ data: await removeCaseCollaborator(req.params.caseId, req.params.collaboratorId) });
    } catch (error) {
      console.error('Remove collaborator error:', error);
      res.status(500).json({ error: 'Failed to remove collaborator' });
    }
  });

  app.post('/api/app/workspace/cases/:id/folders', authenticateToken, async (req, res) => {
    try {
      res.json({ data: await addCaseFolder(req.params.id, req.body.name) });
    } catch (error) {
      console.error('Add folder error:', error);
      res.status(500).json({ error: 'Failed to add folder' });
    }
  });

  app.post('/api/app/workspace/cases/:id/custom-fields', authenticateToken, async (req, res) => {
    try {
      const { label, value } = req.body;
      res.json({ data: await addCaseCustomField(req.params.id, label, value) });
    } catch (error) {
      console.error('Add custom field error:', error);
      res.status(500).json({ error: 'Failed to add custom field' });
    }
  });

  app.post('/api/app/workspace/cases/:id/documents/move', authenticateToken, async (req, res) => {
    try {
      const { documentIds, folderId } = req.body;
      res.json({ data: await moveCaseDocuments(req.params.id, documentIds, folderId ?? null) });
    } catch (error) {
      console.error('Move documents error:', error);
      res.status(500).json({ error: 'Failed to move documents' });
    }
  });

  app.post('/api/app/workspace/cases/:caseId/documents', authenticateToken, async (req, res) => {
    try {
      res.json({ data: await addCaseDocument(req.params.caseId, req.body) });
    } catch (error) {
      console.error('Add document error:', error);
      res.status(500).json({ error: 'Failed to add document' });
    }
  });

  app.post('/api/app/workspace/cases/:caseId/documents/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'لم يتم اختيار ملف للرفع' });
      }

      const { caseId } = req.params;
      const currentUser = (req as any).user;
      const fileUrl = `/uploads/${req.file.filename}`;
      const senderRole = currentUser.role === 'pro' || currentUser.role === 'admin' ? 'lawyer' : 'user';

      const document = await prisma.document.create({
        data: {
          caseId,
          name: req.file.originalname,
          fileUrl,
          previewUrl: fileUrl,
          size: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
          type: req.file.mimetype.includes('pdf') ? 'pdf' : 'image',
          status: 'Draft',
          tags: '[]',
        },
      });

      // Automatically send a message about the new document
      const updatedCase = await addCaseMessage(caseId, currentUser.userId, `رفع ${senderRole === 'lawyer' ? 'المحامي' : 'العميل'} وثيقة جديدة: ${req.file.originalname}`, senderRole);

      res.json({ data: updatedCase, document });
    } catch (error) {
      console.error('Chat document upload error:', error);
      res.status(500).json({ error: 'فشل رفع المستند' });
    }
  });

  app.post('/api/app/workspace/cases/:caseId/documents/:documentId/sign', authenticateToken, async (req, res) => {
    try {
      res.json({ data: await signCaseDocument(req.params.caseId, req.params.documentId) });
    } catch (error) {
      console.error('Sign document error:', error);
      res.status(500).json({ error: 'Failed to sign document' });
    }
  });

  app.post('/api/app/workspace/cases/:caseId/documents/:documentId/review', authenticateToken, async (req, res) => {
    try {
      const { status, note } = req.body;
      res.json({ data: await reviewCaseDocument(req.params.caseId, req.params.documentId, status, note) });
    } catch (error) {
      console.error('Review document error:', error);
      res.status(500).json({ error: 'Failed to review document' });
    }
  });

  app.post('/api/app/workspace/cases/:caseId/documents/:documentId/clear-action', authenticateToken, async (req, res) => {
    try {
      res.json({ data: await clearDocumentAction(req.params.caseId, req.params.documentId) });
    } catch (error) {
      console.error('Clear document action error:', error);
      res.status(500).json({ error: 'Failed to clear document action' });
    }
  });

  app.post('/api/app/workspace/cases/:id/mark-read', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const updatedCase = await markCaseMessagesAsRead(req.params.id, currentUser.userId);
      if (!updatedCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      res.json({ data: mapWorkspaceCase(updatedCase) });
    } catch (error) {
      console.error('Mark messages as read error:', error);
      res.status(500).json({ error: 'Failed to mark messages as read' });
    }
  });

  app.post('/api/app/workspace/cases/:id/messages', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      // Derive the role from the token rather than the body for security
      const senderRole = currentUser.role === 'pro' ? 'lawyer' : 'user';
      const { text } = req.body;
      const caseData = await addCaseMessage(req.params.id, currentUser.userId, text, senderRole);

      // Determine recipient (if sender is user, recipient is lawyer, and vice versa)
      const recipientId = senderRole === 'user' ? caseData.lawyerId : caseData.clientId;

      // Create System Notification
      const notification = await prisma.notification.create({
        data: {
          userId: recipientId,
          title: 'رسالة جديدة',
          message: `لديك رسالة جديدة في قضية: ${caseData.title}`,
          type: 'info',
          link: senderRole === 'user' ? '/pro' : '/cases'
        }
      });

      // Real-time Push via Socket.io
      io.to(recipientId).emit('notification', notification);

      res.json({ data: caseData });
    } catch (error) {
      console.error('Add message error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to send message' });
    }
  });

  app.get('/api/app/pro/workspace', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await getProWorkspace(currentUser.userId) });
    } catch (error) {
      console.error('Pro workspace error:', error);
      res.status(500).json({ error: 'Failed to fetch pro workspace' });
    }
  });

  app.post('/api/app/pro/workspace/cases', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await createProCase(currentUser.userId, req.body) });
    } catch (error) {
      console.error('Create pro case error:', error);
      res.status(500).json({ error: 'Failed to create pro case' });
    }
  });

  app.post('/api/app/pro/workspace/appointments', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await createProAppointment(currentUser.userId, req.body) });
    } catch (error) {
      console.error('Create appointment error:', error);
      res.status(500).json({ error: 'Failed to create appointment' });
    }
  });

  app.post('/api/app/pro/workspace/vault-upload', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await uploadProVaultDocument(currentUser.userId, req.body.caseId ?? null) });
    } catch (error) {
      console.error('Vault upload error:', error);
      res.status(500).json({ error: 'Failed to upload vault document' });
    }
  });

  app.post('/api/app/pro/workspace/messages/:id', authenticateToken, async (req, res) => {
    try {
      await updateProMessageState(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('Update message state error:', error);
      res.status(500).json({ error: 'Failed to update message state' });
    }
  });

  app.post('/api/app/pro/workspace/cases/status', authenticateToken, async (req, res) => {
    try {
      const { caseIds, status } = req.body;
      await updateProCaseStatuses(caseIds, status);
      res.json({ success: true });
    } catch (error) {
      console.error('Bulk case status error:', error);
      res.status(500).json({ error: 'Failed to update case status' });
    }
  });

  app.post('/api/app/pro/workspace/cases/delete', authenticateToken, async (req, res) => {
    try {
      const { caseIds } = req.body;
      await deleteProCases(caseIds);
      res.json({ success: true });
    } catch (error) {
      console.error('Bulk delete cases error:', error);
      res.status(500).json({ error: 'Failed to delete cases' });
    }
  });

  // ============================================
  // Admin Routes
  // ============================================

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/admin/metrics', authenticateToken, adminOnly, async (req, res) => {
    res.json(await getAdminMetrics());
  });

  app.get('/api/kyc/applications', authenticateToken, adminOnly, async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json(await getKycApplications(search, status as any));
  });

  app.post('/api/kyc/applications/:id', authenticateToken, adminOnly, async (req, res) => {
    const { status } = req.body;
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }

    const updated = await updateKycApplication(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'application not found' });
    }

    return res.json({ success: true, application: updated });
  });

  app.get('/api/admin/alerts', authenticateToken, adminOnly, async (req, res) => {
    res.json(await getSecurityAlerts());
  });

  app.get('/api/admin/audit-logs', authenticateToken, adminOnly, async (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    res.json(await getAuditLogs(type));
  });

  app.get('/api/admin/transactions', authenticateToken, adminOnly, async (req, res) => {
    res.json(await getTransactionRecords());
  });

  app.put('/api/admin/users/:id', async (req, res) => {
    const updated = await updateUserProfile(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'user not found' });
    }
    return res.json(updated);
  });

  app.post('/api/admin/users/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!['user', 'pro', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be user, pro, or admin' });
    }
    const updated = await updateUserRole(req.params.id, role);
    if (!updated) {
      return res.status(404).json({ error: 'user not found' });
    }
    return res.json(updated);
  });

  app.post('/api/admin/users/:id/block', async (req, res) => {
    const updated = await toggleUserBlock(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'user not found' });
    }
    return res.json(updated);
  });

  app.post('/api/admin/users', authenticateToken, adminOnly, async (req, res) => {
    try {
      const { email, password, name, role = 'user' } = req.body;
      const requestedRole = role as 'user' | 'pro' | 'admin';
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const normalizedName = typeof name === 'string' ? name.trim() : '';

      if (!normalizedEmail || !password || !normalizedName) {
        return res.status(400).json({ error: 'البريد الإلكتروني والاسم وكلمة المرور مطلوبة.' });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
      }

      if (!['user', 'pro', 'admin'].includes(requestedRole)) {
        return res.status(400).json({ error: 'نوع الحساب غير صالح.' });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return res.status(409).json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل.' });
      }

      const hashedPassword = await hashPassword(password);
      const newUser = await createUser({
        email: normalizedEmail,
        passwordHash: hashedPassword,
        name: normalizedName,
        role: requestedRole,
      });

      if (!newUser) {
        return res.status(500).json({ error: 'تعذر إنشاء الحساب.' });
      }

      // Create an audit log entry for the action
      await prisma.auditLog.create({
        data: {
          type: 'system',
          category: 'إدارة المستخدمين',
          actor: (req as any).user.email,
          message: `قام المسؤول بإنشاء حساب جديد: ${newUser.name} (${newUser.email}) برتبة ${newUser.role}`,
          time: new Date().toLocaleTimeString('ar-IQ'),
        }
      });

      res.status(201).json({
        data: newUser,
        message: 'تم إنشاء الحساب بنجاح.',
      });
    } catch (error: any) {
      console.error('Admin user creation error:', error);
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل.' });
      }
      res.status(500).json({ error: 'تعذر إنشاء الحساب. حاول مرة أخرى.' });
    }
  });

  app.get('/api/admin/feature-flags', async (req, res) => {
    res.json(await getFeatureFlags());
  });

  app.post('/api/admin/feature-flags/:key', async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }
    const updated = await updateFeatureFlag(req.params.key, enabled);
    if (!updated) {
      return res.status(404).json({ error: 'feature flag not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/support-tickets', async (req, res) => {
    res.json(await getSupportTickets());
  });

  app.post('/api/admin/support-tickets/:id', async (req, res) => {
    const { status } = req.body;
    if (!['open', 'pending', 'resolved', 'escalated'].includes(status)) {
      return res.status(400).json({ error: 'invalid ticket status' });
    }
    const updated = await updateSupportTicket(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'ticket not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/policies', async (req, res) => {
    res.json(await getPolicies());
  });

  app.post('/api/admin/policies/:key', async (req, res) => {
    const { value } = req.body;
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'value must be a string' });
    }
    const updated = await updatePolicySetting(req.params.key, value);
    if (!updated) {
      return res.status(404).json({ error: 'policy not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/system-settings', async (req, res) => {
    res.json(await getSystemSettings());
  });

  app.post('/api/admin/system-settings', async (req, res) => {
    const updated = await updateSystemSettings(req.body);
    return res.json(updated);
  });

  app.get('/api/admin/ai-settings', async (req, res) => {
    res.json(await getAiSettings());
  });

  app.post('/api/admin/ai-settings', async (req, res) => {
    const updated = await updateAiSettings(req.body);
    return res.json(updated);
  });

  app.get('/api/admin/payment-gateways', async (req, res) => {
    res.json(await getPaymentGateways());
  });

  app.post('/api/admin/payment-gateways/:key', async (req, res) => {
    const { enabled, feePercent } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }
    const updated = await updatePaymentGateway(req.params.key, enabled, feePercent);
    if (!updated) {
      return res.status(404).json({ error: 'payment gateway not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/workflow-settings', async (req, res) => {
    res.json(await getWorkflowSettings());
  });

  app.post('/api/admin/workflow-settings', async (req, res) => {
    const updated = await updateWorkflowSettings(req.body);
    return res.json(updated);
  });

  app.get('/api/admin/notification-templates', async (req, res) => {
    res.json(await getNotificationTemplates());
  });

  app.post('/api/admin/notification-templates/:key', async (req, res) => {
    const updated = await updateNotificationTemplate(req.params.key, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'notification template not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/moderation-rules', async (req, res) => {
    res.json(await getModerationRules());
  });

  app.post('/api/admin/moderation-rules', async (req, res) => {
    const { type, value, active } = req.body;
    if (!type || !value) {
      return res.status(400).json({ error: 'type and value are required' });
    }
    const newRule = await addModerationRule({ type, value, active: active !== false });
    return res.status(201).json(newRule);
  });

  app.post('/api/admin/moderation-rules/:id', async (req, res) => {
    const updated = await updateModerationRule(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'moderation rule not found' });
    }
    return res.json(updated);
  });

  app.delete('/api/admin/moderation-rules/:id', async (req, res) => {
    if (!(await deleteModerationRule(req.params.id))) {
      return res.status(404).json({ error: 'moderation rule not found' });
    }
    return res.json({ success: true });
  });

  app.get('/api/admin/legal-docs', async (req, res) => {
    res.json(await getLegalDocs());
  });

  app.post('/api/admin/legal-docs', async (req, res) => {
    const { title, law, article, category, summary, source } = req.body;
    if (!title || !law || !article || !category || !summary || !source) {
      return res.status(400).json({ error: 'missing document fields' });
    }
    const newDoc = await addLegalDoc({ title, law, article, category, summary, source });
    return res.status(201).json(newDoc);
  });

  app.delete('/api/admin/legal-docs/:id', async (req, res) => {
    if (!(await deleteLegalDoc(req.params.id))) {
      return res.status(404).json({ error: 'document not found' });
    }
    return res.json({ success: true });
  });

  app.put('/api/admin/legal-docs/:id', async (req, res) => {
    const updated = await updateLegalDoc(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'document not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/export', (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : 'kyc';
    if (type !== 'kyc' && type !== 'transactions') {
      return res.status(400).json({ error: 'type must be kyc or transactions' });
    }
    const csv = getExportCsv(type);
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${type}-export.csv"`);
    return res.send(csv);
  });

  // ============================================
  // AI Drafting Route (Phase 4)
  // ============================================

  app.post('/api/legal/draft', authenticateToken, async (req, res) => {
    const { docType, caseContext, specificRequirements } = req.body;

    try {
      if (!geminiClient) throw new Error('AI service disabled');

      const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Ensures stable model ID
      const prompt = `أنت مساعد قانوني عراقي محترف. قم بصياغة مسودة لـ ${docType}. 
      سياق القضية: ${caseContext}. 
      متطلبات إضافية: ${specificRequirements}.
      استخدم المصطلحات القانونية العراقية المعاصرة. اجعل المسودة منظمة بوضوح مع فراغات للبيانات الشخصية (مثل [الاسم]، [رقم الهوية]).`;

      const result = await model.generateContent(prompt);
      const draftText = result.response.text();

      res.json({ data: { draft: draftText } });
    } catch (error) {
      console.error('Drafting failed:', error);
      res.status(500).json({ error: 'فشل في توليد المسودة' });
    }
  });

  // Route for scheduling reminders (as used by ContractWizard.tsx)
  app.post('/api/legal/schedule-reminder', authenticateToken, async (req, res) => {
    const { contractId, phone, name, hours } = req.body;
    // In a real application, you would integrate with a reminder service here (e.g., Twilio, a cron job).
    // For now, we'll just log it and return success.
    console.log(`[REMINDER] Scheduled reminder for contract ${contractId} for ${name} (${phone}) in ${hours} hours.`);
    res.json({ success: true, message: 'تم جدولة التذكير بنجاح.' });
  });

  // Route for securing document downloads with a special token
  app.get('/api/legal/document/:filename', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    const { token } = req.query;


    // في بيئة الإنتاج، يتم التحقق من التوكن مقابل قاعدة البيانات أو فك تشفيره
    if (!token || token.length < 20) {
      return res.status(403).json({ error: 'رابط غير صالِح أو انتهت صلاحيته.' });
    }

    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'المستند غير موجود.' });
    }
  });

  // Utility for Arabic Tafqeet (Simplified)
  function tafqeet(amount: number, currency: 'IQD' | 'USD'): string {
    const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
    const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

    if (amount === 0) return "صفر";

    const convertLessThanOneThousand = (n: number): string => {
      let res = "";
      if (n >= 100) {
        res += hundreds[Math.floor(n / 100)];
        n %= 100;
        if (n > 0) res += " و ";
      }
      if (n >= 20) {
        const unit = n % 10;
        if (unit > 0) res += units[unit] + " و ";
        res += tens[Math.floor(n / 10)];
      } else if (n >= 10) {
        res += teens[n - 10];
      } else if (n > 0) {
        res += units[n];
      }
      return res;
    };

    const convert = (n: number): string => {
      if (n === 0) return "";
      if (n < 1000) return convertLessThanOneThousand(n);
      if (n < 1000000) {
        const thousands = Math.floor(n / 1000);
        const remainder = n % 1000;
        let res = "";
        if (thousands === 1) res = "ألف";
        else if (thousands === 2) res = "ألفان";
        else if (thousands >= 3 && thousands <= 10) res = convertLessThanOneThousand(thousands) + " آلاف";
        else res = convertLessThanOneThousand(thousands) + " ألف";
        if (remainder > 0) res += " و " + convert(remainder);
        return res;
      }
      if (n < 1000000000) {
        const millions = Math.floor(n / 1000000);
        const remainder = n % 1000000;
        let res = "";
        if (millions === 1) res = "مليون";
        else if (millions === 2) res = "مليونان";
        else if (millions >= 3 && millions <= 10) res = convertLessThanOneThousand(millions) + " ملايين";
        else res = convertLessThanOneThousand(millions) + " مليون";
        if (remainder > 0) res += " و " + convert(remainder);
        return res;
      }
      return n.toString();
    };

    const words = convert(amount);
    const currencyName = currency === 'USD' ? 'دولار أمريكي' : 'دينار عراقي';
    return `${words} ${currencyName} لا غير`;
  }

  // Utility to sanitize user input strings from HTML tags to prevent XSS
  function sanitizeInput(val: any): string {
    if (typeof val !== 'string') return '';
    return val.replace(/<[^>]*>?/gm, '').trim();
  }

  // Route for generating car contracts (as used by ContractWizard.tsx)
  app.post('/api/legal/car-contract', authenticateToken, async (req, res) => {
    try {
      // Use local template generation to avoid AI errors and costs
      const sellerName = sanitizeInput(req.body.sellerName);
      const buyerName = sanitizeInput(req.body.buyerName);
      const carModel = sanitizeInput(req.body.carModel);
      const sellerGovernorate = sanitizeInput(req.body.sellerGovernorate);
      const sellerLandmark = sanitizeInput(req.body.sellerLandmark);
      const buyerGovernorate = sanitizeInput(req.body.buyerGovernorate);
      const buyerLandmark = sanitizeInput(req.body.buyerLandmark);
      const vinNumber = sanitizeInput(req.body.vinNumber);
      const customClauses = sanitizeInput(req.body.customClauses);
      const { sellerPhone, buyerPhone, price, currency, optionalClauses = [] } = req.body;

      const numericPrice = parseInt(String(price || '0').replace(/,/g, ''), 10);
      // Simplified: no need for Arabic number conversion to avoid any potential issues
      // const priceInWords = tafqeet(numericPrice, currency || 'IQD');

      if (!sellerName || !sellerPhone || !buyerName || !buyerPhone || !carModel || !vinNumber || !price) {
        return res.status(400).json({ error: 'يرجى تقديم جميع بيانات العقد المطلوبة.' });
      }

      const normalizedSellerPhone = sellerPhone.toString().replace(/\D/g, '');
      const normalizedBuyerPhone = buyerPhone.toString().replace(/\D/g, '');

      if (!/^[0-9]{10}$/.test(normalizedSellerPhone) || !/^[0-9]{10}$/.test(normalizedBuyerPhone)) {
        return res.status(400).json({ error: 'يرجى إدخال أرقام جوال عراقية صحيحة بدون رمز الدولة.' });
      }

      // Map IDs to actual clause text
      const clauseMap: Record<string, string> = {
        'engine_warranty': 'يضمن البائع سلامة المحرك والجير لمدة 3 أيام من تاريخ الاستلام، وفي حال ظهور خلل فني جوهري يحق للمشتري إعادة المركبة.',
        'traffic_test': 'يعتبر هذا البيع معلقاً على شرط اجتياز المركبة للفحص الفني في دائرة المرور المختصة.',
        'previous_fines': 'يتحمل الطرف الأول (البائع) كافة الغرامات المرورية والديون الحكومية المترتبة على المركبة حتى تاريخ توقيع هذا العقد.',
        'transfer_period': 'يلتزم البائع بالحضور أمام دائرة المرور لغرض تحويل ملكية المركبة باسم المشتري خلال مدة لا تتجاوز 10 أيام من تاريخه.',
      };

      let additionalConditions = '';
      if (optionalClauses.length > 0) {
        additionalConditions = '\n\nشروط إضافية متفق عليها:\n' + optionalClauses
          .map((id: string, index: number) => `${index + 6}. ${clauseMap[id] || id}`)
          .join('\n');
      }

      if (customClauses) {
        additionalConditions += `\n\nبند مضاف من الأطراف:\n- ${customClauses}`;
      }

      const contractText = `عقد بيع وشراء مركبة

أنه في يوم ${new Date().toLocaleDateString('ar') || new Date().toDateString()}، تم الاتفاق والتراضي بين كل من:

الطرف الأول (البائع): السيد/ة ${sellerName} (رقم الهاتف: +964${normalizedSellerPhone}، السكن: ${sellerGovernorate} - ${sellerLandmark})
الطرف الثاني (المشتري): السيد/ة ${buyerName} (رقم الهاتف: +964${normalizedBuyerPhone}، السكن: ${buyerGovernorate} - ${buyerLandmark})

باع الطرف الأول للطرف الثاني المركبة الموصوفة أدناه:
- نوع المركبة وموديلها: ${carModel}
- رقم الشاصي (VIN): ${vinNumber}

الثمن: تم هذا البيع نظير ثمن إجمالي قدره ${price} ${currency === 'USD' ? 'دولار أمريكي' : 'دينار عراقي'}.

شروط العقد:
1. يقر الطرف الأول (البائع) بأن المركبة المباعة خالية من أي ديون أو حجوزات قانونية حتى تاريخ هذا العقد.
2. يقر الطرف الثاني (المشتري) بأنه قد عاين المركبة معاينة تامة وقبل شراءها بحالتها الراهنة.
3. يتعهد الطرف الأول بتسليم المركبة وكافة وثائقها القانونية للطرف الثاني فور استلام الثمن المذكور.
4. تنتقل كافة المسؤوليات القانونية والمخالفات المترتبة على المركبة إلى عهدة الطرف الثاني من لحظة استلامه لها.
5. يخضع هذا العقد لأحكام القوانين العراقية النافذة.

${additionalConditions}

التوقيعات:
توقيع الطرف الأول (البائع): ............................
توقيع الطرف الثاني (المشتري): ............................`;

      res.json({ data: { contractText } });
    } catch (error) {
      console.error('Local contract generation failed:', error);
      res.status(500).json({ error: 'فشل في إعداد مسودة العقد. يرجى مراجعة البيانات والمحاولة مرة أخرى.' });
    }
  });

  app.post('/api/legal/whatsapp-contract', authenticateToken, async (req, res) => {
    const { sellerPhone, buyerPhone, pdfUrl, sellerName } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({ error: 'المستند غير جاهز للإرسال.' });
    }

    try {
      // توليد رابط مؤمن (Signed URL)
      const secureToken = crypto.randomBytes(16).toString('hex');
      const secureUrl = `${process.env.APP_URL}/api/legal/document/${path.basename(pdfUrl)}?token=${secureToken}`;

      console.log(`WhatsApp Send (Twilio): PDF Secure Link -> ${secureUrl}`);

      res.json({ data: { success: true, message: 'تم إرسال ملف PDF عبر WhatsApp بنجاح.' } });
    } catch (error) {
      res.status(500).json({ error: 'فشل إرسال رسالة WhatsApp.' });
    }
  });

  // نقطة نهاية لرفع العقد المولد كملف
  app.post('/api/legal/upload-contract-pdf', optionalAuthenticateToken, upload.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ data: { url: `/uploads/${req.file.filename}` } });
  });

  app.post('/api/legal/save-contract', authenticateToken, async (req, res) => {
    const currentUser = (req as any).user;
    const { contractText, sellerName, buyerName, status, payFromWallet } = req.body;

    if (!contractText) {
      return res.status(400).json({ error: 'نص العقد مطلوب للحفظ.' });
    }

    // إذا طلب المستخدم الدفع من المحفظة عند الحفظ النهائي
    if (payFromWallet) {
      const user = await prisma.user.findUnique({ where: { id: currentUser.userId } });
      if (!user || user.accountBalance < CONTRACT_CREATION_FEE) {
        return res.status(400).json({ error: 'رصيد المحفظة غير كافٍ لإتمام العملية.' });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: currentUser.userId },
          data: { accountBalance: { decrement: CONTRACT_CREATION_FEE } }
        }),
        prisma.transaction.create({
          data: {
            userId: currentUser.userId,
            amount: CONTRACT_CREATION_FEE,
            label: 'رسوم إنشاء عقد مركبة',
            type: 'debit',
            status: 'completed',
            source: 'Wallet'
          }
        })
      ]);
    }

    console.log(`Save contract request: seller=${sellerName}, buyer=${buyerName}, status=${status || 'final'}`);
    res.json({ data: { success: true, message: 'تم حفظ العقد في المحفظة بنجاح.' } });
  });

  // --- Admin Contracts Monitoring ---
  app.get('/api/admin/contracts', authenticateToken, adminOnly, async (req, res) => {
    try {
      const contracts = await prisma.case.findMany({
        where: { matter: 'عقد بيع مركبة' },
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true, email: true } } }
      });

      const processed = contracts.map(c => {
        const details = JSON.parse(c.privateNote || '{}');
        return {
          id: c.id,
          title: c.title,
          status: c.status === 'pending' && details.status === 'waiting_buyer_signature' ? 'waiting_buyer' :
            c.status === 'pending' ? 'draft' : 'signed',
          sellerName: details.sellerName || c.client.name,
          buyerName: details.buyerName || 'غير محدد',
          carModel: details.carModel || 'غير محدد',
          vinNumber: details.vinNumber || 'غير متوفر',
          reviewNotes: details.reviewNotes || [],
          price: details.price || '0',
          createdAt: c.createdAt
        };
      });

      res.json({ data: processed });
    } catch (error) {
      res.status(500).json({ error: 'فشل جلب سجل العقود' });
    }
  });

  // --- Draft Contract & External Signature Routes ---
  // Endpoint to save or update a contract draft
  app.post('/api/legal/save-draft-contract', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const draft = await prisma.case.create({
        data: {
          title: `مسودة عقد: ${req.body.carModel}`,
          matter: 'عقد بيع مركبة',
          clientId: currentUser.userId, // Creator is the "owner"
          lawyerId: currentUser.userId, // Placeholder
          status: 'pending',
          privateNote: JSON.stringify({
            ...req.body,
            sellerSignature: req.body.sellerSignature || null,
            buyerSignature: req.body.buyerSignature || null,
            status: req.body.status || 'draft'
          }), // Store full form data including signatures
          progress: 0,
        }
      });
      res.json({ data: { id: draft.id } });
    } catch (error) {
      console.error('Save draft contract error:', error);
      res.status(500).json({ error: 'فشل حفظ المسودة' });
    }
  });

  // Generic endpoint to fetch contract details (draft or finalized)
  app.get('/api/legal/contract/:id', async (req, res) => {
    try {
      const contract = await prisma.case.findUnique({ where: { id: req.params.id } });
      if (!contract) return res.status(404).json({ error: 'المسودة غير موجودة' });
      const contractDetails = JSON.parse(contract.privateNote || '{}');
      res.json({ data: { ...contractDetails, id: contract.id, status: contract.status, createdAt: contract.createdAt } });
    } catch (error) {
      res.status(500).json({ error: 'فشل جلب المسودة' });
    }
  });

  // New endpoint to list all user contracts
  app.get('/api/legal/contracts', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const contracts = await prisma.case.findMany({
        where: {
          OR: [
            { clientId: currentUser.userId },
            { lawyerId: currentUser.userId }
          ],
          matter: 'عقد بيع مركبة'
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          privateNote: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { name: true } }
        }
      });

      const processed = contracts.map(c => {
        const details = JSON.parse(c.privateNote || '{}');
        return {
          id: c.id,
          title: c.title,
          status: c.status === 'pending' && details.status === 'waiting_buyer_signature' ? 'waiting_buyer' :
            c.status === 'pending' ? 'draft' : 'signed',
          carModel: details.carModel || 'غير محدد',
          sellerName: details.sellerName,
          buyerName: details.buyerName,
          price: details.price,
          vinNumber: details.vinNumber,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        };
      });

      res.json({ data: processed });
    } catch (error) {
      res.status(500).json({ error: 'فشل جلب العقود' });
    }
  });

  app.post('/api/legal/sign-draft-contract/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { signature, selfie, name, pdfUrl, location } = req.body;

      const draft = await prisma.case.findUnique({ where: { id } });
      if (!draft) return res.status(404).json({ error: 'المسودة غير موجودة' });

      const currentNote = JSON.parse(draft.privateNote || '{}');

      // Use finalizeContract logic to update the database state
      const updatedContract = await finalizeContract(id, {
        pdfUrl,
        sellerSignature: currentNote.sellerSignature || '',
        buyerSignature: signature,
        location,
        selfie
      });

      // Notify the creator (Seller) via WebSocket
      io.to(draft.clientId).emit('buyer_signed', {
        draftId: id,
        signature,
        pdfUrl,
        buyerName: name,
        time: new Date().toLocaleTimeString('ar-IQ')
      });

      res.json({ success: true, message: 'تم التوقيع بنجاح وإبلاغ الطرف الأول.', data: updatedContract });
    } catch (error) {
      console.error('Signing error:', error);
      res.status(500).json({ error: 'فشل إتمام عملية التوقيع' });
    }
  });

  app.post('/api/legal/email-contract', async (req, res) => {
    try {
      const { email, pdfUrl, name } = req.body;
      if (!email || !pdfUrl) return res.status(400).json({ error: 'Email and PDF URL required' });

      // محاكاة إرسال البريد
      console.log(`[EMAIL] Sending contract PDF to ${email} for ${name}. Link: ${pdfUrl}`);

      res.json({ success: true, message: 'تم إرسال العقد بنجاح.' });
    } catch (error) {
      res.status(500).json({ error: 'فشل إرسال البريد' });
    }
  });

  // --- Contract Template Sync Routes ---
  app.get('/api/app/contract-templates', authenticateToken, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (req as any).user.userId }
      });
      res.json({ data: (user as any)?.contractTemplates || [] });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  app.post('/api/app/contract-templates', authenticateToken, async (req, res) => {
    try {
      const { name, text } = req.body;
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const templates = (user as any).contractTemplates || [];

      const updated = [{ name, text }, ...templates.filter((t: any) => t.name !== name)].slice(0, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { contractTemplates: updated } as any
      });

      res.json({ data: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to sync template' });
    }
  });

  app.delete('/api/app/contract-templates', authenticateToken, async (req, res) => {
    try {
      const { index } = req.body;
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const templates = (user as any).contractTemplates || [];

      const updated = templates.filter((_: any, i: number) => i !== index);

      await prisma.user.update({
        where: { id: userId },
        data: { contractTemplates: updated } as any
      });

      res.json({ data: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // --- Contract Clause Library Routes ---
  app.get('/api/app/contract-clauses', authenticateToken, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (req as any).user.userId }
      });
      res.json({ data: (user as any)?.savedClauses || [] });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clauses' });
    }
  });

  app.post('/api/app/contract-clauses', authenticateToken, async (req, res) => {
    try {
      const { text } = req.body;
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const clauses = (user as any).savedClauses || [];

      const updated = [text, ...clauses.filter((c: string) => c !== text)].slice(0, 20);

      await prisma.user.update({
        where: { id: userId },
        data: { savedClauses: updated } as any
      });
      res.json({ data: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save clause' });
    }
  });

  app.delete('/api/app/contract-clauses', authenticateToken, async (req, res) => {
    try {
      const { index } = req.body;
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const clauses = (user as any).savedClauses || [];
      const updated = clauses.filter((_: any, i: number) => i !== index);

      await prisma.user.update({
        where: { id: userId },
        data: { savedClauses: updated } as any
      });
      res.json({ data: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete clause' });
    }
  });

  app.post('/api/legal/request-review', authenticateToken, async (req, res) => {
    const currentUser = (req as any).user;
    const { lawyerId, notes, payFromWallet } = req.body;

    if (!lawyerId) return res.status(400).json({ error: 'يجب اختيار محامٍ للمراجعة.' });

    if (payFromWallet) {
      const user = await prisma.user.findUnique({ where: { id: currentUser.userId } });
      if (!user || user.accountBalance < LAWYER_REVIEW_FEE) {
        return res.status(400).json({ error: 'رصيدك لا يكفي لطلب مراجعة المحامي.' });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: currentUser.userId },
          data: { accountBalance: { decrement: LAWYER_REVIEW_FEE } }
        }),
        prisma.transaction.create({
          data: {
            userId: currentUser.userId,
            amount: LAWYER_REVIEW_FEE,
            label: 'رسوم مراجعة قانونية لعقد',
            type: 'debit',
            status: 'completed',
            source: 'Wallet'
          }
        })
      ]);
    }

    await prisma.notification.create({
      data: {
        userId: lawyerId, // إرسال الإشعار للمحامي المختار
        title: 'طلب مراجعة مسودة',
        message: `طلب مراجعة جديد من العميل ${currentUser.name}: ${notes || 'عقد بيع مركبة'}`,
        type: 'info',
        link: '/pro', // توجيه المحامي للوحة التحكم الخاصة به
      }
    });

    res.json({ data: { success: true } });
  });

  app.post('/api/promo/apply', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const currentUser = (req as any).user;

    // مثال بسيط: كود خصم ثابت للمستخدمين الجدد (يمكن تطويره لاحقاً)
    if (code === 'NEWUSER100') {
      // في بيئة إنتاجية، يجب التحقق من:
      // 1. صلاحية الكود (تاريخ انتهاء، عدد مرات الاستخدام)
      // 2. إذا كان المستخدم "جديداً" (مثلاً، لا توجد لديه معاملات سابقة)
      // 3. إذا كان الكود قد استخدم من قبل هذا المستخدم

      // للتبسيط، نفترض أنه صالح ويمنح خصماً ثابتاً
      return res.json({
        data: {
          discountAmount: PROMO_CODE_DISCOUNT,
          message: `تم تطبيق خصم ${PROMO_CODE_DISCOUNT.toLocaleString()} د.ع بنجاح!`,
        },
      });
    } else {
      return res.status(400).json({
        error: 'كود الخصم غير صالح أو انتهت صلاحيته.',
      });
    }
  });

  // مسار الدفع من المحفظة
  app.post('/api/app/billing/pay-wallet', authenticateToken, async (req, res) => {
    const currentUser = (req as any).user;
    const { amount, serviceName, promoCode } = req.body;

    try {
      const result = await deductFromWalletForService(currentUser.userId, amount, serviceName, promoCode);
      res.json({ data: result, message: 'تم الدفع بنجاح من المحفظة.' });
    } catch (error: any) {
      console.error('Wallet payment failed:', error);
      res.status(400).json({ error: error.message || 'فشل الدفع من المحفظة.' });
    }
  });

  app.post('/api/payments/zain-cash', authenticateToken, async (req, res) => {
    const { amount, serviceId } = req.body;

    if (typeof amount !== 'number' || !serviceId) {
      return res.status(400).json({ error: 'المبلغ ومعرف الخدمة مطلوبان.' });
    }

    res.json({ data: { success: true, reference: `ZAIN-${Date.now()}` } });
  });

  // ============================================
  // Notifications Routes
  // ============================================

  app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const notifications = await prisma.notification.findMany({
        where: { userId: currentUser.userId },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      res.json({ data: notifications });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      await prisma.notification.updateMany({
        where: {
          id: req.params.id,
          userId: currentUser.userId
        },
        data: { read: true }
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  app.get('/api/legal/docs', async (req, res) => {
    const docs = await getLegalDocs();
    res.json(docs);
  });

  app.post('/api/legal/ask', async (req, res) => {
    const { question, topK, tone, history } = req.body as {
      question?: string;
      topK?: number;
      tone?: ToneMode;
      history?: ChatHistoryItem[];
    };

    // API Key safety check
    if (!geminiClient) {
      console.warn("Gemini Client not initialized. Check GEMINI_API_KEY environment variable.");
    }

    try {
      // Hardened null check to prevent TypeError at server.ts:1677
      const rawSettings = await getAiSettings();
      const aiConfig = rawSettings || { enabled: true, topK: 3, fallbackMode: false, maxTokens: 2048, jpegQuality: 70, forceLocalMode: false };

      if (!aiConfig.enabled) {
        return res.json({
          question,
          answer: 'الميزة الذكية معطلة حالياً. الرجاء التواصل مع الدعم أو المحاولة لاحقاً.',
          sources: [],
        });
      }

      if (aiConfig.forceLocalMode) {
        // تحسين خوارزمية البحث المحلي بزيادة عدد المراجع المسترجعة للفرز الأولي
        // لضمان تغطية أوسع للمواد القانونية عند غياب معالجة AI
        const localTopK = (Number(topK) || aiConfig.topK) + 2;
        const sources = getTopRelevantDocuments(question || '', localTopK);

        const localAnswer = buildLocalAnswer(question || '', sources.slice(0, Number(topK) || aiConfig.topK));

        return res.json({
          question,
          answer: `**[نظام البحث القانوني المباشر]**\n\n${localAnswer}`,
          sources,
          mode: 'local',
        });
      }

      if (aiConfig.fallbackMode) {
        return res.json({
          question,
          answer: 'المساعد الذكي يعمل في وضع التخزين المؤقت. يمكن للمدير إعادة تمكين الوضع الكامل من لوحة التحكم.',
          sources: [],
        });
      }

      const selectedTone: ToneMode = tone === 'simple' || tone === 'friendly' || tone === 'formal' ? tone : 'formal';
      const sources = getTopRelevantDocuments(question, Number(topK) || aiConfig.topK);

      if (!geminiClient) {
        return res.json({
          question,
          answer: buildLocalAnswer(question, sources),
          sources,
          mode: 'local',
        });
      }

      const referenceSummary = sources
        .map(
          (source, index) =>
            `${index + 1}. ${source.title} | ${source.law} | ${source.article}\nالملخص: ${source.summary}\nالمصدر: ${source.source}`
        )
        .join('\n\n');

      const model = geminiClient.getGenerativeModel({
        model: 'gemini-1.5-flash', // Stable model identifier to avoid 404 errors
        systemInstruction: buildGeminiSystemPrompt(selectedTone, referenceSummary),
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
        ],
      });

      const result = await model.generateContentStream({
        contents: mapHistoryToGeminiContents(Array.isArray(history) ? history : [], question),
        generationConfig: {
          temperature: selectedTone === 'friendly' ? 0.7 : selectedTone === 'simple' ? 0.35 : 0.25,
        },
      });

      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let fullAnswer = "";
      try {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullAnswer += chunkText;
          res.write(`data: ${JSON.stringify({ chunk: chunkText, sources: fullAnswer.length < 100 ? sources : [] })}\n\n`);
        }
      } catch (streamError) {
        console.error("Stream interrupted:", streamError);
        res.write(`data: ${JSON.stringify({ error: "انقطع الاتصال أثناء توليد الإجابة." })}\n\n`);
      } finally {
        res.end();
      }

    } catch (error) {
      console.error('❌ [AI Error] RAG query failed:', error);

      // Check if headers have already been sent (meaning SSE stream has started)
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "انقطع الاتصال أو حدث خطأ أثناء المعالجة." })}\n\n`);
        res.end();
      } else {
        // Fallback to local dataset immediately if AI fails
        const localSources = getTopRelevantDocuments(question, 3);
        res.json({
          question,
          answer: buildLocalAnswer(question, localSources),
          sources: localSources,
          mode: 'local',
        });
      }
    }
  });

  // ============================================
  // Document Upload Routes
  // ============================================

  app.post('/api/profile/documents/national-id', authenticateToken, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'لم يتم تحديد ملف' });
      }

      const user = (req as any).user;
      const fileUrl = `/uploads/${req.file.filename}`;

      const lawyerProfile = await prisma.lawyerProfile.upsert({
        where: { userId: user.id },
        update: { nationalIdUrl: fileUrl, nationalIdVerified: false },
        create: {
          userId: user.id,
          nationalIdUrl: fileUrl,
          nationalIdVerified: false,
        },
      });

      res.json({
        success: true,
        message: 'تم رفع البطاقة الوطنية بنجاح',
        fileUrl,
        lawyerProfile,
      });
    } catch (error) {
      console.error('National ID upload failed:', error);
      res.status(500).json({ error: 'فشل رفع البطاقة الوطنية' });
    }
  });

  app.post('/api/profile/documents/lawyer-license', authenticateToken, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'لم يتم تحديد ملف' });
      }

      const user = (req as any).user;
      const fileUrl = `/uploads/${req.file.filename}`;

      const lawyerProfile = await prisma.lawyerProfile.upsert({
        where: { userId: user.id },
        update: { lawyerLicenseUrl: fileUrl, lawyerLicenseVerified: false },
        create: {
          userId: user.id,
          lawyerLicenseUrl: fileUrl,
          lawyerLicenseVerified: false,
        },
      });

      res.json({
        success: true,
        message: 'تم رفع بطاقة المحاماة بنجاح',
        fileUrl,
        lawyerProfile,
      });
    } catch (error) {
      console.error('Lawyer license upload failed:', error);
      res.status(500).json({ error: 'فشل رفع بطاقة المحاماة' });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback for development - serve index.html for all non-API routes
    app.use('/', express.static(process.cwd(), { index: false }));
    app.get('*', (req, res) => {
      // Skip API routes and uploaded files
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(process.cwd(), 'index.html'));
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running. Local: http://localhost:${PORT} | Network: Accessible via your IP on port ${PORT}`);
  });
}

startServer();

import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { answerQuestion, buildLocalAnswer, getTopRelevantDocuments } from './src/server/iraqiLawDataset';
import { hashPassword, verifyPassword, generateToken, verifyToken, getTokenFromHeader } from './src/server/auth';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import multer from 'multer';
import fs from 'fs';
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
  revokeSession,
  unfollowLawyer,
  updateCurrentUserPreferences,
  updateCurrentUserProfile,
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
  getProWorkspace,
  moveCaseDocuments,
  removeCaseCollaborator,
  signCaseDocument,
  toggleCaseArchive,
  updateCaseProgress,
  updateProCaseStatuses,
  updateProMessageState,
  uploadProVaultDocument,
} from './src/server/workspaceData';

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
  const recentTurns = history.slice(-8);
  return [
    ...recentTurns.map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    })),
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

  const PORT = Number(process.env.PORT || 3000);
  const prisma = new PrismaClient();
  const adminBootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

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

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      if (!['user', 'pro', 'admin'].includes(requestedRole)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      if (requestedRole === 'admin') {
        const existingAdminCount = await prisma.user.count({
          where: { role: 'admin' },
        });

        if (existingAdminCount > 0) {
          return res.status(403).json({ error: 'Admin registration is disabled' });
        }

        if (!adminBootstrapSecret) {
          return res.status(500).json({ error: 'Admin bootstrap is not configured' });
        }

        if (req.body.adminBootstrapSecret !== adminBootstrapSecret) {
          return res.status(403).json({ error: 'Invalid admin bootstrap secret' });
        }
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name,
          role: requestedRole as any,
          verified: false,
          blocked: false,
        },
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
            accountBalance: user.accountBalance,
          },
        },
        message: 'User registered successfully',
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
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

  app.get('/api/app/lawyers/:id', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const profile = await getLawyerProfile(req.params.id, currentUser.userId);
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
      await followLawyer(currentUser.userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Follow lawyer error:', error);
      res.status(500).json({ error: 'Failed to follow lawyer' });
    }
  });

  app.delete('/api/app/lawyers/:id/follow', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      await unfollowLawyer(currentUser.userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Unfollow lawyer error:', error);
      res.status(500).json({ error: 'Failed to unfollow lawyer' });
    }
  });

  app.get('/api/app/workspace/cases', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      res.json({ data: await getClientWorkspace(currentUser.userId) });
    } catch (error) {
      console.error('Workspace cases error:', error);
      res.status(500).json({ error: 'Failed to fetch workspace cases' });
    }
  });

  app.post('/api/app/workspace/cases', authenticateToken, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const { title, matter, lawyerId, totalAgreedFee, caseType } = req.body;
      const data = await createClientCase(currentUser.userId, { title, matter, lawyerId, totalAgreedFee, caseType });
      res.status(201).json({ data });
    } catch (error) {
      console.error('Create workspace case error:', error);
      res.status(500).json({ error: 'Failed to create case' });
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

  app.post('/api/app/workspace/cases/:caseId/documents/:documentId/sign', authenticateToken, async (req, res) => {
    try {
      res.json({ data: await signCaseDocument(req.params.caseId, req.params.documentId) });
    } catch (error) {
      console.error('Sign document error:', error);
      res.status(500).json({ error: 'Failed to sign document' });
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
          link: senderRole === 'user' ? '/pro' : '/my-cases'
        }
      });

      // Real-time Push via Socket.io
      io.to(recipientId).emit('notification', notification);

      res.json({ data: caseData });
    } catch (error) {
      console.error('Add message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
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

  app.get('/api/admin/alerts', authenticateToken, adminOnly, (req, res) => {
    res.json(getSecurityAlerts());
  });

  app.get('/api/admin/audit-logs', authenticateToken, adminOnly, (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    res.json(getAuditLogs(type));
  });

  app.get('/api/admin/transactions', authenticateToken, adminOnly, (req, res) => {
    res.json(getTransactionRecords());
  });

  app.put('/api/admin/users/:id', (req, res) => {
    const updated = updateUserProfile(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'user not found' });
    }
    return res.json(updated);
  });

  app.post('/api/admin/users/:id/role', (req, res) => {
    const { role } = req.body;
    if (!['user', 'pro', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be user, pro, or admin' });
    }
    const updated = updateUserRole(req.params.id, role);
    if (!updated) {
      return res.status(404).json({ error: 'user not found' });
    }
    return res.json(updated);
  });

  app.post('/api/admin/users/:id/block', (req, res) => {
    const updated = toggleUserBlock(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'user not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/feature-flags', (req, res) => {
    res.json(getFeatureFlags());
  });

  app.post('/api/admin/feature-flags/:key', (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }
    const updated = updateFeatureFlag(req.params.key, enabled);
    if (!updated) {
      return res.status(404).json({ error: 'feature flag not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/support-tickets', (req, res) => {
    res.json(getSupportTickets());
  });

  app.post('/api/admin/support-tickets/:id', (req, res) => {
    const { status } = req.body;
    if (!['open', 'pending', 'resolved', 'escalated'].includes(status)) {
      return res.status(400).json({ error: 'invalid ticket status' });
    }
    const updated = updateSupportTicket(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'ticket not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/policies', (req, res) => {
    res.json(getPolicies());
  });

  app.post('/api/admin/policies/:key', (req, res) => {
    const { value } = req.body;
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'value must be a string' });
    }
    const updated = updatePolicySetting(req.params.key, value);
    if (!updated) {
      return res.status(404).json({ error: 'policy not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/system-settings', (req, res) => {
    res.json(getSystemSettings());
  });

  app.post('/api/admin/system-settings', (req, res) => {
    const updated = updateSystemSettings(req.body);
    return res.json(updated);
  });

  app.get('/api/admin/ai-settings', (req, res) => {
    res.json(getAiSettings());
  });

  app.post('/api/admin/ai-settings', (req, res) => {
    const updated = updateAiSettings(req.body);
    return res.json(updated);
  });

  app.get('/api/admin/payment-gateways', (req, res) => {
    res.json(getPaymentGateways());
  });

  app.post('/api/admin/payment-gateways/:key', (req, res) => {
    const { enabled, feePercent } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }
    const updated = updatePaymentGateway(req.params.key, enabled, feePercent);
    if (!updated) {
      return res.status(404).json({ error: 'payment gateway not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/workflow-settings', (req, res) => {
    res.json(getWorkflowSettings());
  });

  app.post('/api/admin/workflow-settings', (req, res) => {
    const updated = updateWorkflowSettings(req.body);
    return res.json(updated);
  });

  app.get('/api/admin/notification-templates', (req, res) => {
    res.json(getNotificationTemplates());
  });

  app.post('/api/admin/notification-templates/:key', (req, res) => {
    const updated = updateNotificationTemplate(req.params.key, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'notification template not found' });
    }
    return res.json(updated);
  });

  app.get('/api/admin/moderation-rules', (req, res) => {
    res.json(getModerationRules());
  });

  app.post('/api/admin/moderation-rules', (req, res) => {
    const { type, value, active } = req.body;
    if (!type || !value) {
      return res.status(400).json({ error: 'type and value are required' });
    }
    const newRule = addModerationRule({ type, value, active: active !== false });
    return res.status(201).json(newRule);
  });

  app.post('/api/admin/moderation-rules/:id', (req, res) => {
    const updated = updateModerationRule(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'moderation rule not found' });
    }
    return res.json(updated);
  });

  app.delete('/api/admin/moderation-rules/:id', (req, res) => {
    if (!deleteModerationRule(req.params.id)) {
      return res.status(404).json({ error: 'moderation rule not found' });
    }
    return res.json({ success: true });
  });

  app.get('/api/admin/legal-docs', (req, res) => {
    res.json(getLegalDocs());
  });

  app.post('/api/admin/legal-docs', (req, res) => {
    const { title, law, article, category, summary, source } = req.body;
    if (!title || !law || !article || !category || !summary || !source) {
      return res.status(400).json({ error: 'missing document fields' });
    }
    const newDoc = addLegalDoc({ title, law, article, category, summary, source });
    return res.status(201).json(newDoc);
  });

  app.delete('/api/admin/legal-docs/:id', (req, res) => {
    if (!deleteLegalDoc(req.params.id)) {
      return res.status(404).json({ error: 'document not found' });
    }
    return res.json({ success: true });
  });

  app.put('/api/admin/legal-docs/:id', (req, res) => {
    const updated = updateLegalDoc(req.params.id, req.body);
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

    if (!geminiClient) {
      return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير متوفرة' });
    }

    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'السؤال مطلوب كـ string.' });
    }

    // API Key safety check
    if (!geminiClient) {
      console.warn("Gemini Client not initialized. Check GEMINI_API_KEY environment variable.");
    }

    try {
      const aiConfig = getAiSettings();
      if (!aiConfig.enabled) {
        return res.json({
          question,
          answer: 'الميزة الذكية معطلة حالياً. الرجاء التواصل مع الدعم أو المحاولة لاحقاً.',
          sources: [],
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
        model: 'gemini-1.5-flash',
        systemInstruction: buildGeminiSystemPrompt(selectedTone, referenceSummary),
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
      console.error('RAG query failed:', error);
      try {
        const fallbackData = await answerQuestion(question, Number(topK) || 3);
        // If streaming failed early, we can't send a normal JSON response here if headers were sent.
        if (!res.headersSent) {
          return res.json({ ...fallbackData, mode: 'fallback' });
        }
      } catch {
        if (!res.headersSent) {
          return res.status(500).json({ error: 'فشل في معالجة الطلب. حاول مرة أخرى لاحقاً.' });
        }
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
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

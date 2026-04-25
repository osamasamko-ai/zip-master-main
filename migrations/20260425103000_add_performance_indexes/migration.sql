CREATE INDEX "User_role_verified_createdAt_idx" ON "User"("role", "verified", "createdAt");
CREATE INDEX "User_blocked_createdAt_idx" ON "User"("blocked", "createdAt");

CREATE INDEX "LawyerProfile_specialty_licenseStatus_idx" ON "LawyerProfile"("specialty", "licenseStatus");
CREATE INDEX "LawyerProfile_licenseStatus_profileScore_idx" ON "LawyerProfile"("licenseStatus", "profileScore");

CREATE INDEX "KycApplication_userId_createdAt_idx" ON "KycApplication"("userId", "createdAt");
CREATE INDEX "KycApplication_status_createdAt_idx" ON "KycApplication"("status", "createdAt");

CREATE INDEX "Case_clientId_updatedAt_idx" ON "Case"("clientId", "updatedAt");
CREATE INDEX "Case_lawyerId_updatedAt_idx" ON "Case"("lawyerId", "updatedAt");
CREATE INDEX "Case_isArchived_updatedAt_idx" ON "Case"("isArchived", "updatedAt");
CREATE INDEX "Case_status_updatedAt_idx" ON "Case"("status", "updatedAt");

CREATE INDEX "Document_caseId_createdAt_idx" ON "Document"("caseId", "createdAt");
CREATE INDEX "Document_folderId_createdAt_idx" ON "Document"("folderId", "createdAt");

CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

CREATE INDEX "UserFollow_followerId_createdAt_idx" ON "UserFollow"("followerId", "createdAt");
CREATE INDEX "UserFollow_lawyerId_createdAt_idx" ON "UserFollow"("lawyerId", "createdAt");

CREATE INDEX "Review_lawyerId_createdAt_idx" ON "Review"("lawyerId", "createdAt");

CREATE INDEX "UserSession_userId_createdAt_idx" ON "UserSession"("userId", "createdAt");
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

CREATE INDEX "Invoice_userId_createdAt_idx" ON "Invoice"("userId", "createdAt");
CREATE INDEX "Invoice_caseId_createdAt_idx" ON "Invoice"("caseId", "createdAt");

CREATE INDEX "CaseCustomField_caseId_createdAt_idx" ON "CaseCustomField"("caseId", "createdAt");
CREATE INDEX "CaseTimelineEntry_caseId_createdAt_idx" ON "CaseTimelineEntry"("caseId", "createdAt");
CREATE INDEX "CaseCollaborator_caseId_createdAt_idx" ON "CaseCollaborator"("caseId", "createdAt");
CREATE INDEX "CaseAccessLog_caseId_createdAt_idx" ON "CaseAccessLog"("caseId", "createdAt");

CREATE INDEX "Appointment_lawyerId_createdAt_idx" ON "Appointment"("lawyerId", "createdAt");
CREATE INDEX "Appointment_caseId_createdAt_idx" ON "Appointment"("caseId", "createdAt");

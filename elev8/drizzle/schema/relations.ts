import { relations } from 'drizzle-orm';
import { accounts } from './accounts';
import { users } from './users';
import { contacts } from './contacts';
import { properties } from './properties';
import { notices } from './notices';
import { jobs } from './jobs';
import { proposals, proposalTemplates } from './proposals';
import { schedulingRequests, technicians, workOrders, complianceNotices } from './work_orders';
import { fileAttachments, activityLogs, notifications } from './activity_logs';

export const accountsRelations = relations(accounts, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  properties: many(properties),
  notices: many(notices),
  jobs: many(jobs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  account: one(accounts, { fields: [users.accountId], references: [accounts.id] }),
  technician: one(technicians, { fields: [users.id], references: [technicians.userId] }),
  submittedNotices: many(notices, { relationName: 'notice_submittedBy' }),
  assignedNotices: many(notices, { relationName: 'notice_assignedReviewer' }),
  assignedJobs: many(jobs, { relationName: 'job_assignedReviewer' }),
  draftedProposals: many(proposals, { relationName: 'proposal_draftedBy' }),
  approvedProposals: many(proposals, { relationName: 'proposal_approvedBy' }),
  activityLogs: many(activityLogs),
  notifications: many(notifications),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  account: one(accounts, { fields: [contacts.accountId], references: [accounts.id] }),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  account: one(accounts, { fields: [properties.accountId], references: [accounts.id] }),
  notices: many(notices),
  jobs: many(jobs),
}));

export const noticesRelations = relations(notices, ({ one, many }) => ({
  property: one(properties, { fields: [notices.propertyId], references: [properties.id] }),
  account: one(accounts, { fields: [notices.accountId], references: [accounts.id] }),
  submittedBy: one(users, { fields: [notices.submittedBy], references: [users.id], relationName: 'notice_submittedBy' }),
  assignedReviewer: one(users, { fields: [notices.assignedReviewerId], references: [users.id], relationName: 'notice_assignedReviewer' }),
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  notice: one(notices, { fields: [jobs.noticeId], references: [notices.id] }),
  property: one(properties, { fields: [jobs.propertyId], references: [properties.id] }),
  account: one(accounts, { fields: [jobs.accountId], references: [accounts.id] }),
  assignedReviewer: one(users, { fields: [jobs.assignedReviewerId], references: [users.id], relationName: 'job_assignedReviewer' }),
  proposals: many(proposals),
  schedulingRequests: many(schedulingRequests),
  workOrders: many(workOrders),
  activityLogs: many(activityLogs),
  notifications: many(notifications),
  complianceNotices: many(complianceNotices),
}));

export const proposalTemplatesRelations = relations(proposalTemplates, ({ many }) => ({
  proposals: many(proposals),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  job: one(jobs, { fields: [proposals.jobId], references: [jobs.id] }),
  template: one(proposalTemplates, { fields: [proposals.templateId], references: [proposalTemplates.id] }),
  draftedBy: one(users, { fields: [proposals.draftedBy], references: [users.id], relationName: 'proposal_draftedBy' }),
  approvedBy: one(users, { fields: [proposals.approvedBy], references: [users.id], relationName: 'proposal_approvedBy' }),
}));

export const schedulingRequestsRelations = relations(schedulingRequests, ({ one }) => ({
  job: one(jobs, { fields: [schedulingRequests.jobId], references: [jobs.id] }),
  requestedBy: one(users, { fields: [schedulingRequests.requestedBy], references: [users.id] }),
  confirmedBy: one(users, { fields: [schedulingRequests.confirmedBy], references: [users.id] }),
}));

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  user: one(users, { fields: [technicians.userId], references: [users.id] }),
  workOrders: many(workOrders),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  job: one(jobs, { fields: [workOrders.jobId], references: [jobs.id] }),
  schedulingRequest: one(schedulingRequests, { fields: [workOrders.schedulingRequestId], references: [schedulingRequests.id] }),
  assignedTechnician: one(technicians, { fields: [workOrders.assignedTechnicianId], references: [technicians.id] }),
  createdBy: one(users, { fields: [workOrders.createdBy], references: [users.id] }),
  complianceNotices: many(complianceNotices),
}));

export const complianceNoticesRelations = relations(complianceNotices, ({ one }) => ({
  workOrder: one(workOrders, { fields: [complianceNotices.workOrderId], references: [workOrders.id] }),
  job: one(jobs, { fields: [complianceNotices.jobId], references: [jobs.id] }),
  draftedBy: one(users, { fields: [complianceNotices.draftedBy], references: [users.id] }),
}));

export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  uploadedBy: one(users, { fields: [fileAttachments.uploadedBy], references: [users.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  actor: one(users, { fields: [activityLogs.actorId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  job: one(jobs, { fields: [notifications.jobId], references: [jobs.id] }),
}));

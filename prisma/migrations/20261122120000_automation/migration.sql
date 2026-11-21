-- Workflow Automation (21 Nov 2026): hanya CREATE TABLE/INDEX baru. Tidak mengubah atau menghapus tabel/data lama.

-- CreateTable
CREATE TABLE "AutomationWorkflow" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "activeVersion" INTEGER,
    "draft" JSONB NOT NULL,
    "draftRev" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AutomationWorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "graph" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationWorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "correlationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationInbox" (
    "eventId" TEXT NOT NULL,
    "consumer" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationInbox_pkey" PRIMARY KEY ("eventId","consumer")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'task',
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "waitKey" TEXT,
    "ctx" JSONB NOT NULL,
    "error" TEXT,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "handle" TEXT,
    "result" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTimer" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "runId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationTimer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationDelivery" (
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationDelivery_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AutomationPolicy" (
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'needs_configuration',
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationPolicy_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AutomationAudit" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "detail" JSONB,

    CONSTRAINT "AutomationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationWorkflowVersion_workflowKey_version_key" ON "AutomationWorkflowVersion"("workflowKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEvent_dedupeKey_key" ON "AutomationEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AutomationEvent_dispatchedAt_nextAttemptAt_idx" ON "AutomationEvent"("dispatchedAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AutomationEvent_entityType_entityId_idx" ON "AutomationEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AutomationRun_status_waitKey_idx" ON "AutomationRun"("status", "waitKey");

-- CreateIndex
CREATE INDEX "AutomationRun_entityType_entityId_idx" ON "AutomationRun"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AutomationRun_startedAt_idx" ON "AutomationRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_workflowKey_version_eventId_key" ON "AutomationRun"("workflowKey", "version", "eventId");

-- CreateIndex
CREATE INDEX "AutomationRunStep_runId_nodeId_idx" ON "AutomationRunStep"("runId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationTimer_key_key" ON "AutomationTimer"("key");

-- CreateIndex
CREATE INDEX "AutomationTimer_status_dueAt_idx" ON "AutomationTimer"("status", "dueAt");

-- CreateIndex
CREATE INDEX "AutomationTimer_entityId_idx" ON "AutomationTimer"("entityId");

-- CreateIndex
CREATE INDEX "AutomationAudit_at_idx" ON "AutomationAudit"("at");

-- CreateIndex
CREATE INDEX "AutomationAudit_resourceType_resourceId_idx" ON "AutomationAudit"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "AutomationWorkflowVersion" ADD CONSTRAINT "AutomationWorkflowVersion_workflowKey_fkey" FOREIGN KEY ("workflowKey") REFERENCES "AutomationWorkflow"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunStep" ADD CONSTRAINT "AutomationRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;


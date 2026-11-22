-- Script Konten (22 Nov 2026): tabel baru saja. Aman diulang (IF NOT EXISTS). Rollback: DROP TABLE keempat tabel ini.
CREATE TABLE IF NOT EXISTS "ScriptDoc" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "cprId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedRev" INTEGER,
    "approvedRev" INTEGER,
    "writers" TEXT[],
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptDoc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScriptDoc_taskId_key" ON "ScriptDoc"("taskId");
CREATE INDEX IF NOT EXISTS "ScriptDoc_cprId_idx" ON "ScriptDoc"("cprId");
CREATE INDEX IF NOT EXISTS "ScriptDoc_updatedAt_idx" ON "ScriptDoc"("updatedAt");

CREATE TABLE IF NOT EXISTS "ScriptRevision" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "rev" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScriptRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScriptRevision_docId_rev_key" ON "ScriptRevision"("docId", "rev");
CREATE INDEX IF NOT EXISTS "ScriptRevision_docId_idx" ON "ScriptRevision"("docId");

CREATE TABLE IF NOT EXISTS "ScriptComment" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "quote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScriptComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScriptComment_docId_idx" ON "ScriptComment"("docId");

CREATE TABLE IF NOT EXISTS "ScriptReview" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "rev" INTEGER NOT NULL,
    "byId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "exc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScriptReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScriptReview_docId_idx" ON "ScriptReview"("docId");

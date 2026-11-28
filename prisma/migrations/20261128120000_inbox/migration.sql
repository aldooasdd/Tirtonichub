CREATE TABLE "InboxThread" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "name" TEXT,
    "lastText" TEXT,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InboxThread_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "dir" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "metaId" TEXT,
    "userId" TEXT,
    "error" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboxThread_channel_accountId_contactId_key" ON "InboxThread"("channel", "accountId", "contactId");
CREATE INDEX "InboxThread_lastAt_idx" ON "InboxThread"("lastAt");
CREATE UNIQUE INDEX "InboxMessage_metaId_key" ON "InboxMessage"("metaId");
CREATE INDEX "InboxMessage_threadId_at_idx" ON "InboxMessage"("threadId", "at");
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

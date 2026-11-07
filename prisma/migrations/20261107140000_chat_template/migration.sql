-- Template balasan cepat Chat Pembeli
CREATE TABLE "ChatTemplate" (
    "id" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "grup" TEXT NOT NULL DEFAULT 'tirtonic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatTemplate_shortcut_key" ON "ChatTemplate"("shortcut");

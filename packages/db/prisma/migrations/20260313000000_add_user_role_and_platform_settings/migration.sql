-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "default_crawl_credits" INTEGER NOT NULL DEFAULT 5,
    "default_rate_limit" INTEGER NOT NULL DEFAULT 100,
    "feature_flags" JSONB NOT NULL DEFAULT '{}',
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "system_email_from" TEXT,
    "system_email_reply_to" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

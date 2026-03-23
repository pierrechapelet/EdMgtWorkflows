-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'assignment_created',
  'deadline_approaching',
  'deadline_passed',
  'submission_received',
  'approved',
  'rejected',
  'campaign_recalled',
  'escalation_created'
);

-- CreateTable
CREATE TABLE "notifications" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"     UUID         NOT NULL,
    "type"        "NotificationType" NOT NULL,
    "title"       TEXT         NOT NULL,
    "body"        TEXT         NOT NULL,
    "entity_type" TEXT,
    "entity_id"   UUID,
    "is_read"     BOOLEAN      NOT NULL DEFAULT false,
    "read_at"     TIMESTAMPTZ,
    "email_sent"  BOOLEAN      NOT NULL DEFAULT false,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "company_refresh_token_fk";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "employee_refresh_token_fk";

-- AlterTable
ALTER TABLE "email_notification_logs" ALTER COLUMN "recipientId" SET DATA TYPE VARCHAR(255);

/*
  Warnings:

  - You are about to drop the column `email_order_fills` on the `notification_preferences` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "resolution_mode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "oracle_status" AS ENUM ('PENDING', 'CHECKING', 'RESOLVED', 'AWAITING_ADMIN', 'FAILED');

-- AlterTable
ALTER TABLE "markets" ADD COLUMN     "oracle_config" JSONB,
ADD COLUMN     "oracle_last_checked" TIMESTAMP(3),
ADD COLUMN     "oracle_status" "oracle_status",
ADD COLUMN     "resolution_mode" "resolution_mode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "notification_preferences" DROP COLUMN "email_order_fills",
ADD COLUMN     "email_market_resolved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "in_app_market_resolved" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fcm_token" TEXT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "stock_type" "stock_type" NOT NULL,
    "target_price" DECIMAL(14,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oracle_logs" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resolver" TEXT,
    "raw_data" JSONB,
    "verdict" TEXT,
    "rubric_score" INTEGER,
    "rubric_details" JSONB,
    "reasoning" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oracle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "price_alerts_market_id_is_active_idx" ON "price_alerts"("market_id", "is_active");

-- CreateIndex
CREATE INDEX "price_alerts_user_id_idx" ON "price_alerts"("user_id");

-- CreateIndex
CREATE INDEX "oracle_logs_market_id_idx" ON "oracle_logs"("market_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oracle_logs" ADD CONSTRAINT "oracle_logs_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

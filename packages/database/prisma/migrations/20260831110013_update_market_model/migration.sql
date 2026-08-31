-- CreateEnum
CREATE TYPE "crypto_market_type" AS ENUM ('TOUCH', 'DIRECTION');

-- AlterEnum
ALTER TYPE "market_status" ADD VALUE 'RESOLVING';

-- AlterTable
ALTER TABLE "markets" ADD COLUMN     "crypto_market_type" "crypto_market_type",
ADD COLUMN     "start_price" DECIMAL(18,8),
ADD COLUMN     "tracked_high" DECIMAL(18,8),
ADD COLUMN     "tracked_low" DECIMAL(18,8),
ADD COLUMN     "wick_confirm_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wick_first_seen_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "market_comments" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" VARCHAR(280) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_comments_market_id_created_at_idx" ON "market_comments"("market_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "market_comments_user_id_idx" ON "market_comments"("user_id");

-- AddForeignKey
ALTER TABLE "market_comments" ADD CONSTRAINT "market_comments_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_comments" ADD CONSTRAINT "market_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

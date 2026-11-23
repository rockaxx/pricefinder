CREATE TABLE "LiveSearchCache" (
    "provider" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "atMs" BIGINT NOT NULL,
    "payload" TEXT NOT NULL,
    PRIMARY KEY ("provider", "queryKey")
);
CREATE INDEX "LiveSearchCache_provider_atMs_idx" ON "LiveSearchCache"("provider", "atMs");

CREATE TABLE "LiveSearchRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "atMs" BIGINT NOT NULL
);
CREATE INDEX "LiveSearchRequest_provider_atMs_idx" ON "LiveSearchRequest"("provider", "atMs");
CREATE INDEX "LiveSearchRequest_provider_queryKey_atMs_idx" ON "LiveSearchRequest"("provider", "queryKey", "atMs");

CREATE TABLE "LiveListingCache" (
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "atMs" BIGINT NOT NULL,
    "payload" TEXT NOT NULL,
    PRIMARY KEY ("provider", "externalId")
);
CREATE INDEX "LiveListingCache_provider_atMs_idx" ON "LiveListingCache"("provider", "atMs");

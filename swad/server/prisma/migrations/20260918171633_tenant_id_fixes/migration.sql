/*
  Warnings:

  - You are about to drop the `TenantGlLine` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `tenantId` to the `gl_dimension_values` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `tax_rates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "gl_dimension_values" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "tax_rates" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- DropTable
DROP TABLE "TenantGlLine";

-- CreateIndex
CREATE INDEX "gl_dimension_values_tenantId_idx" ON "gl_dimension_values"("tenantId");

-- CreateIndex
CREATE INDEX "tax_rates_tenantId_idx" ON "tax_rates"("tenantId");

-- AddForeignKey
ALTER TABLE "gl_dimension_values" ADD CONSTRAINT "gl_dimension_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

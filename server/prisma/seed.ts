import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding FinanceOS demo data...');

  // ─── Clean existing demo data ────────────────────────────────────────────────
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.projectCost.deleteMany();
  await prisma.project.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.depreciationRun.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.expenseClaim.deleteMany();
  await prisma.poLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.bankStatementLine.deleteMany();
  await prisma.bankStatement.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.paymentRun.deleteMany();
  await prisma.billLine.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.glJournalLine.deleteMany();
  await prisma.glJournal.deleteMany();
  await prisma.glDimensionValue.deleteMany();
  await prisma.glDimension.deleteMany();
  await prisma.glAccount.deleteMany();
  await prisma.fiscalPeriod.deleteMany();
  await prisma.fiscalYear.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.taxProfile.deleteMany();
  await prisma.legalEntity.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.tenantUserRole.deleteMany();
  await prisma.tenantUser.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ───────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo@1234', 12);

  const adminUser = await prisma.user.create({
    data: { email: 'admin@demo.com', passwordHash, firstName: 'Sarah', lastName: 'Mitchell', isActive: true },
  });
  const cfoDave = await prisma.user.create({
    data: { email: 'cfo@demo.com', passwordHash, firstName: 'David', lastName: 'Chen', isActive: true },
  });
  const controllerLisa = await prisma.user.create({
    data: { email: 'controller@demo.com', passwordHash, firstName: 'Lisa', lastName: 'Park', isActive: true },
  });
  const accountantJames = await prisma.user.create({
    data: { email: 'accountant@demo.com', passwordHash, firstName: 'James', lastName: 'Wright', isActive: true },
  });

  console.log('✓ Users created');

  // ─── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      slug: 'demo',
      legalName: 'Acme Technologies Pty Ltd',
      displayName: 'Acme Tech',
      country: 'AU',
      timezone: 'Australia/Sydney',
      baseCurrency: 'USD',
      planId: 'growth',
      isActive: true,
      onboardingStep: 6,
    },
  });

  const tid = tenant.id;

  // ─── Roles & Permissions ─────────────────────────────────────────────────────
  const ownerRole = await prisma.role.create({ data: { name: 'owner', isBuiltIn: true, description: 'Tenant owner - full access' } });
  const adminRole = await prisma.role.create({ data: { tenantId: tid, name: 'admin', isBuiltIn: true, description: 'Tenant administrator' } });
  const cfoRole = await prisma.role.create({ data: { tenantId: tid, name: 'cfo', description: 'Chief Financial Officer' } });
  const controllerRole = await prisma.role.create({ data: { tenantId: tid, name: 'controller', description: 'Finance Controller' } });
  const accountantRole = await prisma.role.create({ data: { tenantId: tid, name: 'accountant', description: 'Accountant' } });

  // Create wildcard permission for owner/admin
  const allPerm = await prisma.permission.create({ data: { module: '*', resourceType: '*', action: '*', description: 'Full access' } });
  const readPerm = await prisma.permission.create({ data: { module: '*', resourceType: '*', action: 'read', description: 'Read all' } });
  const approvePerm = await prisma.permission.create({ data: { module: '*', resourceType: '*', action: 'approve', description: 'Approve all' } });

  await prisma.rolePermission.createMany({
    data: [
      { roleId: ownerRole.id, permissionId: allPerm.id },
      { roleId: adminRole.id, permissionId: allPerm.id },
      { roleId: cfoRole.id, permissionId: allPerm.id },
      { roleId: controllerRole.id, permissionId: allPerm.id },
      { roleId: accountantRole.id, permissionId: readPerm.id },
      { roleId: accountantRole.id, permissionId: approvePerm.id },
    ],
  });

  // Tenant memberships
  const adminMembership = await prisma.tenantUser.create({ data: { tenantId: tid, userId: adminUser.id, joinedAt: new Date() } });
  const cfoMembership = await prisma.tenantUser.create({ data: { tenantId: tid, userId: cfoDave.id, joinedAt: new Date() } });
  const controllerMembership = await prisma.tenantUser.create({ data: { tenantId: tid, userId: controllerLisa.id, joinedAt: new Date() } });
  const accountantMembership = await prisma.tenantUser.create({ data: { tenantId: tid, userId: accountantJames.id, joinedAt: new Date() } });

  await prisma.tenantUserRole.createMany({
    data: [
      { tenantUserId: adminMembership.id, roleId: ownerRole.id },
      { tenantUserId: cfoMembership.id, roleId: cfoRole.id },
      { tenantUserId: controllerMembership.id, roleId: controllerRole.id },
      { tenantUserId: accountantMembership.id, roleId: accountantRole.id },
    ],
  });

  console.log('✓ Roles & memberships created');

  // ─── Legal Entity & Fiscal ───────────────────────────────────────────────────
  const entity = await prisma.legalEntity.create({
    data: { tenantId: tid, name: 'Acme Tech', legalName: 'Acme Technologies Pty Ltd', country: 'AU', currency: 'USD', taxId: 'ABN 12 345 678 901' },
  });

  const fiscalYear = await prisma.fiscalYear.create({
    data: { tenantId: tid, legalEntityId: entity.id, name: 'FY2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'Open' },
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const periods: { id: string; name: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const start = new Date(2026, i, 1);
    const end = new Date(2026, i + 1, 0);
    const period = await prisma.fiscalPeriod.create({
      data: {
        tenantId: tid, fiscalYearId: fiscalYear.id,
        name: `${months[i]} 2026`,
        startDate: start, endDate: end,
        status: i < 8 ? 'Open' : 'Open', // Sep onwards open
      },
    });
    periods.push({ id: period.id, name: period.name });
  }

  const sepPeriod = periods[8]; // September 2026

  console.log('✓ Fiscal periods created');

  // ─── Tax Profile ─────────────────────────────────────────────────────────────
  const taxProfile = await prisma.taxProfile.create({ data: { tenantId: tid, name: 'Standard GST', country: 'AU' } });
  await prisma.taxRate.create({ data: { tenantId: tid, taxProfileId: taxProfile.id, name: 'GST 10%', rate: 10, taxType: 'GST', effectiveFrom: new Date('2026-01-01') } });
  await prisma.taxRate.create({ data: { tenantId: tid, taxProfileId: taxProfile.id, name: 'GST Free', rate: 0, taxType: 'GST', effectiveFrom: new Date('2026-01-01') } });

  // ─── Chart of Accounts ───────────────────────────────────────────────────────
  const accounts = await prisma.glAccount.createManyAndReturn({
    data: [
      // Assets
      { tenantId: tid, code: '1000', name: 'Current Assets', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1100', name: 'Cash & Bank', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1110', name: 'Operating Account - Westpac', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1120', name: 'Savings Account - ANZ', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1200', name: 'Accounts Receivable', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1300', name: 'Inventory', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1400', name: 'Prepaid Expenses', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1500', name: 'Fixed Assets', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1510', name: 'Plant & Equipment', accountType: 'Asset', normalBalance: 'Debit' },
      { tenantId: tid, code: '1520', name: 'Accumulated Depreciation', accountType: 'Asset', normalBalance: 'Credit' },
      // Liabilities
      { tenantId: tid, code: '2000', name: 'Current Liabilities', accountType: 'Liability', normalBalance: 'Credit' },
      { tenantId: tid, code: '2100', name: 'Accounts Payable', accountType: 'Liability', normalBalance: 'Credit' },
      { tenantId: tid, code: '2200', name: 'GST Payable', accountType: 'Liability', normalBalance: 'Credit' },
      { tenantId: tid, code: '2300', name: 'Accrued Expenses', accountType: 'Liability', normalBalance: 'Credit' },
      { tenantId: tid, code: '2400', name: 'Payroll Liabilities', accountType: 'Liability', normalBalance: 'Credit' },
      // Equity
      { tenantId: tid, code: '3000', name: 'Equity', accountType: 'Equity', normalBalance: 'Credit' },
      { tenantId: tid, code: '3100', name: 'Share Capital', accountType: 'Equity', normalBalance: 'Credit' },
      { tenantId: tid, code: '3200', name: 'Retained Earnings', accountType: 'Equity', normalBalance: 'Credit' },
      // Revenue
      { tenantId: tid, code: '4000', name: 'Revenue', accountType: 'Revenue', normalBalance: 'Credit' },
      { tenantId: tid, code: '4100', name: 'Software Revenue', accountType: 'Revenue', normalBalance: 'Credit' },
      { tenantId: tid, code: '4200', name: 'Consulting Revenue', accountType: 'Revenue', normalBalance: 'Credit' },
      { tenantId: tid, code: '4300', name: 'Support & Maintenance', accountType: 'Revenue', normalBalance: 'Credit' },
      // Expenses
      { tenantId: tid, code: '5000', name: 'Cost of Sales', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '5100', name: 'Cost of Goods Sold', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6000', name: 'Operating Expenses', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6100', name: 'Salaries & Wages', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6200', name: 'Rent & Occupancy', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6300', name: 'Marketing & Advertising', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6400', name: 'Travel & Entertainment', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6500', name: 'IT & Software', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6600', name: 'Professional Fees', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6700', name: 'Depreciation', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6800', name: 'Insurance', accountType: 'Expense', normalBalance: 'Debit' },
      { tenantId: tid, code: '6900', name: 'Miscellaneous', accountType: 'Expense', normalBalance: 'Debit' },
    ],
  });

  const acc = (code: string) => accounts.find(a => a.code === code)!;

  console.log('✓ Chart of accounts created');

  // ─── Dimensions ──────────────────────────────────────────────────────────────
  const deptDim = await prisma.glDimension.create({ data: { tenantId: tid, name: 'Department' } });
  await prisma.glDimensionValue.createMany({
    data: [
      { tenantId: tid, dimensionId: deptDim.id, code: 'ENG', name: 'Engineering' },
      { tenantId: tid, dimensionId: deptDim.id, code: 'MKT', name: 'Marketing' },
      { tenantId: tid, dimensionId: deptDim.id, code: 'FIN', name: 'Finance' },
      { tenantId: tid, dimensionId: deptDim.id, code: 'OPS', name: 'Operations' },
      { tenantId: tid, dimensionId: deptDim.id, code: 'SAL', name: 'Sales' },
    ],
  });

  // ─── Posted Journal Entries (Jan–Sep 2026) ───────────────────────────────────
  const journalData = [
    // Revenue journals
    { month: 0, desc: 'Software licence revenue - January', debitAcc: '1200', creditAcc: '4100', amount: 185000 },
    { month: 1, desc: 'Software licence revenue - February', debitAcc: '1200', creditAcc: '4100', amount: 192000 },
    { month: 2, desc: 'Consulting revenue - Q1', debitAcc: '1200', creditAcc: '4200', amount: 95000 },
    { month: 3, desc: 'Software licence revenue - April', debitAcc: '1200', creditAcc: '4100', amount: 198000 },
    { month: 4, desc: 'Support revenue - May', debitAcc: '1200', creditAcc: '4300', amount: 42000 },
    { month: 5, desc: 'Software licence revenue - June', debitAcc: '1200', creditAcc: '4100', amount: 210000 },
    { month: 6, desc: 'Consulting revenue - July', debitAcc: '1200', creditAcc: '4200', amount: 88000 },
    { month: 7, desc: 'Software licence revenue - August', debitAcc: '1200', creditAcc: '4100', amount: 215000 },
    { month: 8, desc: 'Software licence revenue - September', debitAcc: '1200', creditAcc: '4100', amount: 220000 },
    // Salary expense
    { month: 0, desc: 'Payroll - January', debitAcc: '6100', creditAcc: '2400', amount: 128000 },
    { month: 1, desc: 'Payroll - February', debitAcc: '6100', creditAcc: '2400', amount: 128000 },
    { month: 2, desc: 'Payroll - March', debitAcc: '6100', creditAcc: '2400', amount: 130000 },
    { month: 3, desc: 'Payroll - April', debitAcc: '6100', creditAcc: '2400', amount: 130000 },
    { month: 4, desc: 'Payroll - May', debitAcc: '6100', creditAcc: '2400', amount: 132000 },
    { month: 5, desc: 'Payroll - June', debitAcc: '6100', creditAcc: '2400', amount: 132000 },
    { month: 6, desc: 'Payroll - July', debitAcc: '6100', creditAcc: '2400', amount: 135000 },
    { month: 7, desc: 'Payroll - August', debitAcc: '6100', creditAcc: '2400', amount: 135000 },
    { month: 8, desc: 'Payroll - September', debitAcc: '6100', creditAcc: '2400', amount: 137000 },
    // Rent
    { month: 0, desc: 'Office rent - January', debitAcc: '6200', creditAcc: '2100', amount: 18500 },
    { month: 3, desc: 'Office rent - April', debitAcc: '6200', creditAcc: '2100', amount: 18500 },
    { month: 6, desc: 'Office rent - July', debitAcc: '6200', creditAcc: '2100', amount: 19000 },
    // IT & Software
    { month: 1, desc: 'AWS cloud services - Feb', debitAcc: '6500', creditAcc: '2100', amount: 12400 },
    { month: 4, desc: 'AWS cloud services - May', debitAcc: '6500', creditAcc: '2100', amount: 13200 },
    { month: 7, desc: 'AWS cloud services - Aug', debitAcc: '6500', creditAcc: '2100', amount: 13800 },
    // Cash receipt from AR
    { month: 2, desc: 'Cash receipts from customers - March', debitAcc: '1110', creditAcc: '1200', amount: 370000 },
    { month: 5, desc: 'Cash receipts from customers - June', debitAcc: '1110', creditAcc: '1200', amount: 420000 },
    { month: 8, desc: 'Cash receipts from customers - September', debitAcc: '1110', creditAcc: '1200', amount: 390000 },
    // AP payments
    { month: 2, desc: 'Supplier payments - March', debitAcc: '2100', creditAcc: '1110', amount: 95000 },
    { month: 5, desc: 'Supplier payments - June', debitAcc: '2100', creditAcc: '1110', amount: 105000 },
    { month: 8, desc: 'Supplier payments - September', debitAcc: '2100', creditAcc: '1110', amount: 88000 },
  ];

  for (let idx = 0; idx < journalData.length; idx++) {
    const jd = journalData[idx];
    const period = periods[jd.month];
    const postDate = new Date(2026, jd.month, 15);
    const jNum = `JNL-${String(idx + 1).padStart(5, '0')}`;

    await prisma.glJournal.create({
      data: {
        tenantId: tid, journalNumber: jNum, description: jd.desc,
        fiscalPeriodId: period.id, postingDate: postDate,
        status: 'Posted', createdBy: accountantJames.id,
        approvedBy: controllerLisa.id, approvedAt: postDate,
        postedBy: controllerLisa.id, postedAt: postDate,
        totalDebit: jd.amount, totalCredit: jd.amount,
        lines: {
          create: [
            { tenantId: tid, lineNumber: 1, accountId: acc(jd.debitAcc).id, debit: jd.amount, credit: 0, currency: 'USD' },
            { tenantId: tid, lineNumber: 2, accountId: acc(jd.creditAcc).id, debit: 0, credit: jd.amount, currency: 'USD' },
          ],
        },
      },
    });
  }

  // One pending journal
  await prisma.glJournal.create({
    data: {
      tenantId: tid, journalNumber: 'JNL-00031', description: 'Accrual - marketing spend September',
      fiscalPeriodId: sepPeriod.id, postingDate: new Date('2026-09-30'),
      status: 'Pending', createdBy: accountantJames.id,
      totalDebit: 15000, totalCredit: 15000,
      lines: {
        create: [
          { tenantId: tid, lineNumber: 1, accountId: acc('6300').id, debit: 15000, credit: 0, currency: 'USD' },
          { tenantId: tid, lineNumber: 2, accountId: acc('2300').id, debit: 0, credit: 15000, currency: 'USD' },
        ],
      },
    },
  });

  console.log('✓ Journal entries created');

  // ─── Bank Accounts ────────────────────────────────────────────────────────────
  const westpac = await prisma.bankAccount.create({
    data: { tenantId: tid, accountName: 'Operating Account', bankName: 'Westpac', accountNumber: '732-142-0012345', bsb: '732-142', currency: 'USD', currentBalance: 1245000 },
  });
  const anz = await prisma.bankAccount.create({
    data: { tenantId: tid, accountName: 'Savings Account', bankName: 'ANZ', accountNumber: '012-432-9876543', bsb: '012-432', currency: 'USD', currentBalance: 890000 },
  });

  // Bank statement with transactions
  const statement = await prisma.bankStatement.create({
    data: {
      tenantId: tid, bankAccountId: westpac.id,
      statementDate: new Date('2026-09-30'),
      openingBalance: 1180000, closingBalance: 1245000,
      lines: {
        create: [
          { tenantId: tid, transactionDate: new Date('2026-09-03'), description: 'EFT Payment - Acme Customer A', amount: 48500, balance: 1228500 },
          { tenantId: tid, transactionDate: new Date('2026-09-05'), description: 'Direct Debit - AWS Cloud', amount: -13800, balance: 1214700 },
          { tenantId: tid, transactionDate: new Date('2026-09-08'), description: 'EFT Payment - Global Corp', amount: 95000, balance: 1309700 },
          { tenantId: tid, transactionDate: new Date('2026-09-10'), description: 'Payroll September', amount: -137000, balance: 1172700 },
          { tenantId: tid, transactionDate: new Date('2026-09-15'), description: 'Supplier payment - Tech Parts', amount: -42000, balance: 1130700 },
          { tenantId: tid, transactionDate: new Date('2026-09-18'), description: 'EFT Payment - StartupXYZ', amount: 62000, balance: 1192700 },
          { tenantId: tid, transactionDate: new Date('2026-09-22'), description: 'Office Rent Q3', amount: -19000, balance: 1173700 },
          { tenantId: tid, transactionDate: new Date('2026-09-25'), description: 'EFT Payment - MegaCorp Inc', amount: 120000, balance: 1293700 },
          { tenantId: tid, transactionDate: new Date('2026-09-28'), description: 'Professional fees - Law firm', amount: -15000, balance: 1278700 },
          { tenantId: tid, transactionDate: new Date('2026-09-30'), description: 'Interest income', amount: 2300, balance: 1281000, isMatched: true },
        ],
      },
    },
  });

  console.log('✓ Bank accounts & statement created');

  // ─── Suppliers ────────────────────────────────────────────────────────────────
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { tenantId: tid, code: 'SUP-0001', name: 'Tech Parts Australia', email: 'accounts@techparts.com.au', country: 'AU', currency: 'USD', paymentTerms: 30, bankName: 'NAB', bankAccount: '083-123-456789' } }),
    prisma.supplier.create({ data: { tenantId: tid, code: 'SUP-0002', name: 'Cloud Services Global', email: 'billing@cloudservices.io', country: 'US', currency: 'USD', paymentTerms: 14, bankName: 'Chase', bankAccount: 'US-9871234' } }),
    prisma.supplier.create({ data: { tenantId: tid, code: 'SUP-0003', name: 'Office Supplies Co', email: 'invoices@officesupplies.com', country: 'AU', currency: 'USD', paymentTerms: 30 } }),
    prisma.supplier.create({ data: { tenantId: tid, code: 'SUP-0004', name: 'Lawson & Partners Legal', email: 'accounts@lawsonpartners.com.au', country: 'AU', currency: 'USD', paymentTerms: 7 } }),
    prisma.supplier.create({ data: { tenantId: tid, code: 'SUP-0005', name: 'Sydney Commercial Realty', email: 'leasing@sydneyrealty.com', country: 'AU', currency: 'USD', paymentTerms: 1 } }),
  ]);

  // ─── Bills ────────────────────────────────────────────────────────────────────
  const billsData = [
    { supplier: suppliers[0], num: 'BILL-00001', ref: 'TP-INV-4421', date: '2026-09-02', due: '2026-10-02', status: 'Approved', lines: [{ desc: 'Server hardware components', qty: 4, price: 8500, tax: 10 }, { desc: 'Network switches', qty: 2, price: 3200, tax: 10 }] },
    { supplier: suppliers[1], num: 'BILL-00002', ref: 'AWS-SEP2026', date: '2026-09-01', due: '2026-09-15', status: 'Paid', lines: [{ desc: 'AWS EC2 compute - September', qty: 1, price: 9800, tax: 0 }, { desc: 'AWS S3 storage', qty: 1, price: 1200, tax: 0 }, { desc: 'AWS data transfer', qty: 1, price: 2800, tax: 0 }] },
    { supplier: suppliers[2], num: 'BILL-00003', ref: 'OS-8821', date: '2026-09-05', due: '2026-10-05', status: 'Pending', lines: [{ desc: 'Printer paper & stationery', qty: 10, price: 85, tax: 10 }, { desc: 'Office furniture - standing desk', qty: 3, price: 1200, tax: 10 }] },
    { supplier: suppliers[3], num: 'BILL-00004', ref: 'LP-SEP-001', date: '2026-09-10', due: '2026-09-17', status: 'Approved', lines: [{ desc: 'Legal advisory - IP matters', qty: 8, price: 650, tax: 10 }, { desc: 'Contract review', qty: 4, price: 450, tax: 10 }] },
    { supplier: suppliers[4], num: 'BILL-00005', ref: 'LEASE-Q3', date: '2026-09-01', due: '2026-09-01', status: 'Paid', lines: [{ desc: 'Level 12 office rent - September 2026', qty: 1, price: 19000, tax: 10 }] },
    { supplier: suppliers[0], num: 'BILL-00006', ref: 'TP-INV-4498', date: '2026-08-15', due: '2026-09-15', status: 'Draft', lines: [{ desc: 'Laptop batteries x20', qty: 20, price: 120, tax: 10 }] },
  ];

  for (const bd of billsData) {
    const lines = bd.lines.map((l, i) => {
      const amount = l.qty * l.price;
      return { tenantId: tid, lineNumber: i + 1, description: l.desc, quantity: l.qty, unitPrice: l.price, taxRate: l.tax, amount };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxAmount = lines.reduce((s, l) => s + (l.amount * l.taxRate / 100), 0);

    await prisma.bill.create({
      data: {
        tenantId: tid, billNumber: bd.num, supplierId: bd.supplier.id,
        reference: bd.ref, billDate: new Date(bd.date), dueDate: new Date(bd.due),
        currency: 'USD', status: bd.status, subtotal, taxAmount,
        totalAmount: subtotal + taxAmount,
        amountPaid: bd.status === 'Paid' ? subtotal + taxAmount : 0,
        approvedBy: bd.status !== 'Draft' && bd.status !== 'Pending' ? controllerLisa.id : undefined,
        approvedAt: bd.status !== 'Draft' && bd.status !== 'Pending' ? new Date(bd.due) : undefined,
        lines: { create: lines },
      },
    });
  }

  // Payment run
  const approvedBills = await prisma.bill.findMany({ where: { tenantId: tid, status: 'Approved' } });
  if (approvedBills.length > 0) {
    await prisma.paymentRun.create({
      data: {
        tenantId: tid, runNumber: 'PAY-00001',
        description: 'September 2026 payment run',
        paymentDate: new Date('2026-09-25'),
        status: 'Approved',
        totalAmount: approvedBills.reduce((s, b) => s + Number(b.totalAmount), 0),
        currency: 'USD',
        approvedBy: cfoDave.id, approvedAt: new Date('2026-09-24'),
        billIds: approvedBills.map(b => b.id),
      },
    });
  }

  console.log('✓ Suppliers & bills created');

  // ─── Customers ────────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.create({ data: { tenantId: tid, code: 'CUS-0001', name: 'MegaCorp Industries', email: 'finance@megacorp.com', country: 'US', currency: 'USD', creditLimit: 500000, paymentTerms: 30 } }),
    prisma.customer.create({ data: { tenantId: tid, code: 'CUS-0002', name: 'Global Tech Solutions', email: 'ap@globaltech.io', country: 'US', currency: 'USD', creditLimit: 250000, paymentTerms: 30 } }),
    prisma.customer.create({ data: { tenantId: tid, code: 'CUS-0003', name: 'Pacific Retail Group', email: 'accounts@pacificretail.com.au', country: 'AU', currency: 'USD', creditLimit: 150000, paymentTerms: 14 } }),
    prisma.customer.create({ data: { tenantId: tid, code: 'CUS-0004', name: 'StartupXYZ Pty Ltd', email: 'cfo@startupxyz.com', country: 'AU', currency: 'USD', creditLimit: 50000, paymentTerms: 7 } }),
    prisma.customer.create({ data: { tenantId: tid, code: 'CUS-0005', name: 'Enterprise Solutions Ltd', email: 'billing@enterprise.co.uk', country: 'GB', currency: 'USD', creditLimit: 800000, paymentTerms: 45 } }),
  ]);

  // ─── Invoices ─────────────────────────────────────────────────────────────────
  const invoicesData = [
    { cust: customers[0], num: 'INV-00001', date: '2026-09-01', due: '2026-10-01', status: 'Posted', paid: 120000, lines: [{ desc: 'Enterprise SaaS Licence - Q4 2026', qty: 1, price: 85000, tax: 0 }, { desc: 'Premium Support Package', qty: 1, price: 35000, tax: 0 }] },
    { cust: customers[1], num: 'INV-00002', date: '2026-09-05', due: '2026-10-05', status: 'Approved', paid: 0, lines: [{ desc: 'Software implementation services', qty: 80, price: 195, tax: 10 }, { desc: 'Training sessions', qty: 5, price: 800, tax: 10 }] },
    { cust: customers[2], num: 'INV-00003', date: '2026-08-20', due: '2026-09-03', status: 'Posted', paid: 0, lines: [{ desc: 'Retail analytics module - August', qty: 1, price: 12000, tax: 10 }] },
    { cust: customers[3], num: 'INV-00004', date: '2026-09-10', due: '2026-09-17', status: 'Paid', paid: 24800, lines: [{ desc: 'Startup Growth plan - annual', qty: 1, price: 18000, tax: 10 }, { desc: 'Onboarding & setup', qty: 1, price: 4000, tax: 10 }] },
    { cust: customers[4], num: 'INV-00005', date: '2026-07-01', due: '2026-08-15', status: 'Posted', paid: 0, lines: [{ desc: 'Enterprise licence - 100 seats', qty: 100, price: 2200, tax: 0 }] },
    { cust: customers[0], num: 'INV-00006', date: '2026-09-15', due: '2026-10-15', status: 'Draft', paid: 0, lines: [{ desc: 'Professional services - data migration', qty: 40, price: 250, tax: 0 }] },
  ];

  for (const inv of invoicesData) {
    const lines = inv.lines.map((l, i) => {
      const amount = l.qty * l.price;
      return { tenantId: tid, lineNumber: i + 1, description: l.desc, quantity: l.qty, unitPrice: l.price, taxRate: l.tax, amount };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxAmount = lines.reduce((s, l) => s + (l.amount * l.taxRate / 100), 0);

    const createdInvoice = await prisma.invoice.create({
      data: {
        tenantId: tid, invoiceNumber: inv.num, customerId: inv.cust.id,
        invoiceDate: new Date(inv.date), dueDate: new Date(inv.due),
        currency: 'USD', status: inv.status, subtotal, taxAmount,
        totalAmount: subtotal + taxAmount, amountPaid: inv.paid,
        approvedBy: inv.status !== 'Draft' ? controllerLisa.id : undefined,
        approvedAt: inv.status !== 'Draft' ? new Date(inv.date) : undefined,
        lines: { create: lines },
      },
    });

    // Create receipt for paid/partial invoices
    if (inv.paid > 0) {
      const rCount = await prisma.receipt.count({ where: { tenantId: tid } });
      await prisma.receipt.create({
        data: {
          tenantId: tid, receiptNumber: `REC-${String(rCount + 1).padStart(5, '0')}`,
          customerId: inv.cust.id, invoiceId: createdInvoice.id,
          receiptDate: new Date(inv.due), amount: inv.paid,
          currency: 'USD', paymentMethod: 'Bank Transfer',
          reference: `Payment for ${inv.num}`, status: 'Posted',
        },
      });
    }
  }

  console.log('✓ Customers & invoices created');

  // ─── Procurement ─────────────────────────────────────────────────────────────
  const pr1 = await prisma.purchaseRequest.create({
    data: { tenantId: tid, prNumber: 'PR-00001', title: 'New developer laptops x5', requestedBy: adminUser.id, department: 'Engineering', totalAmount: 15000, currency: 'USD', status: 'Approved', requiredBy: new Date('2026-10-15'), approvedBy: cfoDave.id, approvedAt: new Date('2026-09-12') },
  });
  const pr2 = await prisma.purchaseRequest.create({
    data: { tenantId: tid, prNumber: 'PR-00002', title: 'Marketing software licences', requestedBy: adminUser.id, department: 'Marketing', totalAmount: 8400, currency: 'USD', status: 'Pending', requiredBy: new Date('2026-10-01') },
  });
  const pr3 = await prisma.purchaseRequest.create({
    data: { tenantId: tid, prNumber: 'PR-00003', title: 'Office ergonomic chairs x10', requestedBy: adminUser.id, department: 'Operations', totalAmount: 6500, currency: 'USD', status: 'Draft' },
  });

  await prisma.purchaseOrder.create({
    data: {
      tenantId: tid, poNumber: 'PO-00001', purchaseRequestId: pr1.id,
      supplierId: suppliers[0].id, title: 'Developer laptops - Apple MacBook Pro',
      orderDate: new Date('2026-09-14'), deliveryDate: new Date('2026-10-10'),
      status: 'Approved', currency: 'USD', subtotal: 15000, totalAmount: 15000,
      approvedBy: cfoDave.id, approvedAt: new Date('2026-09-15'),
      lines: { create: [{ tenantId: tid, lineNumber: 1, description: 'MacBook Pro 14" M3 Pro', quantity: 5, unitPrice: 3000, amount: 15000, received: 0 }] },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      tenantId: tid, poNumber: 'PO-00002', title: 'Monthly cloud infrastructure',
      supplierId: suppliers[1].id, orderDate: new Date('2026-09-01'),
      status: 'Posted', currency: 'USD', subtotal: 13800, totalAmount: 13800,
      lines: { create: [{ tenantId: tid, lineNumber: 1, description: 'AWS Services - September 2026', quantity: 1, unitPrice: 13800, amount: 13800, received: 1 }] },
    },
  });

  console.log('✓ Procurement created');

  // ─── Expense Claims ───────────────────────────────────────────────────────────
  await prisma.expenseClaim.create({
    data: {
      tenantId: tid, claimNumber: 'EXP-00001', submittedBy: accountantJames.id,
      description: 'Sydney tech conference - September 2026',
      claimDate: new Date('2026-09-18'), status: 'Approved',
      currency: 'USD', totalAmount: 2840,
      approvedBy: controllerLisa.id, approvedAt: new Date('2026-09-20'),
      lines: {
        create: [
          { tenantId: tid, category: 'Travel', description: 'Return flights SYD-MEL', expenseDate: new Date('2026-09-10'), amount: 420, currency: 'USD' },
          { tenantId: tid, category: 'Accommodation', description: 'Hotel 3 nights - Melbourne', expenseDate: new Date('2026-09-10'), amount: 1350, currency: 'USD' },
          { tenantId: tid, category: 'Conference', description: 'Tech Summit registration', expenseDate: new Date('2026-09-11'), amount: 850, currency: 'USD' },
          { tenantId: tid, category: 'Meals', description: 'Client dinner', expenseDate: new Date('2026-09-12'), amount: 220, currency: 'USD' },
        ],
      },
    },
  });

  await prisma.expenseClaim.create({
    data: {
      tenantId: tid, claimNumber: 'EXP-00002', submittedBy: cfoDave.id,
      description: 'Q3 board meeting expenses',
      claimDate: new Date('2026-09-15'), status: 'Pending',
      currency: 'USD', totalAmount: 1180,
      lines: {
        create: [
          { tenantId: tid, category: 'Travel', description: 'Taxi to airport', expenseDate: new Date('2026-09-08'), amount: 85, currency: 'USD' },
          { tenantId: tid, category: 'Meals', description: 'Board dinner', expenseDate: new Date('2026-09-09'), amount: 640, currency: 'USD' },
          { tenantId: tid, category: 'Accommodation', description: 'Hotel 1 night', expenseDate: new Date('2026-09-09'), amount: 455, currency: 'USD' },
        ],
      },
    },
  });

  await prisma.expenseClaim.create({
    data: {
      tenantId: tid, claimNumber: 'EXP-00003', submittedBy: adminUser.id,
      description: 'Office supplies reimbursement',
      claimDate: new Date('2026-09-19'), status: 'Draft',
      currency: 'USD', totalAmount: 340,
      lines: {
        create: [
          { tenantId: tid, category: 'Office Supplies', description: 'Whiteboard markers & notebooks', expenseDate: new Date('2026-09-17'), amount: 145, currency: 'USD' },
          { tenantId: tid, category: 'Office Supplies', description: 'Printer ink cartridges', expenseDate: new Date('2026-09-19'), amount: 195, currency: 'USD' },
        ],
      },
    },
  });

  console.log('✓ Expense claims created');

  // ─── Fixed Assets ─────────────────────────────────────────────────────────────
  const assetsData = [
    { num: 'AST-00001', name: 'Dell PowerEdge Server R750', cat: 'IT Equipment', date: '2024-03-15', cost: 28000, residual: 2000, life: 5, nbv: 28000 * 0.6, location: 'Server Room - Level 2' },
    { num: 'AST-00002', name: 'Cisco Network Switch Stack', cat: 'IT Equipment', date: '2024-06-01', cost: 15500, residual: 1000, life: 5, nbv: 15500 * 0.7, location: 'Server Room - Level 2' },
    { num: 'AST-00003', name: 'Office Fit-out Level 12', cat: 'Leasehold Improvements', date: '2023-07-01', cost: 185000, residual: 0, life: 7, nbv: 185000 * 0.55, location: 'Level 12 - 1 Martin Place' },
    { num: 'AST-00004', name: 'Company Vehicle - Toyota HiAce', cat: 'Motor Vehicles', date: '2025-01-15', cost: 52000, residual: 12000, life: 8, nbv: 52000 * 0.85, location: 'Sydney Operations' },
    { num: 'AST-00005', name: 'Video Conferencing System', cat: 'IT Equipment', date: '2025-09-01', cost: 12000, residual: 500, life: 4, nbv: 12000 * 0.75, location: 'Boardroom - Level 12' },
  ];

  for (const a of assetsData) {
    await prisma.asset.create({
      data: {
        tenantId: tid, assetNumber: a.num, name: a.name, category: a.cat,
        acquisitionDate: new Date(a.date), acquisitionCost: a.cost,
        residualValue: a.residual, usefulLifeYears: a.life,
        depreciationMethod: 'Straight Line',
        accumulatedDepreciation: a.cost - a.nbv,
        netBookValue: a.nbv, location: a.location, status: 'Active',
      },
    });
  }

  // Depreciation run
  await prisma.depreciationRun.create({
    data: { tenantId: tid, runDate: new Date('2026-08-31'), periodName: 'August 2026', totalAmount: 8420, status: 'Posted' },
  });

  console.log('✓ Fixed assets created');

  // ─── Inventory ────────────────────────────────────────────────────────────────
  const inventoryItems = await Promise.all([
    prisma.inventoryItem.create({ data: { tenantId: tid, sku: 'SKU-001', name: 'USB-C Docking Station', category: 'IT Accessories', unit: 'Each', unitCost: 180, quantityOnHand: 24, reorderPoint: 10, warehouseLocation: 'Shelf A1' } }),
    prisma.inventoryItem.create({ data: { tenantId: tid, sku: 'SKU-002', name: 'Mechanical Keyboard', category: 'IT Accessories', unit: 'Each', unitCost: 145, quantityOnHand: 18, reorderPoint: 8 } }),
    prisma.inventoryItem.create({ data: { tenantId: tid, sku: 'SKU-003', name: 'Laptop Stand - Adjustable', category: 'IT Accessories', unit: 'Each', unitCost: 65, quantityOnHand: 35, reorderPoint: 15 } }),
    prisma.inventoryItem.create({ data: { tenantId: tid, sku: 'SKU-004', name: 'External Monitor 27"', category: 'Monitors', unit: 'Each', unitCost: 480, quantityOnHand: 12, reorderPoint: 5, warehouseLocation: 'Shelf B2' } }),
    prisma.inventoryItem.create({ data: { tenantId: tid, sku: 'SKU-005', name: 'Wireless Mouse', category: 'IT Accessories', unit: 'Each', unitCost: 55, quantityOnHand: 42, reorderPoint: 20 } }),
  ]);

  // Stock movements
  for (const item of inventoryItems) {
    await prisma.stockMovement.create({
      data: {
        tenantId: tid, itemId: item.id, movementType: 'Receipt',
        quantity: Number(item.quantityOnHand) + 10,
        unitCost: Number(item.unitCost),
        totalCost: (Number(item.quantityOnHand) + 10) * Number(item.unitCost),
        reference: 'Initial stock', movementDate: new Date('2026-01-15'),
      },
    });
    await prisma.stockMovement.create({
      data: {
        tenantId: tid, itemId: item.id, movementType: 'Issue',
        quantity: 10, unitCost: Number(item.unitCost),
        totalCost: 10 * Number(item.unitCost),
        reference: 'Issued to Engineering', movementDate: new Date('2026-06-20'),
      },
    });
  }

  console.log('✓ Inventory created');

  // ─── Projects ─────────────────────────────────────────────────────────────────
  const projectsData = [
    { code: 'PRJ-0001', name: 'MegaCorp ERP Integration', cust: customers[0], budget: 280000, actual: 142500, billed: 120000, status: 'Active', start: '2026-04-01', end: '2026-12-31' },
    { code: 'PRJ-0002', name: 'FinanceOS Mobile App', cust: null, budget: 420000, actual: 198000, billed: 0, status: 'Active', start: '2026-01-15', end: '2027-03-31' },
    { code: 'PRJ-0003', name: 'Pacific Retail Analytics Platform', cust: customers[2], budget: 95000, actual: 87500, billed: 80000, status: 'Active', start: '2026-03-01', end: '2026-10-31' },
    { code: 'PRJ-0004', name: 'Infrastructure Upgrade 2026', cust: null, budget: 120000, actual: 63200, billed: 0, status: 'Active', start: '2026-07-01', end: '2026-11-30' },
  ];

  for (const p of projectsData) {
    const project = await prisma.project.create({
      data: {
        tenantId: tid, projectCode: p.code, name: p.name,
        customerId: p.cust?.id,
        startDate: new Date(p.start), endDate: new Date(p.end),
        status: p.status, budget: p.budget, actualCost: p.actual,
        billedAmount: p.billed, currency: 'USD', managedBy: adminUser.id,
      },
    });

    const costCategories = [
      { cat: 'Labour', desc: 'Developer hours', amount: p.actual * 0.6 },
      { cat: 'Infrastructure', desc: 'Cloud & hosting', amount: p.actual * 0.25 },
      { cat: 'Licences', desc: 'Third-party software licences', amount: p.actual * 0.15 },
    ];
    for (const c of costCategories) {
      await prisma.projectCost.create({
        data: { tenantId: tid, projectId: project.id, category: c.cat, description: c.desc, amount: c.amount, costDate: new Date('2026-09-15') },
      });
    }
  }

  console.log('✓ Projects created');

  // ─── Contracts ────────────────────────────────────────────────────────────────
  await prisma.contract.createMany({
    data: [
      { tenantId: tid, contractNumber: 'CTR-0001', title: 'MegaCorp Master Services Agreement', counterparty: 'MegaCorp Industries', contractType: 'Customer', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), value: 360000, currency: 'USD', status: 'Approved' },
      { tenantId: tid, contractNumber: 'CTR-0002', title: 'Office Lease - 1 Martin Place', counterparty: 'Sydney Commercial Realty', contractType: 'Lease', startDate: new Date('2023-07-01'), endDate: new Date('2028-06-30'), value: 1368000, currency: 'USD', status: 'Approved' },
      { tenantId: tid, contractNumber: 'CTR-0003', title: 'AWS Enterprise Agreement', counterparty: 'Amazon Web Services', contractType: 'Supplier', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), value: 165600, currency: 'USD', status: 'Approved' },
      { tenantId: tid, contractNumber: 'CTR-0004', title: 'Enterprise Solutions - Global Licence', counterparty: 'Enterprise Solutions Ltd', contractType: 'Customer', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'), value: 528000, currency: 'USD', status: 'Draft' },
    ],
  });

  console.log('✓ Contracts created');

  // ─── Budget ───────────────────────────────────────────────────────────────────
  const budget = await prisma.budget.create({
    data: {
      tenantId: tid, name: 'FY2026 Annual Budget', fiscalYear: '2026',
      currency: 'USD', status: 'Approved',
      approvedBy: cfoDave.id, approvedAt: new Date('2025-12-15'),
      totalAmount: 0,
    },
  });

  const budgetLines = [
    // Revenue
    { accountCode: '4100', accountName: 'Software Revenue', months: [180000, 185000, 190000, 195000, 200000, 205000, 210000, 215000, 220000, 225000, 230000, 235000] },
    { accountCode: '4200', accountName: 'Consulting Revenue', months: [85000, 88000, 90000, 92000, 88000, 90000, 85000, 88000, 90000, 92000, 95000, 98000] },
    { accountCode: '4300', accountName: 'Support Revenue', months: [38000, 40000, 40000, 41000, 42000, 42000, 43000, 43000, 44000, 44000, 45000, 45000] },
    // Expenses
    { accountCode: '6100', accountName: 'Salaries & Wages', months: [125000, 125000, 128000, 128000, 130000, 130000, 132000, 132000, 135000, 135000, 138000, 138000] },
    { accountCode: '6200', accountName: 'Rent & Occupancy', months: [18500, 18500, 18500, 18500, 18500, 18500, 19000, 19000, 19000, 19000, 19000, 19000] },
    { accountCode: '6500', accountName: 'IT & Software', months: [12000, 12000, 12400, 12400, 13000, 13000, 13500, 13500, 14000, 14000, 14500, 14500] },
  ];

  const allBudgetLines: { tenantId: string; budgetId: string; accountCode: string; accountName: string; period: string; amount: number }[] = [];
  for (const bl of budgetLines) {
    for (let m = 0; m < 12; m++) {
      allBudgetLines.push({
        tenantId: tid, budgetId: budget.id,
        accountCode: bl.accountCode, accountName: bl.accountName,
        period: `2026-${String(m + 1).padStart(2, '0')}`,
        amount: bl.months[m],
      });
    }
  }
  await prisma.budgetLine.createMany({ data: allBudgetLines });
  await prisma.budget.update({ where: { id: budget.id }, data: { totalAmount: allBudgetLines.reduce((s, l) => s + l.amount, 0) } });

  console.log('✓ Budget created');

  // ─── Audit log entries ────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { tenantId: tid, actorId: adminUser.id, action: 'login', resourceType: 'user', resourceId: adminUser.id, createdAt: new Date('2026-09-19T08:00:00Z') },
      { tenantId: tid, actorId: controllerLisa.id, action: 'approve', resourceType: 'bill', resourceId: 'BILL-00001', createdAt: new Date('2026-09-03T10:22:00Z') },
      { tenantId: tid, actorId: cfoDave.id, action: 'approve', resourceType: 'payment_run', resourceId: 'PAY-00001', createdAt: new Date('2026-09-24T14:05:00Z') },
      { tenantId: tid, actorId: controllerLisa.id, action: 'post', resourceType: 'journal', resourceId: 'JNL-00001', createdAt: new Date('2026-01-16T09:30:00Z') },
    ],
  });

  console.log('\n✅  Seed complete!');
  console.log('─────────────────────────────────');
  console.log('Demo login credentials:');
  console.log('  admin@demo.com   / Demo@1234  (Owner)');
  console.log('  cfo@demo.com     / Demo@1234  (CFO)');
  console.log('  controller@demo.com / Demo@1234  (Controller)');
  console.log('  accountant@demo.com / Demo@1234  (Accountant)');
  console.log('  Workspace slug: demo');
  console.log('─────────────────────────────────');
}

main()
  .catch((e) => { console.error('❌  Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

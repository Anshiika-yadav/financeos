import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { writeAuditLogTx } from '../../services/audit.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'payroll_run', module: 'payroll' });
    const { tenantId } = req.tenantContext!;
    const runs = await req.withTenantDb!((tx) =>
      tx.payrollRun.findMany({ where: { tenantId }, orderBy: { payPeriodEnd: 'desc' } }),
    );
    sendSuccess(res, runs);
  } catch (e) { next(e); }
});

router.get('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'payroll_run', module: 'payroll' });
    const { tenantId } = req.tenantContext!;
    const run = await req.withTenantDb!((tx) =>
      tx.payrollRun.findFirst({ where: { id: req.params.id, tenantId }, include: { lines: true } }),
    );
    if (!run) return sendNotFound(res, 'Payroll Run');
    sendSuccess(res, run);
  } catch (e) { next(e); }
});

/**
 * Ingests results already computed by an external payroll provider.
 * This module never calculates pay itself.
 */
router.post('/runs/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'payroll_run', module: 'payroll' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      externalReference: z.string().min(1),
      payPeriodStart: z.string(),
      payPeriodEnd: z.string(),
      lines: z.array(z.object({
        employeeReference: z.string(),
        grossPay: z.number().min(0),
        deductions: z.number().min(0).default(0),
        netPay: z.number().min(0),
        employerCost: z.number().min(0).default(0),
      })).min(1),
    }).parse(req.body);

    const totals = body.lines.reduce(
      (acc, l) => ({
        gross: acc.gross + l.grossPay,
        net: acc.net + l.netPay,
        employer: acc.employer + l.employerCost,
      }),
      { gross: 0, net: 0, employer: 0 },
    );

    const run = await req.withTenantDb!(async (tx) => {
      const created = await tx.payrollRun.create({
        data: {
          tenantId,
          externalReference: body.externalReference,
          payPeriodStart: new Date(body.payPeriodStart),
          payPeriodEnd: new Date(body.payPeriodEnd),
          totalGross: totals.gross, totalNet: totals.net, totalEmployerCost: totals.employer,
          lines: { create: body.lines.map((l) => ({ tenantId, ...l })) },
        },
        include: { lines: true },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'import', resourceType: 'payroll_run',
        resourceId: created.id, correlationId: req.correlationId,
      });
      return created;
    });

    sendCreated(res, run);
  } catch (e) { next(e); }
});

/**
 * Posts the run's TOTALS to the GL as a single summarized journal —
 * never per-employee lines. Caller supplies which GL accounts to debit
 * (payroll expense) and credit (payroll liability / bank).
 */
router.post('/runs/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'post', { type: 'payroll_run', module: 'payroll' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      fiscalPeriodId: z.string().uuid(),
      expenseAccountId: z.string().uuid(),
      liabilityAccountId: z.string().uuid(),
      postingDate: z.string(),
    }).parse(req.body);

    const result = await req.withTenantDb!(async (tx) => {
      const run = await tx.payrollRun.findFirst({ where: { id: req.params.id, tenantId } });
      if (!run) return null;
      if (run.status !== 'Imported') {
        throw new AppError(422, 'Only Imported runs can be posted');
      }

      const period = await tx.fiscalPeriod.findFirst({ where: { id: body.fiscalPeriodId, tenantId } });
      if (!period || period.status !== 'Open') {
        throw new AppError(422, 'Fiscal period is not open');
      }

      const count = await tx.glJournal.count({ where: { tenantId } });
      const journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
      const total = Number(run.totalGross) + Number(run.totalEmployerCost);

      const journal = await tx.glJournal.create({
        data: {
          tenantId, journalNumber,
          description: `Payroll posting — ${run.externalReference}`,
          fiscalPeriodId: period.id,
          postingDate: new Date(body.postingDate),
          status: 'Posted',
          sourceModule: 'payroll', sourceId: run.id,
          createdBy: actorId, postedBy: actorId, postedAt: new Date(),
          totalDebit: total, totalCredit: total,
          lines: {
            create: [
              { tenantId, lineNumber: 1, accountId: body.expenseAccountId, debit: total, credit: 0, currency: 'USD' },
              { tenantId, lineNumber: 2, accountId: body.liabilityAccountId, debit: 0, credit: total, currency: 'USD' },
            ],
          },
        },
      });

      const updated = await tx.payrollRun.update({
        where: { id: run.id },
        data: { status: 'Posted', journalId: journal.id },
      });

      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'post', resourceType: 'payroll_run',
        resourceId: run.id, after: { journalId: journal.id }, correlationId: req.correlationId,
      });

      return { run: updated, journal };
    });

    if (!result) return sendNotFound(res, 'Payroll Run');
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

export default router;

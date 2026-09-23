import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

/**
 * Metadata-only in this pass — real file storage (S3/GCS/etc.) is mocked
 * behind this same interface, exactly like the AP module mocks OCR, so
 * it can be swapped in later without changing the API shape.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'document', module: 'documents' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      filename: z.string().min(1),
      mimeType: z.string().optional(),
      resourceType: z.string().min(1),
      resourceId: z.string().uuid(),
    }).parse(req.body);

    const storageKey = `tenants/${tenantId}/${body.resourceType}/${body.resourceId}/${crypto.randomUUID()}-${body.filename}`;
    const checksum = crypto.createHash('sha256').update(storageKey).digest('hex');

    const doc = await req.withTenantDb!((tx) =>
      tx.document.create({
        data: { tenantId, uploadedBy: actorId, storageKey, checksum, ...body },
      }),
    );

    // Mocked upload URL — a real implementation would return a signed
    // PUT URL from the object-storage provider here.
    sendCreated(res, { ...doc, uploadUrl: `mock://upload/${storageKey}` });
  } catch (e) { next(e); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'document', module: 'documents' });
    const { tenantId } = req.tenantContext!;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;

    const docs = await req.withTenantDb!((tx) =>
      tx.document.findMany({
        where: {
          tenantId, deletedAt: null,
          ...(resourceType ? { resourceType } : {}),
          ...(resourceId ? { resourceId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    sendSuccess(res, docs);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'delete', { type: 'document', module: 'documents' });
    const { tenantId } = req.tenantContext!;

    const deleted = await req.withTenantDb!(async (tx) => {
      const doc = await tx.document.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
      if (!doc) return null;
      return tx.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
    });

    if (!deleted) return sendNotFound(res, 'Document');
    sendSuccess(res, { deleted: true });
  } catch (e) { next(e); }
});

export default router;

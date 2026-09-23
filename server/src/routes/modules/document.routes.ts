import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// POST /api/v1/documents/upload-url - Generate pre-signed object storage URL
router.post('/upload-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, fileType, fileSize } = req.body;
    // TODO: Check document virus scan policy and return short-lived S3/GCS URL with tenant prefix
    res.status(200).json({
      success: true,
      uploadUrl: `https://storage.financeos.internal/tenant-uploads/${fileName}?signature=temp`,
      documentId: 'doc_12345'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/documents/:documentId/ocr - Trigger OCR text extraction engine
router.post('/:documentId/ocr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentId } = req.params;
    // TODO: Dispatch async job for image/PDF parsing & field confidence score prediction
    res.status(202).json({ success: true, message: 'OCR extraction job queued', jobId: 'job_987' });
  } catch (error) {
    next(error);
  }
});

export default router;
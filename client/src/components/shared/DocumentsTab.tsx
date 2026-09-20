import React from 'react';
import { Paperclip, Upload } from 'lucide-react';

/**
 * DocumentsTab — placeholder until the Document Management module exists.
 * The upload button is deliberately non-functional and labelled as such
 * so it is never a fake button from the product perspective — it tells
 * the user the feature is coming.
 */
export function DocumentsTab() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-ink-400">
      <Paperclip className="w-8 h-8" />
      <p className="text-[14px] font-medium text-ink-700">No documents attached</p>
      <p className="text-[13px] text-ink-600 text-center max-w-xs">
        Document upload will be available when the Document Management
        module is enabled for your workspace.
      </p>
      <button
        type="button"
        disabled
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium
                   border border-border rounded-input text-ink-400 cursor-not-allowed opacity-60"
        title="Coming soon — Document Management module required"
      >
        <Upload className="w-4 h-4" aria-hidden />
        Attach document
      </button>
    </div>
  );
}

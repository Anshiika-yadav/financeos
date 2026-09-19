import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { Button } from '../../components/shared/Button';
import { useAuth } from '../../store/auth.context';
import { apiPost } from '../../services/api';
import { tokenStore } from '../../services/api';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Organisation' },
  { id: 2, label: 'Plan' },
  { id: 3, label: 'Legal Entity' },
  { id: 4, label: 'Chart of Accounts' },
  { id: 5, label: 'Approval Matrix' },
  { id: 6, label: 'Ready' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// ─── Step 1: Organisation setup ───────────────────────────────────────────────

const orgSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  legalName: z.string().min(1),
  displayName: z.string().min(1),
  country: z.string().length(2),
  timezone: z.string().min(1),
  baseCurrency: z.string().length(3),
});

type OrgFormValues = z.infer<typeof orgSchema>;

const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
  { value: 'SG', label: 'Singapore' },
  { value: 'IN', label: 'India' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
];

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris / Berlin' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

// ─── Step 3: Legal entity + fiscal year ───────────────────────────────────────

const legalEntitySchema = z.object({
  entityName: z.string().min(1),
  fiscalYearStart: z.string().min(1), // MM-DD
});

type LegalEntityFormValues = z.infer<typeof legalEntitySchema>;

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface WizardState {
  tenantId?: string;
  tenantSlug?: string;
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { setTenantSlug } = useAuth();
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [wizardState, setWizardState] = useState<WizardState>({});

  const orgForm = useForm<OrgFormValues>({ resolver: zodResolver(orgSchema) });
  const entityForm = useForm<LegalEntityFormValues>({
    resolver: zodResolver(legalEntitySchema),
  });

  // Step 1: Create tenant
  const createTenantMutation = useMutation({
    mutationFn: (data: OrgFormValues) => apiPost<{ tenant: { id: string; slug: string } }>('/tenants', data),
    onSuccess: (result) => {
      setWizardState({ tenantId: result.tenant.id, tenantSlug: result.tenant.slug });
      tokenStore.setTenantSlug(result.tenant.slug);
      setTenantSlug(result.tenant.slug);
      setCurrentStep(2);
    },
  });

  const goToNext = () =>
    setCurrentStep((s) => Math.min(s + 1, STEPS.length) as StepId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-brand-700">FinanceOS</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Let&apos;s set up your workspace
        </p>
      </header>

      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Step progress */}
        <nav aria-label="Onboarding progress" className="mb-10">
          <ol className="flex items-center">
            {STEPS.map((step, idx) => (
              <li key={step.id} className="flex items-center flex-1 last:flex-none">
                <span className="flex items-center gap-2">
                  {step.id < currentStep ? (
                    <CheckCircle2
                      className="w-6 h-6 text-brand-600"
                      aria-hidden="true"
                    />
                  ) : step.id === currentStep ? (
                    <span className="w-6 h-6 rounded-full border-2 border-brand-600 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
                    </span>
                  ) : (
                    <Circle className="w-6 h-6 text-gray-300" aria-hidden="true" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      step.id <= currentStep ? 'text-brand-700' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </span>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 mx-2 flex-shrink-0" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Step content */}
        <div className="bg-white rounded-lg shadow p-8">
          {currentStep === 1 && (
            <StepOrganisation
              form={orgForm}
              onSubmit={createTenantMutation.mutate}
              isLoading={createTenantMutation.isPending}
              error={createTenantMutation.isError ? 'Could not create organisation. Slug may already be taken.' : undefined}
            />
          )}

          {currentStep === 2 && (
            <StepPlan onNext={goToNext} />
          )}

          {currentStep === 3 && (
            <StepLegalEntity
              form={entityForm}
              tenantId={wizardState.tenantId!}
              onNext={goToNext}
            />
          )}

          {currentStep === 4 && (
            <StepChartOfAccounts onNext={goToNext} />
          )}

          {currentStep === 5 && (
            <StepApprovalMatrix onNext={goToNext} />
          )}

          {currentStep === 6 && (
            <StepReady onFinish={() => navigate('/dashboard')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Individual step components ───────────────────────────────────────────────

function StepOrganisation({
  form,
  onSubmit,
  isLoading,
  error,
}: {
  form: ReturnType<typeof useForm<OrgFormValues>>;
  onSubmit: (data: OrgFormValues) => void;
  isLoading: boolean;
  error?: string;
}) {
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Organisation setup</h2>
        <p className="text-sm text-gray-500 mt-1">
          This information will appear on invoices and reports.
        </p>
      </div>

      <Input
        label="Workspace URL"
        hint="acme → acme.financeos.com"
        required
        error={errors.slug?.message}
        {...register('slug')}
      />
      <Input
        label="Legal name"
        required
        error={errors.legalName?.message}
        {...register('legalName')}
      />
      <Input
        label="Display name"
        required
        error={errors.displayName?.message}
        {...register('displayName')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Country"
          required
          options={COUNTRY_OPTIONS}
          placeholder="Select country"
          error={errors.country?.message}
          {...register('country')}
        />
        <Select
          label="Base currency"
          required
          options={CURRENCY_OPTIONS}
          placeholder="Select currency"
          error={errors.baseCurrency?.message}
          {...register('baseCurrency')}
        />
      </div>

      <Select
        label="Timezone"
        required
        options={TIMEZONE_OPTIONS}
        placeholder="Select timezone"
        error={errors.timezone?.message}
        {...register('timezone')}
      />

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" isLoading={isLoading}>
          Continue
        </Button>
      </div>
    </form>
  );
}

function StepPlan({ onNext }: { onNext: () => void }) {
  const plans = [
    { id: 'starter', name: 'Starter', price: '$49/mo', features: ['GL, AP, AR', 'Up to 5 users', '1 entity'] },
    { id: 'growth', name: 'Growth', price: '$199/mo', features: ['All modules', 'Up to 25 users', '5 entities'] },
    { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['All modules', 'Unlimited users', 'Multi-entity consolidation'] },
  ];

  const [selected, setSelected] = useState('growth');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Choose your plan</h2>
        <p className="text-sm text-gray-500 mt-1">You can change this later.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelected(plan.id)}
            className={`rounded-lg border-2 p-4 text-left transition-colors ${
              selected === plan.id
                ? 'border-brand-600 bg-brand-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            aria-pressed={selected === plan.id}
          >
            <div className="font-semibold text-gray-900">{plan.name}</div>
            <div className="text-lg font-bold text-brand-700 mt-1">{plan.price}</div>
            <ul className="mt-3 space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}

function StepLegalEntity({
  form,
  tenantId: _tenantId,
  onNext,
}: {
  form: ReturnType<typeof useForm<LegalEntityFormValues>>;
  tenantId: string;
  onNext: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = form;

  const onSubmit = (_data: LegalEntityFormValues) => {
    // Would POST /api/v1/tenants/:id/legal-entities — wired up in Phase 2
    onNext();
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">First legal entity</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set up the first entity in your group. You can add more later.
        </p>
      </div>

      <Input
        label="Entity name"
        required
        error={errors.entityName?.message}
        {...register('entityName')}
      />

      <Input
        label="Fiscal year start (MM-DD)"
        placeholder="01-01"
        required
        hint="e.g. 01-01 for calendar year, 07-01 for Australian financial year"
        error={errors.fiscalYearStart?.message}
        {...register('fiscalYearStart')}
      />

      <div className="flex justify-end">
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}

function StepChartOfAccounts({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Chart of Accounts</h2>
        <p className="text-sm text-gray-500 mt-1">
          Start from a template or import your own.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {['GAAP (US)', 'IFRS', 'Australian Chart', 'UK Chart'].map((template) => (
          <button
            key={template}
            type="button"
            className="rounded-lg border-2 border-gray-200 p-4 text-left hover:border-brand-300 transition-colors"
          >
            <div className="font-medium text-gray-900">{template}</div>
            <div className="text-xs text-gray-500 mt-1">Standard template</div>
          </button>
        ))}
      </div>

      <div className="border-t pt-4 text-center">
        <p className="text-sm text-gray-500 mb-2">Or</p>
        <Button variant="secondary" type="button">Import CSV</Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>Use selected template</Button>
      </div>
    </div>
  );
}

function StepApprovalMatrix({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Approval matrix</h2>
        <p className="text-sm text-gray-500 mt-1">
          Define who approves transactions by amount and type. You can refine this later.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 divide-y">
        {[
          { range: '$0 – $1,000', approver: 'Any accountant' },
          { range: '$1,000 – $10,000', approver: 'Controller' },
          { range: '$10,000 – $50,000', approver: 'CFO' },
          { range: '$50,000+', approver: 'CEO + CFO (dual control)' },
        ].map((row) => (
          <div key={row.range} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">{row.range}</span>
            <span className="text-sm font-medium text-gray-900">{row.approver}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>Accept defaults</Button>
      </div>
    </div>
  );
}

function StepReady({ onFinish }: { onFinish: () => void }) {
  const checklist = [
    'Organisation created',
    'Plan selected',
    'Legal entity configured',
    'Chart of accounts loaded',
    'Approval rules set',
  ];

  return (
    <div className="space-y-6 text-center">
      <div>
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-gray-900 mt-4">
          You&apos;re ready to go!
        </h2>
        <p className="text-gray-500 mt-2">
          Your FinanceOS workspace is configured and ready.
        </p>
      </div>

      <ul className="text-left space-y-2 max-w-xs mx-auto">
        {checklist.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>

      <Button size="lg" onClick={onFinish}>
        Go to my workspace
      </Button>
    </div>
  );
}

import { z } from 'zod';

const ruleTypeEnum = z.enum(['blacklist', 'whitelist']);
const scopeEnum = z.enum(['domain', 'source', 'keyword']);
const matchTypeEnum = z.enum(['exact', 'contains', 'regex']);
const applyTargetEnum = z.enum(['ingestion', 'publishing', 'both']);
const actionEnum = z.enum(['block', 'allow']);

export const createFilterRuleSchema = z
    .object({
        rule_type: ruleTypeEnum,
        scope: scopeEnum,
        pattern: z.string().min(1).max(2000),
        match_type: matchTypeEnum.default('contains'),
        apply_target: applyTargetEnum.default('ingestion'),
        action: actionEnum.optional(),
        is_active: z.boolean().optional().default(true),
        priority: z.number().int().min(0).max(10000).default(100),
        metadata: z.record(z.unknown()).optional().default({}),
        reason: z.string().max(2000).optional().nullable(),
    })
    .superRefine((data, ctx) => {
        const expectedAction = data.rule_type === 'blacklist' ? 'block' : 'allow';
        if (data.action && data.action !== expectedAction) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `action must be ${expectedAction} for rule_type ${data.rule_type}`,
                path: ['action'],
            });
        }
        if (data.scope === 'source' && !z.string().uuid().safeParse(data.pattern).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'pattern must be a valid source UUID when scope is source',
                path: ['pattern'],
            });
        }
    });

export const updateFilterRuleSchema = createFilterRuleSchema.partial().extend({
    rule_type: ruleTypeEnum.optional(),
    scope: scopeEnum.optional(),
    pattern: z.string().min(1).max(2000).optional(),
});

export const evaluateFilterSchema = z.object({
    source_id: z.string().uuid().optional(),
    url: z.string().max(4000).optional(),
    text: z.string().max(50000).optional(),
    apply_target: applyTargetEnum.default('ingestion'),
});

export const filterRuleResponseSchema = z.object({
    id: z.string().uuid(),
    rule_type: ruleTypeEnum,
    scope: scopeEnum,
    pattern: z.string(),
    match_type: matchTypeEnum,
    apply_target: applyTargetEnum,
    action: actionEnum,
    is_active: z.boolean(),
    priority: z.number().int(),
    metadata: z.record(z.unknown()),
    reason: z.string().nullable().optional(),
    created_by: z.string().uuid().nullable().optional(),
    deleted_at: z.string().nullable().optional(),
    last_matched_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const listFilterRulesQuerySchema = z.object({
    rule_type: ruleTypeEnum.optional(),
    scope: scopeEnum.optional(),
    apply_target: applyTargetEnum.optional(),
    active_only: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform(v => v === true || v === 'true'),
});

export const uuidParamSchema = z.object({
    id: z.string().uuid(),
});

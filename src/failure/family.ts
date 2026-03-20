import type { ValidationResult } from '../types/validation';

export type FailureFamily =
    | 'wrong-java-or-launch-profile'
    | 'missing-trusted-dependency'
    | 'client-only-or-side-mismatch'
    | 'wrong-core-or-entrypoint'
    | 'timeout-before-ready'
    | 'unknown-startup-failure';

function inferPreliminaryFailureFamily(validation: ValidationResult | null | undefined): FailureFamily | null {
    if (!validation || !validation.runAttempted || validation.status === 'not-run' || validation.status === 'skipped') {
        return null;
    }

    if (validation.status === 'timed-out') {
        return 'timeout-before-ready';
    }

    const issueKinds = new Set((validation.issues || []).map((issue) => issue.kind));

    if (issueKinds.has('missing-dependency')) {
        return 'missing-trusted-dependency';
    }

    if (issueKinds.has('side-mismatch') || issueKinds.has('mixin-failure')) {
        return 'client-only-or-side-mismatch';
    }

    if (issueKinds.has('entrypoint-crash')) {
        return 'wrong-core-or-entrypoint';
    }

    if (issueKinds.has('class-loading')) {
        return 'unknown-startup-failure';
    }

    if (validation.status === 'error' && !validation.entrypoint) {
        return 'wrong-java-or-launch-profile';
    }

    if (validation.status === 'failed' || validation.status === 'error') {
        return 'unknown-startup-failure';
    }

    return null;
}

module.exports = {
    inferPreliminaryFailureFamily
};

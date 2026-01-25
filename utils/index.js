export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function truncateText(text, maxLength = 500) {
  if (text === null || text === undefined) return '';
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

export function summarizeResult(result, maxLength = 500) {
  if (typeof result === 'string') {
    return truncateText(result, maxLength);
  }
  if (result?.content?.[0]?.text) {
    return truncateText(result.content[0].text, maxLength);
  }
  return truncateText(JSON.stringify(result), maxLength);
}

const ERROR_PATTERNS = {
  timeout: [/timeout/i, /timed?\s*out/i],
  network: [/network/i, /connection/i, /econnrefused/i, /enotfound/i],
  rate_limit: [/rate.?limit/i, /too.?many.?requests/i, /429/],
  service_unavailable: [/503/, /502/, /504/, /service.?unavailable/i],
  permission: [/permission/i, /access.?denied/i, /forbidden/i, /403/],
  file_not_found: [/not.?found/i, /enoent/i, /404/],
  syntax_error: [/syntax/i, /parse.?error/i],
  validation: [/validation/i, /invalid/i, /schema/i],
  memory: [/memory/i, /heap/i],
  api_error: [/api/i, /rate limit/i]
};

export function classifyError(errorMessage) {
  const lowerMessage = (errorMessage || '').toLowerCase();
  
  for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (patterns.some(p => p.test(lowerMessage))) {
      return type;
    }
  }
  
  return 'unknown';
}

export function isRetryableError(errorType) {
  const retryableTypes = ['timeout', 'network', 'rate_limit', 'service_unavailable', 'api_error'];
  return retryableTypes.includes(errorType);
}

export function isNonRetryableError(errorType) {
  const nonRetryableTypes = ['permission', 'file_not_found', 'syntax_error', 'validation'];
  return nonRetryableTypes.includes(errorType);
}

const DEFAULT_BACKOFF_CONFIG = {
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.2
};

export function calculateBackoff(attempt, config = {}) {
  const { baseDelay, maxDelay, jitterFactor } = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const maxJitter = exponentialDelay * jitterFactor;
  const jitter = Math.random() * maxJitter * 2 - maxJitter;
  const delay = Math.min(exponentialDelay + jitter, maxDelay);
  return Math.max(delay, baseDelay);
}

export function shouldRetryError(error, attempt, maxRetries = 3) {
  if (attempt >= maxRetries) {
    return { retry: false, reason: 'max_retries_exceeded' };
  }
  
  const errorMessage = error?.message || String(error);
  const errorType = classifyError(errorMessage);
  
  if (isNonRetryableError(errorType)) {
    return { retry: false, reason: `non_retryable_error_type: ${errorType}` };
  }
  
  if (isRetryableError(errorType)) {
    return { 
      retry: true, 
      reason: `retryable_error_type: ${errorType}`,
      delay: calculateBackoff(attempt)
    };
  }
  
  return { retry: false, reason: 'unknown_error_type' };
}

export const ERROR_RESOLUTIONS = {
  timeout: 'Increase timeout or break task into smaller chunks',
  permission: 'Check file/directory permissions',
  file_not_found: 'Verify file path exists before operation',
  syntax_error: 'Review code syntax and structure',
  network: 'Check network connectivity or retry later',
  memory: 'Reduce batch size or optimize memory usage',
  api_error: 'Check API limits or credentials',
  rate_limit: 'Wait and retry with exponential backoff',
  service_unavailable: 'Service temporarily unavailable, retry later',
  validation: 'Check input data against schema requirements',
  unknown: 'Review error details and context'
};

export function suggestErrorResolution(errorType) {
  return ERROR_RESOLUTIONS[errorType] || ERROR_RESOLUTIONS.unknown;
}

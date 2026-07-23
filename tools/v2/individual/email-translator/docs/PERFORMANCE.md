# Email Translator — Performance Documentation

## Performance Constraints and Optimization

This document outlines performance considerations, bottlenecks, optimization strategies, and scalability limits for the Email Translator tool.

---

## Performance Budget

### Target Metrics

| Operation                        | Target  | Maximum |
| -------------------------------- | ------- | ------- |
| **Language detection**           | < 100ms | 500ms   |
| **Translation request**          | < 2s    | 10s     |
| **UI render (initial)**          | < 200ms | 500ms   |
| **Sanitization**                 | < 50ms  | 200ms   |
| **Clipboard copy**               | < 50ms  | 100ms   |
| **Re-render on language change** | < 100ms | 300ms   |

### Size Limits

| Resource                      | Soft Limit | Hard Limit | Rationale                            |
| ----------------------------- | ---------- | ---------- | ------------------------------------ |
| **Input text**                | 100 KB     | 1 MB       | Browser memory, provider API limits  |
| **Translated output**         | 150 KB     | 2 MB       | Provider responses may be longer     |
| **Simultaneous translations** | 1          | 3          | Avoid overwhelming provider, browser |
| **History entries**           | 10         | 50         | localStorage size, memory usage      |
| **Detected languages**        | 5          | 10         | Language detection confidence list   |

---

## Bottleneck Analysis

### 1. Large Email Bodies

**Scenario:** User pastes a 500 KB email with embedded quotes and formatting.

**Bottlenecks:**

- **HTML parsing**: DOMPurify may take 200-500ms on complex HTML
- **Network payload**: Large texts increase latency and provider costs
- **Provider timeout**: Some APIs reject >100 KB requests
- **Memory usage**: Multiple copies (raw → sanitized → translated) spike RAM

**Mitigations:**

```typescript
const CHUNK_SIZE = 50_000; // 50 KB chunks

async function translateLargeText(
  text: string,
  from: string,
  to: string,
  provider: TranslationProvider,
): Promise<string> {
  if (text.length <= CHUNK_SIZE) {
    return provider.translate(text, from, to);
  }

  // Split on sentence boundaries (basic heuristic)
  const chunks = splitIntoChunks(text, CHUNK_SIZE);

  // Translate chunks in series (avoid rate limits)
  const translated: string[] = [];
  for (const chunk of chunks) {
    const result = await provider.translate(chunk, from, to);
    translated.push(result);

    // Small delay to respect rate limits
    await sleep(100);
  }

  return translated.join(" ");
}

function splitIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;

    // Try to break on sentence boundary
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf(". ", end);
      if (sentenceEnd > start) {
        end = sentenceEnd + 1;
      }
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}
```

### 2. Language Detection on Every Keystroke

**Scenario:** User types in the input field with live language detection enabled.

**Bottlenecks:**

- **CPU usage**: Running detection on every keystroke wastes cycles
- **API abuse**: Repeatedly calling detection APIs burns quotas
- **UI lag**: Synchronous detection blocks rendering

**Mitigations:**

```typescript
import { debounce } from "lodash-es";

function useLanguageDetect(text: string, enabled: boolean) {
  const [detected, setDetected] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Debounce detection: only run 500ms after user stops typing
  const detectLanguage = useMemo(
    () =>
      debounce(async (input: string) => {
        if (input.length < 10) {
          // Skip detection for very short text
          setDetected(null);
          return;
        }

        setIsDetecting(true);
        try {
          const result = await languageDetector.detect(input);
          setDetected(result.code);
        } catch (err) {
          console.warn("Language detection failed:", err);
          setDetected(null);
        } finally {
          setIsDetecting(false);
        }
      }, 500),
    [],
  );

  useEffect(() => {
    if (enabled && text) {
      detectLanguage(text);
    }

    // Cleanup on unmount
    return () => detectLanguage.cancel();
  }, [text, enabled, detectLanguage]);

  return { detected, isDetecting };
}
```

### 3. Repeated Sanitization

**Scenario:** Sanitization runs multiple times in the render pipeline.

**Bottlenecks:**

- **CPU overhead**: DOMPurify is relatively expensive
- **Memory churn**: Creating many intermediate strings

**Mitigations:**

```typescript
// Memoize sanitized output
function TranslationOutput({ text }: { text: string }) {
  const sanitized = useMemo(() => {
    return sanitizeText(text);
  }, [text]);

  return <pre>{sanitized}</pre>;
}

// Cache sanitization results
const sanitizationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

function sanitizeTextCached(raw: string): string {
  if (sanitizationCache.has(raw)) {
    return sanitizationCache.get(raw)!;
  }

  const sanitized = sanitizeText(raw);

  // LRU eviction (simple)
  if (sanitizationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = sanitizationCache.keys().next().value;
    sanitizationCache.delete(firstKey);
  }

  sanitizationCache.set(raw, sanitized);
  return sanitized;
}
```

### 4. Provider API Latency

**Scenario:** Translation provider has high latency (3-5s per request).

**Bottlenecks:**

- **User perception**: Long waits feel broken
- **Network failures**: More time = higher chance of timeout
- **Blocking UI**: User can't interact during translation

**Mitigations:**

```typescript
// Timeout enforcement
async function translateWithTimeout(
  text: string,
  from: string,
  to: string,
  provider: TranslationProvider,
  timeoutMs: number = 10000,
): Promise<string> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await provider.translate(text, from, to, {
      signal: controller.signal,
    });
    return result;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Translation timed out. Try a shorter text or check your connection.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Optimistic UI updates
function useTranslation() {
  const [state, setState] = useState({
    translatedText: "",
    isLoading: false,
    error: null,
  });

  const translate = async (text: string, from: string, to: string) => {
    // Immediately show loading state
    setState({ translatedText: "", isLoading: true, error: null });

    try {
      const result = await translateWithTimeout(text, from, to, provider, 10000);
      setState({ translatedText: result, isLoading: false, error: null });
    } catch (err) {
      setState({ translatedText: "", isLoading: false, error: err.message });
    }
  };

  return { ...state, translate };
}
```

---

## Memory Management

### Garbage Collection Concerns

**Issues:**

- Large strings create GC pressure
- Translation history accumulates in memory
- Closures in hooks retain old state

**Solutions:**

```typescript
// Limit history size
const MAX_HISTORY_ENTRIES = 10;

function useTranslationHistory() {
  const [history, setHistory] = useState<TranslationEntry[]>([]);

  const addToHistory = useCallback((entry: TranslationEntry) => {
    setHistory((prev) => {
      const updated = [entry, ...prev];
      // Keep only recent entries
      return updated.slice(0, MAX_HISTORY_ENTRIES);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addToHistory, clearHistory };
}

// Release large objects explicitly
function EmailTranslatorShell({ sourceText }: Props) {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Cancel pending requests on unmount
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  // ...
}
```

### LocalStorage Limits

**Issue:** Browser localStorage is typically 5-10 MB per origin.

**Solution:**

```typescript
const STORAGE_KEY = "email-translator-history";
const MAX_STORAGE_SIZE = 500_000; // 500 KB

function persistHistory(history: TranslationEntry[]): void {
  try {
    const serialized = JSON.stringify(history);

    if (serialized.length > MAX_STORAGE_SIZE) {
      // Truncate old entries
      const truncated = history.slice(0, Math.floor(history.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(truncated));
      console.warn("Translation history truncated to fit storage limits");
    } else {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch (err) {
    // QuotaExceededError
    console.error("Failed to persist translation history:", err);
    localStorage.removeItem(STORAGE_KEY); // Clear and start fresh
  }
}
```

---

## Network Optimization

### Request Deduplication

**Issue:** User rapidly changes source/target languages, sending duplicate requests.

**Solution:**

```typescript
const requestCache = new Map<string, Promise<string>>();

function getCacheKey(text: string, from: string, to: string): string {
  return `${from}:${to}:${text.slice(0, 100)}`; // Hash would be better
}

async function translateWithCache(
  text: string,
  from: string,
  to: string,
  provider: TranslationProvider,
): Promise<string> {
  const key = getCacheKey(text, from, to);

  if (requestCache.has(key)) {
    // Reuse in-flight or cached request
    return requestCache.get(key)!;
  }

  const promise = provider
    .translate(text, from, to)
    .then((result) => {
      // Cache result for 5 minutes
      setTimeout(() => requestCache.delete(key), 5 * 60 * 1000);
      return result;
    })
    .catch((err) => {
      // Don't cache errors
      requestCache.delete(key);
      throw err;
    });

  requestCache.set(key, promise);
  return promise;
}
```

### Request Cancellation

**Issue:** User changes language mid-translation, wasting the in-flight request.

**Solution:**

```typescript
function useTranslation() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const translate = async (text: string, from: string, to: string) => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const result = await provider.translate(text, from, to, {
        signal: abortControllerRef.current.signal,
      });
      return result;
    } catch (err) {
      if (err.name === "AbortError") {
        // Silently ignore cancelled requests
        return null;
      }
      throw err;
    }
  };

  return { translate };
}
```

---

## UI Performance

### Virtual Scrolling for History

**Issue:** Rendering 50+ history entries causes jank.

**Solution:**

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function TranslationHistory({ entries }: { entries: TranslationEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height per entry
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <HistoryEntry entry={entries[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Lazy Component Loading

**Issue:** EmailTranslatorShell bundles all components even if user never uses history.

**Solution:**

```typescript
import { lazy, Suspense } from 'react';

const TranslationHistory = lazy(() => import('./TranslationHistory'));
const AdvancedSettings = lazy(() => import('./AdvancedSettings'));

function EmailTranslatorShell() {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div>
      {/* Always visible components */}
      <TranslationInput />
      <TranslationOutput />

      {/* Lazy-loaded components */}
      {showHistory && (
        <Suspense fallback={<div>Loading history...</div>}>
          <TranslationHistory />
        </Suspense>
      )}
    </div>
  );
}
```

---

## Scalability Considerations

### Multi-Email Batch Translation

**Future scenario:** User wants to translate 100 emails in their inbox.

**Challenges:**

- Provider rate limits (e.g., 60 requests/minute)
- Memory exhaustion from loading all emails
- UI freezing during bulk operation

**Design guidance:**

```typescript
// Rate-limited queue
class RateLimitedQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private requestsPerMinute: number;
  private interval: number;

  constructor(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
    this.interval = 60000 / requestsPerMinute; // ms between requests
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
      await sleep(this.interval);
    }

    this.processing = false;
  }
}

// Usage
const translationQueue = new RateLimitedQueue(60); // 60 req/min

async function translateBatch(emails: Email[]): Promise<TranslatedEmail[]> {
  const results = await Promise.all(
    emails.map((email) =>
      translationQueue.add(() => translateEmail(email.body, email.from, targetLang)),
    ),
  );

  return results;
}
```

### Team/Organization Use

**Future scenario:** 10 users in a team translate simultaneously.

**Challenges:**

- Shared API quota exhaustion
- Lack of translation caching across users
- No cost visibility or budgeting

**Design guidance:**

- Implement server-side translation queue
- Share translation cache via backend (Redis)
- Add per-user/per-team rate limits
- Track and display API usage costs
- Implement billing/quota alerts

---

## Performance Testing

### Load Test Scenarios

1. **Large text translation**
   - Input: 500 KB email body
   - Expected: Chunks processed in <30s total
   - Memory: <100 MB peak usage

2. **Rapid language switching**
   - Action: Change target language 10 times in 5s
   - Expected: Only final request completes, others cancelled
   - Network: ≤1 active request at a time

3. **History overflow**
   - Action: Add 100 entries to history
   - Expected: LRU eviction keeps only 10, localStorage <500 KB

4. **Concurrent translations**
   - Action: Open 3 translator instances, translate simultaneously
   - Expected: All complete in <10s, no memory leaks

5. **Offline resilience**
   - Action: Disconnect network mid-translation
   - Expected: Timeout after 10s, clear error message

### Monitoring Metrics

```typescript
// Performance observer
function measureTranslationPerformance(
  text: string,
  from: string,
  to: string,
  provider: TranslationProvider,
) {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize;

  return provider.translate(text, from, to).then((result) => {
    const duration = performance.now() - startTime;
    const endMemory = (performance as any).memory?.usedJSHeapSize;
    const memoryDelta = endMemory - startMemory;

    // Log metrics (send to analytics in production)
    console.info("Translation performance:", {
      duration,
      memoryDelta,
      inputSize: text.length,
      outputSize: result.length,
      provider: provider.name,
    });

    return result;
  });
}
```

---

## Optimization Checklist

Before merging any translation feature:

- [ ] Input size limits enforced
- [ ] Sanitization is memoized/cached
- [ ] Language detection is debounced
- [ ] Provider requests have timeouts
- [ ] Requests are cancelled on component unmount
- [ ] History has size limits
- [ ] LocalStorage writes are guarded
- [ ] Large lists use virtual scrolling
- [ ] Heavy components are lazy-loaded
- [ ] No unnecessary re-renders (use React DevTools Profiler)
- [ ] Bundle size increase is <50 KB gzipped
- [ ] Performance metrics logged in development

---

## Future Optimization Opportunities

1. **WebAssembly language detection**: Replace heuristic detection with fast ML model
2. **Service Worker caching**: Offline support for previously translated texts
3. **IndexedDB storage**: Move history from localStorage to IndexedDB for larger capacity
4. **Server-side translation**: Cache common translations server-side
5. **Streaming responses**: Show partial translations as they arrive (provider-dependent)
6. **HTTP/2 multiplexing**: Send multiple translation requests in parallel
7. **Differential translation**: Only re-translate changed portions of text

---

**Last Updated:** 2026-07-23  
**Version:** 1.0.0  
**Status:** Initial performance documentation

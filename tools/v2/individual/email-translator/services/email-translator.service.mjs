const DEFAULT_OPTIONS = {
  now: "2026-07-01T00:00:00.000Z",
  maxTextChars: 6000,
};

const SUPPORTED_LANGUAGES = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

const LANGUAGE_HINTS = {
  en: ["the", "please", "thank", "meeting", "invoice", "deadline", "review", "hello"],
  es: ["hola", "gracias", "por favor", "reunion", "factura", "plazo", "revision"],
  fr: ["bonjour", "merci", "s'il vous plait", "reunion", "facture", "delai", "examen"],
  de: ["hallo", "danke", "bitte", "besprechung", "rechnung", "frist", "prufung"],
  pt: ["ola", "obrigado", "por favor", "reuniao", "fatura", "prazo", "revisao"],
};

const PHRASEBOOK = {
  "en:es": [
    ["Hello", "Hola"],
    ["Hi", "Hola"],
    ["Good morning", "Buenos dias"],
    ["Good afternoon", "Buenas tardes"],
    ["Please review", "Por favor revise"],
    ["Please confirm", "Por favor confirme"],
    ["Thank you", "Gracias"],
    ["Best regards", "Saludos cordiales"],
    ["meeting notes", "notas de la reunion"],
    ["invoice", "factura"],
    ["deadline", "plazo"],
    ["next steps", "proximos pasos"],
    ["project update", "actualizacion del proyecto"],
  ],
  "en:fr": [
    ["Hello", "Bonjour"],
    ["Hi", "Bonjour"],
    ["Good morning", "Bonjour"],
    ["Good afternoon", "Bon apres-midi"],
    ["Please review", "Veuillez examiner"],
    ["Please confirm", "Veuillez confirmer"],
    ["Thank you", "Merci"],
    ["Best regards", "Cordialement"],
    ["meeting notes", "notes de reunion"],
    ["invoice", "facture"],
    ["deadline", "delai"],
    ["next steps", "prochaines etapes"],
    ["project update", "mise a jour du projet"],
  ],
  "en:de": [
    ["Hello", "Hallo"],
    ["Hi", "Hallo"],
    ["Good morning", "Guten Morgen"],
    ["Good afternoon", "Guten Tag"],
    ["Please review", "Bitte prufen"],
    ["Please confirm", "Bitte bestatigen"],
    ["Thank you", "Danke"],
    ["Best regards", "Mit freundlichen Grussen"],
    ["meeting notes", "Besprechungsnotizen"],
    ["invoice", "Rechnung"],
    ["deadline", "Frist"],
    ["next steps", "nachste Schritte"],
    ["project update", "Projektaktualisierung"],
  ],
  "es:en": [
    ["Hola", "Hello"],
    ["Gracias", "Thank you"],
    ["Por favor revise", "Please review"],
    ["Por favor confirme", "Please confirm"],
    ["factura", "invoice"],
    ["plazo", "deadline"],
    ["reunion", "meeting"],
    ["proximos pasos", "next steps"],
  ],
  "fr:en": [
    ["Bonjour", "Hello"],
    ["Merci", "Thank you"],
    ["Veuillez examiner", "Please review"],
    ["Veuillez confirmer", "Please confirm"],
    ["facture", "invoice"],
    ["delai", "deadline"],
    ["reunion", "meeting"],
    ["prochaines etapes", "next steps"],
  ],
  "de:en": [
    ["Hallo", "Hello"],
    ["Danke", "Thank you"],
    ["Bitte prufen", "Please review"],
    ["Bitte bestatigen", "Please confirm"],
    ["Rechnung", "invoice"],
    ["Frist", "deadline"],
    ["Besprechung", "meeting"],
    ["nachste Schritte", "next steps"],
  ],
  "pt:en": [
    ["Ola", "Hello"],
    ["Obrigado", "Thank you"],
    ["Por favor revise", "Please review"],
    ["Por favor confirme", "Please confirm"],
    ["fatura", "invoice"],
    ["prazo", "deadline"],
    ["reuniao", "meeting"],
    ["proximos passos", "next steps"],
  ],
};

const WORD_MAPS = {
  "en:es": {
    approve: "aprobar",
    attached: "adjunto",
    copy: "copia",
    draft: "borrador",
    email: "correo",
    file: "archivo",
    hello: "hola",
    invoice: "factura",
    meeting: "reunion",
    notes: "notas",
    plan: "plan",
    please: "por favor",
    review: "revise",
    send: "envie",
    team: "equipo",
    thanks: "gracias",
    tomorrow: "manana",
  },
  "en:fr": {
    approve: "approuver",
    attached: "joint",
    copy: "copie",
    draft: "brouillon",
    email: "courriel",
    file: "fichier",
    hello: "bonjour",
    invoice: "facture",
    meeting: "reunion",
    notes: "notes",
    plan: "plan",
    please: "veuillez",
    review: "examiner",
    send: "envoyer",
    team: "equipe",
    thanks: "merci",
    tomorrow: "demain",
  },
  "en:de": {
    approve: "genehmigen",
    attached: "angehangt",
    copy: "kopie",
    draft: "entwurf",
    email: "email",
    file: "datei",
    hello: "hallo",
    invoice: "rechnung",
    meeting: "besprechung",
    notes: "notizen",
    plan: "plan",
    please: "bitte",
    review: "prufen",
    send: "senden",
    team: "team",
    thanks: "danke",
    tomorrow: "morgen",
  },
  "es:en": {
    aprobar: "approve",
    archivo: "file",
    borrador: "draft",
    correo: "email",
    equipo: "team",
    factura: "invoice",
    gracias: "thanks",
    hola: "hello",
    manana: "tomorrow",
    notas: "notes",
    plan: "plan",
    reunion: "meeting",
    revise: "review",
  },
  "fr:en": {
    approuver: "approve",
    bonjour: "hello",
    brouillon: "draft",
    courriel: "email",
    demain: "tomorrow",
    equipe: "team",
    examiner: "review",
    facture: "invoice",
    fichier: "file",
    joint: "attached",
    merci: "thanks",
    notes: "notes",
    plan: "plan",
    reunion: "meeting",
  },
  "de:en": {
    angehangt: "attached",
    besprechung: "meeting",
    bitte: "please",
    danke: "thanks",
    datei: "file",
    email: "email",
    entwurf: "draft",
    genehmigen: "approve",
    hallo: "hello",
    kopie: "copy",
    morgen: "tomorrow",
    notizen: "notes",
    plan: "plan",
    prufen: "review",
    rechnung: "invoice",
    senden: "send",
    team: "team",
  },
  "pt:en": {
    arquivo: "file",
    email: "email",
    equipe: "team",
    fatura: "invoice",
    notas: "notes",
    obrigado: "thanks",
    ola: "hello",
    plano: "plan",
    prazo: "deadline",
    reuniao: "meeting",
    revisar: "review",
  },
};

function normalizeLanguageCode(value) {
  const code = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!code || code === "auto") {
    return "auto";
  }
  return code.slice(0, 2);
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function clipText(value, limit) {
  const text = normalizeText(value);
  if (text.length <= limit) {
    return {
      text,
      clipped: false,
    };
  }

  return {
    text: text.slice(0, limit).trimEnd(),
    clipped: true,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWords(value) {
  const matches = String(value).match(/[A-Za-z0-9']+/g);
  return matches ? matches.length : 0;
}

function splitSegments(text) {
  return text.split(/(\n{2,})/).map((part, index) => ({
    id: `segment-${index + 1}`,
    kind: /^\n+$/.test(part) ? "separator" : "text",
    sourceText: part,
  }));
}

function preserveCase(source, translated) {
  if (!source) {
    return translated;
  }

  if (source === source.toUpperCase()) {
    return translated.toUpperCase();
  }

  if (source.charAt(0) === source.charAt(0).toUpperCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  return translated;
}

function replacePhrases(text, phrasePairs) {
  let translated = text;
  let replacements = 0;

  for (const [source, target] of phrasePairs) {
    const pattern = new RegExp(`\\b${escapeRegExp(source)}\\b`, "gi");
    translated = translated.replace(pattern, (match) => {
      replacements += 1;
      return preserveCase(match, target);
    });
  }

  return {
    text: translated,
    replacements,
  };
}

function replaceWords(text, wordMap) {
  const untranslatedTerms = new Set();
  let replacements = 0;

  const translated = text.replace(/\b[A-Za-z']+\b/g, (word) => {
    const normalized = word.toLowerCase();
    const translatedWord = wordMap[normalized];

    if (!translatedWord) {
      if (word.length > 3) {
        untranslatedTerms.add(normalized);
      }
      return word;
    }

    replacements += 1;
    return preserveCase(word, translatedWord);
  });

  return {
    text: translated,
    replacements,
    untranslatedTerms: [...untranslatedTerms].slice(0, 12),
  };
}

function scoreLanguage(text, languageCode) {
  const lowered = text.toLowerCase();
  return LANGUAGE_HINTS[languageCode].reduce((score, hint) => {
    return lowered.includes(hint) ? score + 1 : score;
  }, 0);
}

function detectLanguage(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      language: "unknown",
      confidence: 0,
      scores: {},
    };
  }

  const scores = Object.fromEntries(
    Object.keys(SUPPORTED_LANGUAGES).map((languageCode) => [
      languageCode,
      scoreLanguage(normalized, languageCode),
    ]),
  );
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [language, score] = sorted[0];
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);

  if (score === 0 || total === 0) {
    return {
      language: "unknown",
      confidence: 0.25,
      scores,
    };
  }

  return {
    language,
    confidence: Math.min(0.98, Math.max(0.5, score / total)),
    scores,
  };
}

function getPair(sourceLanguage, targetLanguage) {
  return `${sourceLanguage}:${targetLanguage}`;
}

function getSupportedLanguagePairs() {
  return Object.keys(PHRASEBOOK).sort();
}

function validateTranslationRequest(request, options = {}) {
  const maxTextChars = options.maxTextChars ?? DEFAULT_OPTIONS.maxTextChars;
  const errors = [];

  if (!request || typeof request !== "object") {
    return {
      valid: false,
      errors: [
        {
          code: "invalid-request",
          message: "Translation request must be an object.",
        },
      ],
    };
  }

  const sourceText = String(request.sourceText ?? request.text ?? "").trim();
  if (!sourceText) {
    errors.push({
      code: "empty-source-text",
      message: "sourceText is required.",
    });
  }

  if (/<script\b|javascript:/i.test(sourceText)) {
    errors.push({
      code: "active-content",
      message: "sourceText contains active markup and must be reviewed before translation.",
    });
  }

  if (sourceText.length > maxTextChars * 2) {
    errors.push({
      code: "source-text-too-long",
      message: "sourceText is too long for the local Email Translator contract.",
    });
  }

  const targetLanguage = normalizeLanguageCode(request.targetLanguage);
  if (targetLanguage === "auto" || !SUPPORTED_LANGUAGES[targetLanguage]) {
    errors.push({
      code: "unsupported-target-language",
      message: "A supported targetLanguage is required.",
    });
  }

  const requestedSourceLanguage = normalizeLanguageCode(request.sourceLanguage);
  if (
    requestedSourceLanguage !== "auto" &&
    requestedSourceLanguage !== "unknown" &&
    !SUPPORTED_LANGUAGES[requestedSourceLanguage]
  ) {
    errors.push({
      code: "unsupported-source-language",
      message: "sourceLanguage must be auto or a supported language code.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function createEmailTranslatorLoadingState(message = "Translating email") {
  return {
    status: "loading",
    isLoading: true,
    error: null,
    result: null,
    message,
  };
}

function createEmailTranslatorErrorState(errors, requestId = null) {
  const normalizedErrors = Array.isArray(errors) ? errors : [errors];

  return {
    status: "error",
    isLoading: false,
    error: {
      code: "email-translator-error",
      messages: normalizedErrors.map((error) =>
        typeof error === "string" ? error : error.message || "Unknown translation error",
      ),
    },
    result: null,
    requestId,
  };
}

function translateSegment(segment, phrasePairs, wordMap) {
  if (segment.kind === "separator") {
    return {
      ...segment,
      translatedText: segment.sourceText,
      replacements: 0,
      untranslatedTerms: [],
    };
  }

  const phraseResult = replacePhrases(segment.sourceText, phrasePairs);
  const wordResult = replaceWords(phraseResult.text, wordMap);

  return {
    ...segment,
    translatedText: wordResult.text,
    replacements: phraseResult.replacements + wordResult.replacements,
    untranslatedTerms: wordResult.untranslatedTerms,
  };
}

function translateEmail(request, options = {}) {
  const settings = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const validation = validateTranslationRequest(request, settings);

  if (!validation.valid) {
    return createEmailTranslatorErrorState(validation.errors, request?.id ?? null);
  }

  const sourceText = clipText(request.sourceText ?? request.text, settings.maxTextChars);
  const targetLanguage = normalizeLanguageCode(request.targetLanguage);
  const requestedSourceLanguage = normalizeLanguageCode(request.sourceLanguage);
  const detection = detectLanguage(sourceText.text);
  const sourceLanguage =
    requestedSourceLanguage === "auto" || requestedSourceLanguage === "unknown"
      ? detection.language
      : requestedSourceLanguage;

  if (!SUPPORTED_LANGUAGES[sourceLanguage]) {
    return createEmailTranslatorErrorState(
      [
        {
          code: "unknown-source-language",
          message: "The source language could not be detected from the provided text.",
        },
      ],
      request.id ?? null,
    );
  }

  if (sourceLanguage === targetLanguage) {
    return createEmailTranslatorErrorState(
      [
        {
          code: "same-language",
          message: "sourceLanguage and targetLanguage must be different.",
        },
      ],
      request.id ?? null,
    );
  }

  const pair = getPair(sourceLanguage, targetLanguage);
  const phrasePairs = PHRASEBOOK[pair];
  const wordMap = WORD_MAPS[pair];

  if (!phrasePairs || !wordMap) {
    return createEmailTranslatorErrorState(
      [
        {
          code: "unsupported-language-pair",
          message: `No local mock provider exists for ${pair}.`,
        },
      ],
      request.id ?? null,
    );
  }

  const sourceSegments = splitSegments(sourceText.text);
  const translatedSegments = sourceSegments.map((segment) =>
    translateSegment(segment, phrasePairs, wordMap),
  );
  const translatedText = translatedSegments.map((segment) => segment.translatedText).join("");
  const replacements = translatedSegments.reduce((sum, segment) => sum + segment.replacements, 0);
  const untranslatedTerms = [
    ...new Set(translatedSegments.flatMap((segment) => segment.untranslatedTerms)),
  ].slice(0, 12);
  const sourceWordCount = countWords(sourceText.text);
  const confidence = Math.max(
    0.35,
    Math.min(0.98, (replacements / Math.max(1, sourceWordCount)) * 2 + detection.confidence / 3),
  );
  const warnings = [];

  if (sourceText.clipped) {
    warnings.push({
      code: "source-text-clipped",
      message: "sourceText was clipped to the local review limit.",
    });
  }

  if (untranslatedTerms.length > 0) {
    warnings.push({
      code: "untranslated-terms",
      message: "Some terms were preserved because the local phrasebook has no mapping.",
    });
  }

  return {
    status: "ready",
    isLoading: false,
    error: null,
    result: {
      id: String(request.id ?? "translation-request"),
      generatedAt: settings.now,
      provider: "local-deterministic-phrasebook",
      sourceLanguage,
      sourceLanguageName: SUPPORTED_LANGUAGES[sourceLanguage],
      targetLanguage,
      targetLanguageName: SUPPORTED_LANGUAGES[targetLanguage],
      detectedLanguage: detection.language,
      detectionConfidence: detection.confidence,
      translatedText,
      segments: translatedSegments.map((segment) => ({
        id: segment.id,
        sourceText: segment.sourceText,
        translatedText: segment.translatedText,
        replacements: segment.replacements,
      })),
      untranslatedTerms,
      warnings,
      metrics: {
        sourceCharacters: sourceText.text.length,
        translatedCharacters: translatedText.length,
        sourceWordCount,
        translatedWordCount: countWords(translatedText),
        replacements,
        confidence,
      },
      reviewRequired: confidence < 0.75 || untranslatedTerms.length > 0,
    },
  };
}

function translateEmailBatch(requests, options = {}) {
  const sourceRequests = Array.isArray(requests) ? requests : [];
  const responses = sourceRequests.map((request) => translateEmail(request, options));
  const readyResponses = responses.filter((response) => response.status === "ready");

  return {
    status: responses.some((response) => response.status === "error") ? "needs-review" : "ready",
    totalRequests: sourceRequests.length,
    translated: readyResponses.length,
    reviewRequired: readyResponses.filter((response) => response.result.reviewRequired).length,
    errors: responses.filter((response) => response.status === "error").length,
    responses,
  };
}

export {
  SUPPORTED_LANGUAGES,
  createEmailTranslatorErrorState,
  createEmailTranslatorLoadingState,
  detectLanguage,
  getSupportedLanguagePairs,
  translateEmail,
  translateEmailBatch,
  validateTranslationRequest,
};

export const emailTranslatorCore = {
  supportedLanguages: SUPPORTED_LANGUAGES,
  createEmailTranslatorErrorState,
  createEmailTranslatorLoadingState,
  detectLanguage,
  getSupportedLanguagePairs,
  translateEmail,
  translateEmailBatch,
  validateTranslationRequest,
};

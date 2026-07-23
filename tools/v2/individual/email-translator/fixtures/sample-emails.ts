/**
 * Sample email content for testing and development.
 */

export const sampleEmails = {
  english: {
    short: "Hello, I hope this email finds you well. Let's schedule a meeting next week.",
    medium: `Dear Team,

I wanted to follow up on our discussion from yesterday's meeting. We need to finalize the project timeline and assign responsibilities for each deliverable.

Could everyone please review the attached document and provide feedback by Friday?

Best regards,
John`,
    long: `Dear Ms. Rodriguez,

Thank you for your inquiry regarding our services. I'm pleased to provide you with the information you requested about our translation capabilities.

Our company specializes in professional email translation services for business communications. We support over 20 languages and have a team of certified translators with expertise in various industries including technology, finance, healthcare, and legal sectors.

For your specific needs, I recommend our Premium Translation Package, which includes:
- Professional human translation
- Quality assurance review
- Native speaker verification
- 24-hour turnaround time
- Confidentiality guarantee

The pricing for this service starts at $0.15 per word, with volume discounts available for ongoing contracts. We also offer expedited services if you need faster delivery.

I've attached our complete service brochure and pricing schedule for your review. If you would like to discuss your translation needs in more detail, I'd be happy to schedule a call at your convenience.

Please don't hesitate to reach out if you have any questions.

Best regards,
Sarah Thompson
Sales Director
Global Translation Services`,
  },

  spanish: {
    short:
      "Hola, espero que este correo te encuentre bien. Programemos una reunión la próxima semana.",
    medium: `Estimado equipo,

Quería dar seguimiento a nuestra discusión de la reunión de ayer. Necesitamos finalizar el cronograma del proyecto y asignar responsabilidades para cada entregable.

¿Podrían todos revisar el documento adjunto y proporcionar comentarios antes del viernes?

Saludos cordiales,
Juan`,
  },

  french: {
    short:
      "Bonjour, j'espère que ce courriel vous trouve bien. Planifions une réunion la semaine prochaine.",
    medium: `Cher équipe,

Je voulais faire un suivi sur notre discussion de la réunion d'hier. Nous devons finaliser le calendrier du projet et attribuer les responsabilités pour chaque livrable.

Pourriez-vous tous s'il vous plaît examiner le document ci-joint et fournir des commentaires d'ici vendredi?

Cordialement,
Jean`,
  },

  german: {
    short:
      "Hallo, ich hoffe, diese E-Mail findet Sie wohlauf. Lassen Sie uns nächste Woche ein Treffen vereinbaren.",
  },

  japanese: {
    short:
      "こんにちは、このメールがあなたを元気に見つけることを願っています。来週会議を予定しましょう。",
  },

  chinese: {
    short: "你好，希望这封邮件能让你一切安好。让我们安排下周的会议。",
  },
};

export type EmailLanguage = keyof typeof sampleEmails;
export type EmailLength = "short" | "medium" | "long";

/**
 * Get a sample email by language and length.
 */
export function getSampleEmail(language: EmailLanguage, length: EmailLength = "short"): string {
  const emails = sampleEmails[language];
  if (!emails) {
    return sampleEmails.english.short;
  }

  if (length in emails) {
    return emails[length as keyof typeof emails];
  }

  return emails.short || sampleEmails.english.short;
}

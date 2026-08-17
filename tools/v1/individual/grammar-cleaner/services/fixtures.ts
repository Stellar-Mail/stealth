import type { GrammarInput } from "./grammarCleaner";

export interface GrammarFixture {
  id: string;
  description: string;
  input: GrammarInput;
}

export const SAMPLE_TEXTS: GrammarFixture[] = [
  {
    id: "common-errors",
    description: "Text with homophone and capitalization errors.",
    input: {
      subject: "Quick draft",
      bodyText:
        "i think there going to the meeting tomorrow. Your the best candidate for the role. Its important to recieve the documents before friday.",
    },
  },
  {
    id: "redundant-fillers",
    description: "Text with filler words and redundancy.",
    input: {
      subject: "Update",
      bodyText:
        "I just wanted to basically say that we are very happy with the results. The team really did an actually amazing job on this project.",
    },
  },
  {
    id: "punctuation-issues",
    description: "Text with punctuation and spacing issues.",
    input: {
      subject: "Notes",
      bodyText: "Please send the report , the invoice , and the summary .  We need them soon .",
    },
  },
  {
    id: "mixed-errors",
    description: "Text with multiple types of grammar issues.",
    input: {
      subject: "Follow up",
      bodyText:
        "i would of called you earlier but i accidently lost youre number. Theirs alot of work to do before the deadline .  Please confirm the calender invite.",
    },
  },
];

export const EMPTY_TEXT_INPUT: GrammarInput = {
  subject: "Empty",
  bodyText: "   ",
};

import { type FormEvent, useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "../../../src/components/ui/textarea";
import { Button } from "../../../src/components/ui/button";
import { Label } from "../../../src/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../src/components/ui/card";
import { Mail, Upload } from "lucide-react";
import { SAMPLE_EMAILS } from "../fixtures/sample-emails.fixtures";

export interface ContactInputPanelProps {
  onExtract: (rawEmail: string) => void;
  isLoading?: boolean;
}

export function ContactInputPanel({ onExtract, isLoading = false }: ContactInputPanelProps) {
  const [rawEmail, setRawEmail] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = rawEmail.trim();
      if (trimmed) {
        onExtract(trimmed);
      }
    },
    [rawEmail, onExtract],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const trimmed = rawEmail.trim();
        if (trimmed) {
          onExtract(trimmed);
        }
      }
    },
    [rawEmail, onExtract],
  );

  const loadFixture = useCallback((label: string) => {
    const fixture = SAMPLE_EMAILS.find((s) => s.label === label);
    if (fixture) {
      setRawEmail(fixture.raw);
      textareaRef.current?.focus();
    }
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" aria-hidden="true" />
          Contact Extractor
        </CardTitle>
        <CardDescription>
          Paste an email message below to extract contact information such as names, email
          addresses, phone numbers, and organizations.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-input" className="text-sm font-medium">
              Email message
            </Label>
            <Textarea
              ref={textareaRef}
              id="email-input"
              placeholder={`Paste an email message here...\n\nExample:\nFrom: "Jane Doe" <jane@example.com>\nTo: me@example.com\nSubject: Hello\n\nHi there,\n\nLet me know if you have questions.\n\nBest,\nJane Doe\nAcme Corp\n(555) 123-4567`}
              value={rawEmail}
              onChange={(e) => setRawEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-64 font-mono text-sm"
              aria-describedby="email-description"
              aria-required="true"
              disabled={isLoading}
              autoComplete="off"
              spellCheck={false}
            />
            <p id="email-description" className="text-xs text-muted-foreground">
              Press Ctrl+Enter to extract. Include full headers for best results.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Load sample email:</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Sample email fixtures">
              {SAMPLE_EMAILS.map((fixture) => (
                <Button
                  key={fixture.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadFixture(fixture.label)}
                  disabled={isLoading}
                  aria-label={`Load sample: ${fixture.label.replace(/-/g, " ")}`}
                >
                  {fixture.label.replace(/-/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRawEmail("")}
            disabled={!rawEmail || isLoading}
            aria-label="Clear email input"
          >
            Clear
          </Button>
          <Button
            type="submit"
            disabled={!rawEmail.trim() || isLoading}
            aria-label="Extract contacts from the pasted email"
          >
            {isLoading ? (
              <>
                <span
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                  aria-hidden="true"
                />
                Extracting...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                Extract Contacts
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

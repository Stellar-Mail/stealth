import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Star,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  MoreHorizontal,
  Paperclip,
  Calendar,
  Shield,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DemoMessage } from "../types/dataset";

interface DemoMailReaderProps {
  message: DemoMessage;
  onBackToList: () => void;
}

/**
 * Demo mail reader component that displays a single message with full content.
 *
 * This component provides a complete email reading experience using demo data
 * without integrating with live mail systems. All actions are simulated and
 * do not perform actual operations.
 */
export function DemoMailReader({ message, onBackToList }: DemoMailReaderProps) {
  const messageDate = new Date(message.date);
  const relativeTime = formatDistanceToNow(messageDate, { addSuffix: true });
  const fullDate = format(messageDate, "PPP 'at' p");

  // Generate consistent avatar color based on sender
  const getAvatarColor = (senderAddress: string) => {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-cyan-500",
    ];
    const hash = senderAddress.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  const avatarColor = getAvatarColor(message.sender.address);
  const senderInitials = message.sender.name
    ? message.sender.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : message.sender.address[0].toUpperCase();

  return (
    <div className="flex flex-col h-[600px] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              Demo Mode
            </Badge>
            <span className="text-sm text-muted-foreground">{relativeTime}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <Star
              className={cn(
                "h-4 w-4",
                message.isStarred ? "text-yellow-500 fill-current" : "text-muted-foreground",
              )}
            />
          </Button>
          <Button variant="ghost" size="sm">
            <Reply className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <ReplyAll className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Forward className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Mark as unread</DropdownMenuItem>
              <DropdownMenuItem>Snooze</DropdownMenuItem>
              <DropdownMenuItem>Add label</DropdownMenuItem>
              <DropdownMenuItem>Report spam</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6 space-y-6"
        >
          {/* Message Header */}
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold leading-tight">{message.subject}</h1>

            <div className="flex items-start space-x-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className={cn("text-white text-sm font-medium", avatarColor)}>
                  {senderInitials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {message.sender.name || message.sender.address}
                  </span>

                  {message.sender.isTrusted && (
                    <Badge variant="secondary" className="text-xs h-5 px-2 flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Verified Sender
                    </Badge>
                  )}

                  {message.proofRecord && <ProofStatusBadge status={message.proofRecord.status} />}
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div>
                    <span className="font-medium">From:</span> {message.sender.address}
                  </div>
                  <div>
                    <span className="font-medium">To:</span> {message.recipients.join(", ")}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {fullDate}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Proof Record Details */}
          {message.proofRecord && <ProofRecordDetails proofRecord={message.proofRecord} />}

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <AttachmentsSection attachments={message.attachments} />
          )}

          {/* Calendar Event */}
          {message.calendarEvent && <CalendarEventCard event={message.calendarEvent} />}

          <Separator />

          {/* Message Body */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: message.body }} className="leading-relaxed" />
          </div>

          {/* Labels */}
          {message.labels.length > 0 && (
            <div className="flex items-center space-x-2 pt-4">
              <span className="text-sm font-medium text-muted-foreground">Labels:</span>
              <div className="flex flex-wrap gap-2">
                {message.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </ScrollArea>
    </div>
  );
}

interface ProofStatusBadgeProps {
  status: "verified" | "pending" | "failed" | "none";
}

function ProofStatusBadge({ status }: ProofStatusBadgeProps) {
  const config = {
    verified: {
      icon: CheckCircle2,
      label: "Verified",
      variant: "default" as const,
      className: "bg-green-500 text-white",
    },
    pending: {
      icon: Clock,
      label: "Proof Pending",
      variant: "secondary" as const,
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    failed: {
      icon: AlertCircle,
      label: "Verification Failed",
      variant: "destructive" as const,
      className: "",
    },
    none: {
      icon: null,
      label: "",
      variant: "outline" as const,
      className: "",
    },
  };

  const { icon: Icon, label, variant, className } = config[status];

  if (!Icon || !label) return null;

  return (
    <Badge variant={variant} className={cn("text-xs h-5 px-2 flex items-center gap-1", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

interface ProofRecordDetailsProps {
  proofRecord: NonNullable<DemoMessage["proofRecord"]>;
}

function ProofRecordDetails({ proofRecord }: ProofRecordDetailsProps) {
  return (
    <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Proof Record</h3>
        <Badge variant="outline" className="text-xs">
          Demo Data
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium text-muted-foreground">Status:</span>
          <div className="mt-1">
            <ProofStatusBadge status={proofRecord.status} />
          </div>
        </div>

        <div>
          <span className="font-medium text-muted-foreground">Timestamp:</span>
          <div className="mt-1">{format(new Date(proofRecord.timestamp), "PPp")}</div>
        </div>

        {proofRecord.postageAmount && (
          <div>
            <span className="font-medium text-muted-foreground">Postage:</span>
            <div className="mt-1">
              {proofRecord.postageAmount} {proofRecord.postageCurrency || "DEMO"}
            </div>
          </div>
        )}

        {proofRecord.policyId && (
          <div>
            <span className="font-medium text-muted-foreground">Policy ID:</span>
            <div className="mt-1 font-mono text-xs">{proofRecord.policyId}</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface AttachmentsSectionProps {
  attachments: DemoMessage["attachments"];
}

function AttachmentsSection({ attachments }: AttachmentsSectionProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments ({attachments.length})
        </h3>
      </div>

      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-3 bg-background rounded border"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-muted rounded">
                <Paperclip className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{attachment.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.sizeBytes)} • {attachment.contentType}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CalendarEventCardProps {
  event: NonNullable<DemoMessage["calendarEvent"]>;
}

function CalendarEventCard({ event }: CalendarEventCardProps) {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          Calendar Event
        </h3>
        <Button variant="outline" size="sm" className="text-xs">
          Add to Calendar
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">{event.title}</h4>

        <div className="text-sm space-y-1">
          <div className="flex items-center space-x-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>
              {format(startDate, "PPP 'at' p")} - {format(endDate, "p")}
            </span>
          </div>

          {event.location && (
            <div className="flex items-center space-x-2">
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {event.attendees.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Attendees ({event.attendees.length})
            </p>
            <div className="text-xs text-muted-foreground">
              {event.attendees.slice(0, 3).join(", ")}
              {event.attendees.length > 3 && ` +${event.attendees.length - 3} more`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Star,
  Paperclip,
  Calendar,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DemoMessage } from "../types/dataset";

interface DemoInboxListProps {
  messages: DemoMessage[];
  onMessageSelect: (messageId: string) => void;
}

/**
 * Demo inbox list component that displays messages in a familiar email list format.
 *
 * This component mirrors the structure and styling of the real inbox list
 * without integrating with live mail systems. All interactions are local
 * and use demo data only.
 */
export function DemoInboxList({ messages, onMessageSelect }: DemoInboxListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground space-y-4">
        <Mail className="h-12 w-12 opacity-50" />
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">No messages in this folder</p>
          <p className="text-sm">This demo folder is empty</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="divide-y divide-border">
        {messages.map((message, index) => (
          <DemoMessageRow
            key={message.id}
            message={message}
            onSelect={() => onMessageSelect(message.id)}
            index={index}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface DemoMessageRowProps {
  message: DemoMessage;
  onSelect: () => void;
  index: number;
}

function DemoMessageRow({ message, onSelect, index }: DemoMessageRowProps) {
  const messageDate = new Date(message.date);
  const relativeTime = formatDistanceToNow(messageDate, { addSuffix: true });

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Button
        variant="ghost"
        className={cn(
          "w-full h-auto p-4 justify-start text-left hover:bg-muted/50 transition-colors",
          !message.isRead && "bg-accent/20 border-l-2 border-l-primary",
        )}
        onClick={onSelect}
      >
        <div className="flex items-start space-x-4 w-full">
          {/* Avatar */}
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarFallback className={cn("text-white text-sm font-medium", avatarColor)}>
              {senderInitials}
            </AvatarFallback>
          </Avatar>

          {/* Message Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <span
                  className={cn("text-sm font-medium truncate", !message.isRead && "font-semibold")}
                >
                  {message.sender.name || message.sender.address}
                </span>

                {/* Trust Badge */}
                {message.sender.isTrusted && (
                  <Shield className="h-3 w-3 text-green-500 flex-shrink-0" />
                )}

                {/* Proof Status */}
                {message.proofRecord && <ProofStatusIcon status={message.proofRecord.status} />}
              </div>

              <div className="flex items-center space-x-1 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{relativeTime}</span>
                {message.isStarred && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
              </div>
            </div>

            {/* Subject */}
            <p
              className={cn(
                "text-sm truncate",
                !message.isRead ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {message.subject}
            </p>

            {/* Snippet */}
            <p className="text-xs text-muted-foreground line-clamp-2">{message.snippet}</p>

            {/* Metadata Row */}
            <div className="flex items-center space-x-3 pt-1">
              {/* Attachments */}
              {message.attachments.length > 0 && (
                <Badge variant="outline" className="text-xs h-5 px-1.5 flex items-center gap-1">
                  <Paperclip className="h-2.5 w-2.5" />
                  {message.attachments.length}
                </Badge>
              )}

              {/* Calendar Event */}
              {message.calendarEvent && (
                <Badge variant="outline" className="text-xs h-5 px-1.5 flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  Event
                </Badge>
              )}

              {/* Snooze Status */}
              {message.snoozeRemindAt && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Snoozed
                </Badge>
              )}

              {/* Labels */}
              {message.labels.slice(0, 2).map(
                (label) =>
                  label !== "inbox" && (
                    <Badge key={label} variant="outline" className="text-xs h-5 px-1.5">
                      {label}
                    </Badge>
                  ),
              )}

              {message.labels.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{message.labels.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      </Button>
    </motion.div>
  );
}

interface ProofStatusIconProps {
  status: "verified" | "pending" | "failed" | "none";
}

function ProofStatusIcon({ status }: ProofStatusIconProps) {
  switch (status) {
    case "verified":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "pending":
      return <Clock className="h-3 w-3 text-yellow-500" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
}

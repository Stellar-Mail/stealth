import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Eye, Archive, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DemoInboxList } from "./DemoInboxList";
import { DemoMailReader } from "./DemoMailReader";
import { createDemoInboxData } from "../fixtures/demoInboxData";
import type { DemoMessage } from "../types/dataset";

interface DemoInboxPreviewProps {
  className?: string;
}

/**
 * A folder-local preview of the demo inbox dataset.
 *
 * This component provides a complete inbox preview experience without
 * wiring into live inbox systems. All data is fake, deterministic, and
 * safe for public repository review.
 */
export function DemoInboxPreview({ className }: DemoInboxPreviewProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "reader">("list");
  const demoData = createDemoInboxData();

  const selectedMessage = selectedMessageId
    ? (demoData.messages.find((msg) => msg.id === selectedMessageId) ?? null)
    : null;

  const handleMessageSelect = (messageId: string) => {
    setSelectedMessageId(messageId);
    setViewMode("reader");
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedMessageId(null);
  };

  const unreadCount = demoData.messages.filter((msg) => !msg.isRead).length;
  const starredCount = demoData.messages.filter((msg) => msg.isStarred).length;

  return (
    <div className={cn("flex flex-col space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Demo Inbox Preview
          </h2>
          <p className="text-sm text-muted-foreground">
            Folder-local preview of demo inbox dataset without live integration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {demoData.messages.length} messages
          </Badge>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              {unreadCount} unread
            </Badge>
          )}
          {starredCount > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {starredCount} starred
            </Badge>
          )}
        </div>
      </div>

      {/* Preview Controls */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview Mode</span>
          <Badge variant="outline">Demo Data Only</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn(viewMode === "list" && "bg-accent")}
          >
            List View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedMessage && setViewMode("reader")}
            disabled={!selectedMessage}
            className={cn(viewMode === "reader" && "bg-accent")}
          >
            Reader View
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Inbox ({demoData.messages.filter((msg) => msg.labels.includes("inbox")).length})
          </TabsTrigger>
          <TabsTrigger value="starred" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Starred ({starredCount})
          </TabsTrigger>
          <TabsTrigger value="archive" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archive ({demoData.messages.filter((msg) => msg.labels.includes("archive")).length})
          </TabsTrigger>
          <TabsTrigger value="trash" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Trash ({demoData.messages.filter((msg) => msg.labels.includes("trash")).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-6">
          <InboxTabContent
            messages={demoData.messages.filter((msg) => msg.labels.includes("inbox"))}
            viewMode={viewMode}
            selectedMessage={selectedMessage}
            onMessageSelect={handleMessageSelect}
            onBackToList={handleBackToList}
          />
        </TabsContent>

        <TabsContent value="starred" className="mt-6">
          <InboxTabContent
            messages={demoData.messages.filter((msg) => msg.isStarred)}
            viewMode={viewMode}
            selectedMessage={selectedMessage}
            onMessageSelect={handleMessageSelect}
            onBackToList={handleBackToList}
          />
        </TabsContent>

        <TabsContent value="archive" className="mt-6">
          <InboxTabContent
            messages={demoData.messages.filter((msg) => msg.labels.includes("archive"))}
            viewMode={viewMode}
            selectedMessage={selectedMessage}
            onMessageSelect={handleMessageSelect}
            onBackToList={handleBackToList}
          />
        </TabsContent>

        <TabsContent value="trash" className="mt-6">
          <InboxTabContent
            messages={demoData.messages.filter((msg) => msg.labels.includes("trash"))}
            viewMode={viewMode}
            selectedMessage={selectedMessage}
            onMessageSelect={handleMessageSelect}
            onBackToList={handleBackToList}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface InboxTabContentProps {
  messages: DemoMessage[];
  viewMode: "list" | "reader";
  selectedMessage: DemoMessage | null;
  onMessageSelect: (messageId: string) => void;
  onBackToList: () => void;
}

function InboxTabContent({
  messages,
  viewMode,
  selectedMessage,
  onMessageSelect,
  onBackToList,
}: InboxTabContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-[600px] border rounded-lg overflow-hidden"
    >
      {viewMode === "list" ? (
        <DemoInboxList messages={messages} onMessageSelect={onMessageSelect} />
      ) : selectedMessage ? (
        <DemoMailReader message={selectedMessage} onBackToList={onBackToList} />
      ) : (
        <div className="flex items-center justify-center h-[600px] text-muted-foreground">
          No message selected
        </div>
      )}
    </motion.div>
  );
}

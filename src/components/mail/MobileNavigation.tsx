"use client";

import { Menu, ArrowLeft, PenBox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { useMobileNavigation } from "@/hooks/useMobileNavigation";

export function MobileNavigation() {
  const { isDrawerOpen, openDrawer, closeDrawer, handleBack, isMobile } = useMobileNavigation();

  return (
    <div className="flex items-center justify-between border-b p-3 md:hidden">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" onClick={openDrawer}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <Sidebar onNavigate={closeDrawer} />
          </SheetContent>
        </Sheet>
      </div>

      <Button onClick={() => navigate({ to: "/mail/compose" })} size="sm" className="gap-2">
        <PenBox className="h-4 w-4" />
        Compose
      </Button>
    </div>
  );
}

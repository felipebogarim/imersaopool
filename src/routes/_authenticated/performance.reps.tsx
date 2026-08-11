import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Upload, RefreshCw, Trash2, Pencil, Save, XCircle, FileDown, FileText, RotateCcw, Undo2, MoreVertical, ChevronLeft, ChevronRight, Search, X, BarChart3, Users, Lightbulb } from "lucide-react";
import { AcoesSugeridasDialog } from "@/components/AcoesSugeridasDialog";
import { toast } from "sonner";
import { cn, famLabel } from "@/lib/utils";
import { parseWorkbook } from "@/lib/performance-parser";
import { conflictMessage, CONFLICT_LABEL } from "@/lib/performance-cell-status";
import { BISection } from "@/components/BISection";
import { exportPerformanceXlsx } from "@/lib/performance-export";
import { exportPerformanceReport } from "@/lib/performance-report";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { PeriodoPicker, type PeriodoValue } from "@/components/PeriodoPicker";
import {
  FAROL_CELL_CLASS,
  FAROL_FAIXA_TEXT,
  FAROL_LABEL,
  FAROL_ORDER,
  catBadge,
  statusFromPercent,
  type FarolStatus,
} from "@/lib/performance-farol";

// Import functionality from the original file
import { PerformancePageContent } from "./representantes.performance.tsx";

export const Route = createFileRoute("/_authenticated/performance/reps")({
  head: () => ({ meta: [{ title: "Performance Reps — PoolFlux" }] }),
  validateSearch: (search: Record<string, unknown>): { rep?: string; bi?: boolean } => ({
    rep: typeof search.rep === "string" ? search.rep : undefined,
    bi: search.bi === "1" || search.bi === true ? true : undefined,
  }),
  component: PerformanceRepsWrapper,
});

function PerformanceRepsWrapper() {
  return <PerformancePageContent />;
}

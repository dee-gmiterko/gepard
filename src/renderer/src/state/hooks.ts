import { useAppSelector } from './AppContext';
import { isDiffView } from './selectors';
import type {
  AppState,
  HeaderStatus,
  Layout,
  MainTab,
  QuickSearchMode,
  SidePanelTab,
  Targeting,
  Toast,
} from './reducer';

export function useProjectId(): string | null {
  return useAppSelector((s) => s.projectId);
}

export function useTargeting(): Targeting {
  return useAppSelector((s) => s.targeting);
}

export function useLayout(): Layout {
  return useAppSelector((s) => s.layout);
}

export function useCheckoutHead(): AppState['checkoutHead'] {
  return useAppSelector((s) => s.checkoutHead);
}

export function useActiveFile(): string | null {
  return useAppSelector((s) => s.activeFile);
}

export function usePreviewFile(): string | null {
  return useAppSelector((s) => s.previewFile);
}

export function usePinnedFiles(): string[] {
  return useAppSelector((s) => s.pinnedFiles);
}

export function useAcceptedFiles(): string[] {
  return useAppSelector((s) => s.acceptedFiles);
}

export function useRevealLine(): AppState['revealLine'] {
  return useAppSelector((s) => s.revealLine);
}

export function useMainTab(): MainTab {
  return useAppSelector((s) => s.mainTab);
}

export function useSidePanelTab(): SidePanelTab {
  return useAppSelector((s) => s.sidePanelTab);
}

export function useSidePanelFocusRequest(): number {
  return useAppSelector((s) => s.sidePanelFocusRequest);
}

export function useToasts(): Toast[] {
  return useAppSelector((s) => s.toasts);
}

export function useHeaderStatusState(): HeaderStatus | null {
  return useAppSelector((s) => s.headerStatus);
}

export function useSettingsOpen(): boolean {
  return useAppSelector((s) => s.settingsOpen);
}

export function useQuickSearchMode(): QuickSearchMode | null {
  return useAppSelector((s) => s.quickSearch);
}

export function useIsDiffView(): boolean {
  return useAppSelector(isDiffView);
}

export function useTargetPr(): number | null {
  return useAppSelector((s) => s.targeting.pr);
}

export function useTargetCommit(): string | null {
  return useAppSelector((s) => s.targeting.commit);
}

export function useTargetPath(): string | null {
  return useAppSelector((s) => s.targeting.path);
}

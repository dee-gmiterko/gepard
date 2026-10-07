import { useUiSelector } from './UiContext';
import { isDiffView } from './selectors';
import type {
  UiState,
  HeaderStatus,
  Layout,
  MainTab,
  QuickSearchMode,
  SidePanelTab,
  Targeting,
  Toast,
} from './reducer';

export function useProjectId(): string | null {
  return useUiSelector((s) => s.projectId);
}

export function useTargeting(): Targeting {
  return useUiSelector((s) => s.targeting);
}

export function useLayout(): Layout {
  return useUiSelector((s) => s.layout);
}

export function useCheckoutHead(): UiState['checkoutHead'] {
  return useUiSelector((s) => s.checkoutHead);
}

export function useActiveFile(): string | null {
  return useUiSelector((s) => s.activeFile);
}

export function usePreviewFile(): string | null {
  return useUiSelector((s) => s.previewFile);
}

export function usePinnedFiles(): string[] {
  return useUiSelector((s) => s.pinnedFiles);
}

export function useAcceptedFiles(): string[] {
  return useUiSelector((s) => s.acceptedFiles);
}

export function useRevealLine(): UiState['revealLine'] {
  return useUiSelector((s) => s.revealLine);
}

export function useMainTab(): MainTab {
  return useUiSelector((s) => s.mainTab);
}

export function useSidePanelTab(): SidePanelTab {
  return useUiSelector((s) => s.sidePanelTab);
}

export function useSidePanelFocusRequest(): number {
  return useUiSelector((s) => s.sidePanelFocusRequest);
}

export function useToasts(): Toast[] {
  return useUiSelector((s) => s.toasts);
}

export function useHeaderStatusState(): HeaderStatus | null {
  return useUiSelector((s) => s.headerStatus);
}

export function useSettingsOpen(): boolean {
  return useUiSelector((s) => s.settingsOpen);
}

export function useQuickSearchMode(): QuickSearchMode | null {
  return useUiSelector((s) => s.quickSearch);
}

export function useIsDiffView(): boolean {
  return useUiSelector(isDiffView);
}

export function useTargetPr(): number | null {
  return useUiSelector((s) => s.targeting.pr);
}

export function useTargetCommit(): string | null {
  return useUiSelector((s) => s.targeting.commit);
}

export function useTargetPath(): string | null {
  return useUiSelector((s) => s.targeting.path);
}

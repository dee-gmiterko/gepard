import { useRef } from 'react';
import styled from 'styled-components';
import { defineMessages, useIntl } from 'react-intl';
import { useUiDispatch } from '../../state/UiContext';
import type { QuickSearchMode } from '../../state/reducer';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { Surface } from '../../components/Surface';
import { QuickSearchFindInFile } from './QuickSearchFindInFile';
import { QuickSearchNavigate } from './QuickSearchNavigate';

const messages = defineMessages({
  dialog: {
    id: 'quickSearch.dialog',
    defaultMessage: 'Quick search',
  },
});

const Popup = styled(Surface).attrs({ $elevation: 'floating' as const })`
  position: fixed;
  top: 52px;
  left: 50%;
  transform: translateX(-50%);
  z-index: ${({ theme }) => theme.z.popover};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  width: 560px;
  max-width: calc(100vw - ${({ theme }) => theme.space[6]});
  padding: ${({ theme }) => theme.space[2]};
`;

export function QuickSearchPopup({ mode }: { mode: QuickSearchMode }): React.JSX.Element {
  const intl = useIntl();
  const dispatch = useUiDispatch();
  const popupRef = useRef<HTMLDivElement>(null);
  const close = (): void => dispatch({ type: 'quickSearch/close' });
  useOutsideClick(popupRef, close);

  return (
    <Popup ref={popupRef} role="dialog" aria-label={intl.formatMessage(messages.dialog)}>
      {mode === 'file' ? (
        <QuickSearchFindInFile onClose={close} />
      ) : (
        <QuickSearchNavigate onClose={close} />
      )}
    </Popup>
  );
}

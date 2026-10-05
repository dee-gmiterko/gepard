import type { MouseEvent } from 'react';
import styled from 'styled-components';
import { defineMessages, useIntl } from 'react-intl';
import { disabledControl, focusVisible } from '../../components/controlStyles';
import { useLaunchingProjectIds, useOpenProject } from '../../queries/projects';
import { useAppDispatch } from '../../state/AppContext';
import logo from '../../../../app/resources/logo.svg';

const messages = defineMessages({
  projects: {
    id: 'header.projects',
    defaultMessage: 'Projects',
  },
  launching: {
    id: 'header.launching',
    defaultMessage: 'Opening in a new window…',
  },
});

const LogoButton = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }

  ${disabledControl}
  ${focusVisible}
`;

const Image = styled.img`
  display: block;
  width: 22px;
  height: 22px;
`;

export function HeaderLogo(): React.JSX.Element {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { mutate: openProject } = useOpenProject();
  const launching = useLaunchingProjectIds().includes(null);
  const label = intl.formatMessage(launching ? messages.launching : messages.projects);

  function handleClick(e: MouseEvent): void {
    if (e.ctrlKey || e.metaKey) openProject({ projectId: null, detached: true });
    else dispatch({ type: 'project/close' });
  }

  return (
    <LogoButton
      type="button"
      aria-label={label}
      title={label}
      disabled={launching}
      aria-busy={launching || undefined}
      onClick={handleClick}
    >
      <Image src={logo} alt="" />
    </LogoButton>
  );
}

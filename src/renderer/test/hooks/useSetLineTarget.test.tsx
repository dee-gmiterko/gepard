import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { useSetLineTarget } from '../../src/hooks/useSetLineTarget';
import { useUiSelector } from '../../src/state/UiContext';
import { renderWithProviders } from '../support/render';
import { createWorld } from '../support/world';

const target = { path: 'a.ts', line: 3 };

function Probe(): React.JSX.Element {
  const setLineTarget = useSetLineTarget();
  const pending = useUiSelector((s) => s.contextMenuLineTarget);
  return (
    <>
      <button onClick={() => setLineTarget(target)}>Set</button>
      <output>{JSON.stringify(pending)}</output>
    </>
  );
}

describe('useSetLineTarget', () => {
  it('stores the target in the UI state in the browser host', async () => {
    const { ipc, user } = renderWithProviders(<Probe />, createWorld().handlers, {
      host: 'browser',
    });
    await user.click(await screen.findByRole('button', { name: 'Set' }));
    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify(target));
    expect(ipc.callsTo('contextMenu.setLineTarget')).toEqual([]);
  });

  it('sends the target over IPC in the desktop host', async () => {
    const { ipc, user } = renderWithProviders(<Probe />, createWorld().handlers);
    await user.click(await screen.findByRole('button', { name: 'Set' }));
    expect(ipc.callsTo('contextMenu.setLineTarget')).toEqual([target]);
    expect(screen.getByRole('status')).toHaveTextContent('null');
  });
});

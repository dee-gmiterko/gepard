import { useEffect, useId, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styled, { useTheme } from 'styled-components';
import type { Theme } from '../../theme/tokens';
import { mermaidFallbackTheme, mermaidThemeVariables } from './mermaidTheme';

const messages = defineMessages({
  renderFailed: {
    id: 'components.markdown.mermaid.renderFailed',
    defaultMessage: 'Could not render diagram: {reason}',
  },
  invalidSyntax: {
    id: 'components.markdown.mermaid.invalidSyntax',
    defaultMessage: 'invalid diagram syntax',
  },
});

const MAX_TEXT_SIZE = 50_000;
const svgCache = new Map<string, string>();

const Diagram = styled.div`
  overflow: auto;

  svg {
    max-width: 100%;
    height: auto;
  }
`;

const ErrorLine = styled.div`
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

type MermaidApi = (typeof import('mermaid'))['default'];

class InvalidSyntaxError extends Error {}

function removeOrphan(id: string): void {
  document.body.querySelector(`#d${id}`)?.remove();
}

async function renderSvg(
  mermaid: MermaidApi,
  id: string,
  source: string,
  theme: Theme,
): Promise<string> {
  const base = { startOnLoad: false, securityLevel: 'strict', maxTextSize: MAX_TEXT_SIZE } as const;
  const attempt = async (config: Parameters<MermaidApi['initialize']>[0]): Promise<string> => {
    mermaid.initialize({ ...base, ...config });
    if ((await mermaid.parse(source, { suppressErrors: true })) === false) {
      throw new InvalidSyntaxError();
    }
    return (await mermaid.render(id, source)).svg;
  };
  try {
    return await attempt({ theme: 'base', themeVariables: mermaidThemeVariables(theme) });
  } catch (error) {
    removeOrphan(id);
    if (error instanceof InvalidSyntaxError) throw error;
    // Mermaid's color library cannot parse var()/color-mix values, so retry with a built-in theme.
    return attempt({ theme: mermaidFallbackTheme(theme) });
  }
}

type State =
  { status: 'done'; key: string; svg: string } | { status: 'error'; key: string; reason: string };

export function MermaidBlock({ source }: { source: string }): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const id = useId().replaceAll(':', '');
  const cacheKey = `${theme.mode}\0${JSON.stringify(theme.colors)}\0${source}`;
  const cached = svgCache.get(cacheKey);
  const [state, setState] = useState<State>();

  useEffect(() => {
    if (cached !== undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        // eslint-disable-next-line no-restricted-syntax
        const { default: mermaid } = await import('mermaid');
        const svg = await renderSvg(mermaid, id, source, theme);
        svgCache.set(cacheKey, svg);
        if (!cancelled) setState({ status: 'done', key: cacheKey, svg });
      } catch (error) {
        removeOrphan(id);
        if (cancelled) return;
        const reason =
          error instanceof InvalidSyntaxError
            ? intl.formatMessage(messages.invalidSyntax)
            : error instanceof Error
              ? error.message
              : String(error);
        setState({ status: 'error', key: cacheKey, reason });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cached, cacheKey, id, source, theme, intl]);

  const current = state?.key === cacheKey ? state : undefined;
  const svg = cached ?? (current?.status === 'done' ? current.svg : undefined);
  if (svg !== undefined) return <Diagram dangerouslySetInnerHTML={{ __html: svg }} />;

  return (
    <>
      <pre>
        <code>{source}</code>
      </pre>
      {current?.status === 'error' && (
        <ErrorLine role="alert">
          {intl.formatMessage(messages.renderFailed, { reason: current.reason })}
        </ErrorLine>
      )}
    </>
  );
}

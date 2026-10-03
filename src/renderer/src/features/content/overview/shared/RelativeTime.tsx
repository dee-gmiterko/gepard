import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Caption } from '../../../../components/Caption';

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function RelativeTime({ value }: { value: string }): React.JSX.Element {
  const intl = useIntl();
  const [now] = useState(() => Date.now());
  const diff = Date.parse(value) - now;
  const [unit, size] = UNITS.find(([, ms]) => Math.abs(diff) >= ms) ?? UNITS[UNITS.length - 1];
  return (
    <Caption title={intl.formatDate(value, { dateStyle: 'medium', timeStyle: 'short' })}>
      {intl.formatRelativeTime(Math.round(diff / size), unit)}
    </Caption>
  );
}

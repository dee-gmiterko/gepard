import { useIntl } from 'react-intl';
import { useBinaryFormatBytes } from './useBinaryFormatBytes';

export function BinaryFactSize({ bytes }: { bytes: number }): React.JSX.Element {
  const intl = useIntl();
  const formatBytes = useBinaryFormatBytes();
  return (
    <span title={intl.formatNumber(bytes, { style: 'unit', unit: 'byte', unitDisplay: 'long' })}>
      {formatBytes(bytes)}
    </span>
  );
}
